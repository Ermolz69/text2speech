param(
  [string]$WebUrl = 'http://localhost:5173',
  [string]$GatewayUrl = 'http://localhost:4000',
  [string]$TextAnalysisUrl = 'http://localhost:8001',
  [string]$TtsAdapterUrl = 'http://localhost:8002',
  [string]$CorpusPath = 'docs/mvp-baseline/corpus.json',
  [string]$OutputDir = 'reports/mvp-baseline/latest'
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'modules/AudioRegressionTools.psm1') -Force

$corpus = Get-Content $CorpusPath | ConvertFrom-Json
$prompts = @($corpus.prompts)
$pairs = @($corpus.pairs)
$voiceId = if ($corpus.voiceId) { [string]$corpus.voiceId } else { 'voice-1' }

New-Item -ItemType Directory -Force $OutputDir | Out-Null
$jsonDir = Join-Path $OutputDir 'json'
$audioDir = Join-Path $OutputDir 'audio'
New-Item -ItemType Directory -Force $jsonDir | Out-Null
New-Item -ItemType Directory -Force $audioDir | Out-Null
Copy-Item $CorpusPath (Join-Path $OutputDir 'corpus.json') -Force

$gatewayHealth = Invoke-JsonGet "$GatewayUrl/health"
$textAnalysisHealth = Invoke-JsonGet "$TextAnalysisUrl/health"
$ttsHealth = Invoke-JsonGet "$TtsAdapterUrl/health"
$ttsReady = Invoke-JsonGet "$TtsAdapterUrl/health/ready"
Assert-ServiceIdentity -Payload $gatewayHealth -ExpectedService 'gateway' -Context 'Gateway health'
Assert-ServiceIdentity -Payload $textAnalysisHealth -ExpectedService 'text-analysis' -Context 'Text-analysis health'
Assert-ServiceIdentity -Payload $ttsHealth -ExpectedService 'tts-adapter' -Context 'TTS adapter health'
if (-not $ttsReady.ready) {
  throw "TTS adapter is not synthesis-ready: $($ttsReady | ConvertTo-Json -Depth 10)"
}

$piperVersion = Get-DockerCommandLine @('exec', '-T', 'tts-adapter', 'python', '-c', "import importlib.metadata as m; print(m.version('piper-tts'))")
$ffmpegVersion = Get-DockerCommandLine @('exec', '-T', 'tts-adapter', 'ffmpeg', '-version')

$promptSummaries = @()

foreach ($prompt in $prompts) {
  $promptId = [string]$prompt.id
  $promptText = [string]$prompt.text
  $promptTitle = [string]$prompt.title

  $analyzeResponse = Invoke-JsonPost "$WebUrl/api/analyze" @{ text = $promptText }
  Assert-AnalyzeResponse -Payload $analyzeResponse

  $ttsResponse = Invoke-WithRetry -OperationName "tts request for prompt $promptId" -Action { Invoke-JsonPost "$WebUrl/api/tts" @{
    text = $promptText
    voiceId = $voiceId
    metadata = @{ format = 'wav' }
  } }
  Assert-SynthesisResponse -Payload $ttsResponse

  $analyzePath = Join-Path $jsonDir "$promptId.analyze.json"
  $ttsPath = Join-Path $jsonDir "$promptId.tts.json"
  $audioPath = Join-Path $audioDir "$promptId.wav"

  $analyzeResponse | ConvertTo-Json -Depth 12 | Set-Content $analyzePath
  $ttsResponse | ConvertTo-Json -Depth 12 | Set-Content $ttsPath
  Invoke-WithRetry -OperationName "audio download for prompt $promptId" -Action { Invoke-AudioDownload -Uri "$WebUrl$($ttsResponse.audioUrl)" -OutputPath $audioPath | Out-Null }

  $file = Get-Item $audioPath
  if ($file.Length -le 0) {
    throw "Downloaded WAV file is empty: $audioPath"
  }

  $segments = @($analyzeResponse.segments)
  $segmentCount = $segments.Count
  $emotions = ($segments | ForEach-Object { $_.emotion }) -join ' / '
  $intensities = ($segments | ForEach-Object { $_.intensity }) -join ' / '
  $avgRate = Get-Average @($segments | ForEach-Object { [double]$_.rate })
  $avgPauseMs = Get-Average @($segments | ForEach-Object { [double]$_.pauseAfterMs })
  $avgPitchHint = Get-Average @($segments | ForEach-Object { [double]$_.pitchHint })
  $wavDurationMs = Get-WavDurationMs -Path $audioPath

  $promptSummaries += [pscustomobject]@{
    id = $promptId
    title = $promptTitle
    text = $promptText
    segmentCount = $segmentCount
    emotions = $emotions
    intensities = $intensities
    avgRate = $avgRate
    avgPauseMs = $avgPauseMs
    avgPitchHint = $avgPitchHint
    wavBytes = $file.Length
    wavDurationMs = $wavDurationMs
    analyzePath = $analyzePath
    ttsPath = $ttsPath
    audioPath = $audioPath
  }
}

$contrastChecks = @(Assert-BaselineContrast -PromptSummaries $promptSummaries)
$listeningChecklist = @(Get-BaselineListeningChecklist)

