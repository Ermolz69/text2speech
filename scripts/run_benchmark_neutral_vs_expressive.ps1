param(
  [string]$WebUrl = 'http://localhost:5173',
  [string]$CorpusPath = 'docs/mvp-baseline/corpus.json',
  [string]$BenchmarkDir = 'benchmarks',
  [string]$ReportDir = 'reports'
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'modules/AudioRegressionTools.psm1') -Force

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$runDir = Join-Path $BenchmarkDir "run-$timestamp"
$jsonDir = Join-Path $runDir 'json'
$audioDir = Join-Path $runDir 'audio'
New-Item -ItemType Directory -Force $jsonDir | Out-Null
New-Item -ItemType Directory -Force $audioDir | Out-Null

$reportOutputDir = Join-Path $ReportDir "benchmark-$timestamp"
New-Item -ItemType Directory -Force $reportOutputDir | Out-Null

$corpus = Get-Content $CorpusPath | ConvertFrom-Json
$prompts = @($corpus.prompts)
$voiceId = if ($corpus.voiceId) { [string]$corpus.voiceId } else { 'voice-1' }

$health = Invoke-JsonGet "$WebUrl/health"
if ($health.service -ne 'gateway') {
  throw "Gateway health check failed: $($health | ConvertTo-Json -Depth 8)"
}

$promptResults = @()

foreach ($prompt in $prompts) {
  $promptId = [string]$prompt.id
  $promptText = [string]$prompt.text
  $promptTitle = [string]$prompt.title

  Write-Host "Processing prompt $promptId ($promptTitle)..."

  $analyzeResponse = Invoke-JsonPost "$WebUrl/api/analyze" @{ text = $promptText }
  Assert-AnalyzeResponse -Payload $analyzeResponse

  Write-Host "  Synthesizing neutral variant..."
  $neutralResponse = Invoke-NeutralSynthesis -WebUrl $WebUrl -Text $promptText -VoiceId $voiceId
  Assert-SynthesisResponse -Payload $neutralResponse

  Write-Host "  Synthesizing expressive variant..."
  $expressiveResponse = Invoke-ExpressiveSynthesis -WebUrl $WebUrl -Text $promptText -VoiceId $voiceId
  Assert-SynthesisResponse -Payload $expressiveResponse

  $neutralJsonPath = Join-Path $jsonDir "$promptId.neutral.json"
  $expressiveJsonPath = Join-Path $jsonDir "$promptId.expressive.json"
  $neutralAudioPath = Join-Path $audioDir "$promptId.neutral.wav"
  $expressiveAudioPath = Join-Path $audioDir "$promptId.expressive.wav"

  $neutralResponse | ConvertTo-Json -Depth 12 | Set-Content $neutralJsonPath
  $expressiveResponse | ConvertTo-Json -Depth 12 | Set-Content $expressiveJsonPath

  Invoke-WithRetry -OperationName "neutral audio download for prompt $promptId" -Action {
    Invoke-AudioDownload -Uri "$WebUrl$($neutralResponse.audioUrl)" -OutputPath $neutralAudioPath | Out-Null
  }

  Invoke-WithRetry -OperationName "expressive audio download for prompt $promptId" -Action {
    Invoke-AudioDownload -Uri "$WebUrl$($expressiveResponse.audioUrl)" -OutputPath $expressiveAudioPath | Out-Null
  }

  $neutralFile = Get-Item $neutralAudioPath
  $expressiveFile = Get-Item $expressiveAudioPath

  if ($neutralFile.Length -le 0) {
    throw "Neutral WAV file is empty: $neutralAudioPath"
  }
  if ($expressiveFile.Length -le 0) {
    throw "Expressive WAV file is empty: $expressiveAudioPath"
  }

  $neutralSegments = @($analyzeResponse.segments)
  $neutralEmotions = ($neutralSegments | ForEach-Object { $_.emotion }) -join ' / '

  $expressiveSegments = if ($expressiveResponse.metadata -and $expressiveResponse.metadata.segments) {
    @($expressiveResponse.metadata.segments)
  } else {
    $neutralSegments
  }
  $expressiveEmotions = ($expressiveSegments | ForEach-Object { $_.emotion }) -join ' / '

  $promptResults += [pscustomobject]@{
    promptId = $promptId
    promptTitle = $promptTitle
    promptText = $promptText
    neutralWavBytes = $neutralFile.Length
    expressiveWavBytes = $expressiveFile.Length
    neutralWavDurationMs = Get-WavDurationMs -Path $neutralAudioPath
    expressiveWavDurationMs = Get-WavDurationMs -Path $expressiveAudioPath
    neutralSegmentCount = $neutralSegments.Count
    expressiveSegmentCount = $expressiveSegments.Count
    neutralEmotions = $neutralEmotions
    expressiveEmotions = $expressiveEmotions
    neutralJsonPath = $neutralJsonPath
    expressiveJsonPath = $expressiveJsonPath
    neutralAudioPath = $neutralAudioPath
    expressiveAudioPath = $expressiveAudioPath
  }
}

Write-Host ''
Write-Host 'Computing benchmark metrics...'
$metrics = Compute-BenchmarkMetrics -PromptResults $promptResults

$generatedAt = Get-Date -Format o
$reportPath = Join-Path $reportOutputDir 'benchmark_report.md'
$summaryPath = Join-Path $reportOutputDir 'summary.json'

Write-Host "Writing benchmark report to $reportPath..."
Write-BenchmarkReport -Metrics $metrics -ReportPath $reportPath -SummaryPath $summaryPath -GeneratedAt $generatedAt -WebUrl $WebUrl -CorpusPath $CorpusPath

Write-Host ''
Write-Host 'Neutral vs Expressive Benchmark Summary:'
[pscustomobject]@{
  PromptCount = $metrics.totalPrompts
  AvgNeutralDurationMs = $metrics.avgNeutralDurationMs
  AvgExpressiveDurationMs = $metrics.avgExpressiveDurationMs
  AvgDurationDeltaMs = $metrics.avgDurationDeltaMs
  TotalNeutralBytes = $metrics.totalNeutralBytes
  TotalExpressiveBytes = $metrics.totalExpressiveBytes
  BenchmarkDir = $runDir
  ReportPath = $reportPath
  SummaryPath = $summaryPath
} | Format-List