$comparisonSummaries = foreach ($pair in $pairs) {
  $left = $promptSummaries | Where-Object { $_.id -eq [string]$pair.left } | Select-Object -First 1
  $right = $promptSummaries | Where-Object { $_.id -eq [string]$pair.right } | Select-Object -First 1

  [pscustomobject]@{
    label = [string]$pair.label
    left = $left.id
    right = $right.id
    segmentDelta = $right.segmentCount - $left.segmentCount
    avgRateDelta = [math]::Round(($right.avgRate - $left.avgRate), 2)
    avgPauseDeltaMs = [math]::Round(($right.avgPauseMs - $left.avgPauseMs), 2)
    avgPitchDelta = [math]::Round(($right.avgPitchHint - $left.avgPitchHint), 2)
    wavDurationDeltaMs = [math]::Round(($right.wavDurationMs - $left.wavDurationMs), 2)
    leftEmotions = $left.emotions
    rightEmotions = $right.emotions
  }
}

$reportPath = Join-Path $OutputDir 'baseline_report.md'
$summaryPath = Join-Path $OutputDir 'summary.json'

$reportLines = @(
  '# MVP Baseline Regression Report',
  '',
  "Generated at: $(Get-Date -Format o)",
  '',
  '## Runtime',
  '',
  "- Gateway health: $($gatewayHealth.status)",
  "- Text-analysis health: $($textAnalysisHealth.status)",
  "- TTS adapter health: $($ttsHealth.status)",
  "- TTS adapter ready: $($ttsReady.ready)",
  "- Piper model path: $($ttsHealth.readiness.model_path)",
  "- Piper binary: $($ttsHealth.readiness.piper_bin)",
  "- FFmpeg binary: $($ttsHealth.readiness.ffmpeg_bin)",
  "- Piper version: $piperVersion",
  "- FFmpeg version: $ffmpegVersion",
  '',
  '## Prompt Summary',
  '',
  '| ID | Title | Segments | Emotions | Intensities | Avg rate | Avg pause ms | Avg pitch | WAV bytes | WAV duration ms |',
  '| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |'
)

foreach ($summary in $promptSummaries) {
  $reportLines += "| $($summary.id) | $($summary.title) | $($summary.segmentCount) | $($summary.emotions) | $($summary.intensities) | $($summary.avgRate) | $($summary.avgPauseMs) | $($summary.avgPitchHint) | $($summary.wavBytes) | $($summary.wavDurationMs) |"
}

$reportLines += ''
$reportLines += '## Contrast Checks'
$reportLines += ''
foreach ($check in $contrastChecks) {
  $status = if ($check.passed) { 'PASS' } else { 'FAIL' }
  $reportLines += "- [$status] $($check.name): $($check.details)"
}

$reportLines += ''
$reportLines += '## Listening Checklist'
$reportLines += ''
foreach ($item in $listeningChecklist) {
  $reportLines += "- [$($item.prompts)] $($item.instruction)"
}

$reportLines += ''
$reportLines += '## Pairwise Comparisons'
$reportLines += ''
foreach ($comparison in $comparisonSummaries) {
  $reportLines += "### $($comparison.label)"
  $reportLines += ''
  $reportLines += "- Emotions: $($comparison.leftEmotions) -> $($comparison.rightEmotions)"
  $reportLines += "- Segment delta: $($comparison.segmentDelta)"
  $reportLines += "- Avg rate delta: $($comparison.avgRateDelta)"
  $reportLines += "- Avg pause delta ms: $($comparison.avgPauseDeltaMs)"
  $reportLines += "- Avg pitch delta: $($comparison.avgPitchDelta)"
  $reportLines += "- WAV duration delta ms: $($comparison.wavDurationDeltaMs)"
  $reportLines += ''
}

$reportLines += '## Prompt Artifacts'
$reportLines += ''
foreach ($summary in $promptSummaries) {
  $reportLines += ('### Prompt ' + $summary.id + ': ' + $summary.title)
  $reportLines += ''
  $reportLines += ('- Text: ' + $summary.text)
  $reportLines += ('- Analyze JSON: ' + $summary.analyzePath)
  $reportLines += ('- TTS JSON: ' + $summary.ttsPath)
  $reportLines += ('- WAV: ' + $summary.audioPath)
  $reportLines += ''
}

$reportLines | Set-Content $reportPath

$summary = [pscustomobject]@{
  generatedAt = (Get-Date -Format o)
  promptCount = $promptSummaries.Count
  successfulPrompts = $promptSummaries.Count
  gatewayStatus = $gatewayHealth.status
  textAnalysisStatus = $textAnalysisHealth.status
  ttsAdapterStatus = $ttsHealth.status
  ttsReady = [bool]$ttsReady.ready
  piperModelPath = $ttsHealth.readiness.model_path
  piperVersion = $piperVersion
  ffmpegVersion = $ffmpegVersion
  contrastChecks = $contrastChecks
  listeningChecklist = $listeningChecklist
  reportPath = $reportPath
  prompts = $promptSummaries
  comparisons = $comparisonSummaries
}

$summary | ConvertTo-Json -Depth 12 | Set-Content $summaryPath

Write-Host ''
Write-Host 'MVP baseline regression summary:'
[pscustomobject]@{
  PromptCount = $summary.promptCount
  GatewayStatus = $summary.gatewayStatus
  TextAnalysisStatus = $summary.textAnalysisStatus
  TtsAdapterStatus = $summary.ttsAdapterStatus
  TtsReady = $summary.ttsReady
  ContrastChecks = (@($contrastChecks | Where-Object { $_.passed }).Count).ToString() + '/' + $contrastChecks.Count
  ListeningChecklist = $listeningChecklist.Count
  ReportPath = $reportPath
  OutputDir = $OutputDir
} | Format-List

