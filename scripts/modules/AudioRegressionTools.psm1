Set-StrictMode -Version Latest

function Invoke-WithRetry {
  param(
    [scriptblock]$Action,
    [int]$MaxAttempts = 3,
    [int]$DelaySeconds = 2,
    [string]$OperationName = 'operation'
  )

  $attempt = 0
  while ($true) {
    $attempt += 1
    try {
      return & $Action
    } catch {
      if ($attempt -ge $MaxAttempts) {
        throw
      }
      Write-Host "Retrying $OperationName ($attempt/$MaxAttempts failed)..."
      Start-Sleep -Seconds $DelaySeconds
    }
  }
}

function Invoke-JsonGet {
  param([string]$Url)
  Invoke-RestMethod -Method Get -Uri $Url
}

function Invoke-JsonPost {
  param(
    [string]$Url,
    [object]$Body
  )

  Invoke-RestMethod -Method Post -Uri $Url -ContentType 'application/json; charset=utf-8' -Body ($Body | ConvertTo-Json -Depth 10 -Compress)
}

function Get-ReadinessJson {
  param([string]$Url)

  try {
    Invoke-RestMethod -Method Get -Uri $Url
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 503) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      try {
        return ($reader.ReadToEnd() | ConvertFrom-Json)
      } finally {
        $reader.Dispose()
      }
    }

    throw
  }
}

function Invoke-AudioDownload {
  param(
    [string]$Uri,
    [string]$OutputPath
  )

  Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $OutputPath -PassThru
}

function Get-WavDurationMs {
  param([string]$Path)

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 12) {
    throw "WAV file is too small: $Path"
  }

  $riff = [System.Text.Encoding]::ASCII.GetString($bytes, 0, 4)
  $wave = [System.Text.Encoding]::ASCII.GetString($bytes, 8, 4)
  if ($riff -ne 'RIFF' -or $wave -ne 'WAVE') {
    throw "Invalid WAV header for $Path"
  }

  $sampleRate = $null
  $blockAlign = $null
  $dataSize = $null
  $offset = 12

  while (($offset + 8) -le $bytes.Length) {
    $chunkId = [System.Text.Encoding]::ASCII.GetString($bytes, $offset, 4)
    $chunkSize = [BitConverter]::ToUInt32($bytes, $offset + 4)
    $chunkDataOffset = $offset + 8

    if (($chunkDataOffset + $chunkSize) -gt $bytes.Length) {
      throw "Invalid WAV chunk layout for $Path"
    }

    if ($chunkId -eq 'fmt ') {
      if ($chunkSize -lt 16) {
        throw "Invalid fmt chunk for $Path"
      }
      $sampleRate = [BitConverter]::ToUInt32($bytes, $chunkDataOffset + 4)
      $blockAlign = [BitConverter]::ToUInt16($bytes, $chunkDataOffset + 12)
    } elseif ($chunkId -eq 'data') {
      $dataSize = $chunkSize
    }

    $offset = $chunkDataOffset + [int]$chunkSize
    if (($chunkSize % 2) -eq 1) {
      $offset += 1
    }
  }

  if (-not $sampleRate -or -not $blockAlign -or -not $dataSize) {
    throw "Missing WAV timing fields for $Path"
  }

  return [math]::Round(($dataSize / ($sampleRate * $blockAlign)) * 1000, 2)
}

function Get-DockerCommandLine {
  param([string[]]$Arguments)

  try {
    $output = & docker compose @Arguments 2>$null
    if (-not $output) {
      return $null
    }
    return (($output | Select-Object -First 1) -join '').Trim()
  } catch {
    return $null
  }
}

function Get-Average {
  param([object[]]$Values)

  if (-not $Values -or $Values.Count -eq 0) {
    return 0
  }

  return [math]::Round((($Values | Measure-Object -Average).Average), 2)
}

function Assert-ServiceIdentity {
  param(
    [psobject]$Payload,
    [string]$ExpectedService,
    [string]$Context
  )

  if ($Payload.service -ne $ExpectedService) {
    throw "$Context returned unexpected payload: $($Payload | ConvertTo-Json -Depth 8)"
  }
}

function Assert-AnalyzeResponse {
  param([psobject]$Payload)

  if (-not $Payload.segments -or $Payload.segments.Count -lt 1) {
    throw 'Analyze response did not contain segments.'
  }
}

function Assert-SynthesisResponse {
  param([psobject]$Payload)

  if (-not $Payload.audioUrl) {
    throw "Synthesis response did not contain audioUrl: $($Payload | ConvertTo-Json -Depth 8)"
  }
}

function Get-PromptSummaryById {
  param(
    [object[]]$PromptSummaries,
    [string]$Id
  )

  $match = $PromptSummaries | Where-Object { $_.id -eq $Id } | Select-Object -First 1
  if (-not $match) {
    throw "Prompt summary with id '$Id' was not found."
  }
  return $match
}

function Get-BaselineContrastChecks {
  param([object[]]$PromptSummaries)

  $neutral = Get-PromptSummaryById -PromptSummaries $PromptSummaries -Id '1'
  $emphatic = Get-PromptSummaryById -PromptSummaries $PromptSummaries -Id '2'
  $ellipsis = Get-PromptSummaryById -PromptSummaries $PromptSummaries -Id '3'
  $emoji = Get-PromptSummaryById -PromptSummaries $PromptSummaries -Id '7'
  $plainHappy = Get-PromptSummaryById -PromptSummaries $PromptSummaries -Id '8'
  $segmented = Get-PromptSummaryById -PromptSummaries $PromptSummaries -Id '9'
  $expressive = Get-PromptSummaryById -PromptSummaries $PromptSummaries -Id '10'

  @(
    [pscustomobject]@{
      name = 'emphatic_faster_and_brighter_than_neutral'
      passed = ($emphatic.avgRate -gt $neutral.avgRate) -and ($emphatic.avgPitchHint -gt $neutral.avgPitchHint)
      details = "neutral(rate=$($neutral.avgRate), pitch=$($neutral.avgPitchHint)) vs emphatic(rate=$($emphatic.avgRate), pitch=$($emphatic.avgPitchHint))"
    }
    [pscustomobject]@{
      name = 'ellipsis_slower_and_longer_than_neutral'
      passed = ($ellipsis.avgRate -lt $neutral.avgRate) -and ($ellipsis.avgPauseMs -gt $neutral.avgPauseMs)
      details = "neutral(rate=$($neutral.avgRate), pause=$($neutral.avgPauseMs)) vs ellipsis(rate=$($ellipsis.avgRate), pause=$($ellipsis.avgPauseMs))"
    }
    [pscustomobject]@{
      name = 'emoji_changes_expression_against_plain_statement'
      passed = ($emoji.emotions -ne $plainHappy.emotions) -or ($emoji.avgPitchHint -gt $plainHappy.avgPitchHint)
      details = "emoji(emotions=$($emoji.emotions), pitch=$($emoji.avgPitchHint)) vs plain(emotions=$($plainHappy.emotions), pitch=$($plainHappy.avgPitchHint))"
    }
    [pscustomobject]@{
      name = 'expressive_multisegment_stronger_than_plain_multisegment'
      passed = ($expressive.avgPitchHint -gt $segmented.avgPitchHint) -and ($expressive.avgPauseMs -gt $segmented.avgPauseMs)
      details = "plain(pitch=$($segmented.avgPitchHint), pause=$($segmented.avgPauseMs)) vs expressive(pitch=$($expressive.avgPitchHint), pause=$($expressive.avgPauseMs))"
    }
  )
}

function Get-BaselineListeningChecklist {
  @(
    [pscustomobject]@{
      id = 'neutral_vs_emphatic'
      prompts = '1 vs 2'
      instruction = 'Confirm prompt 2 sounds faster and more lifted than prompt 1, without sounding distorted.'
    }
    [pscustomobject]@{
      id = 'neutral_vs_ellipsis'
      prompts = '1 vs 3'
      instruction = 'Confirm prompt 3 sounds slightly slower and more hesitant than prompt 1, but not overly dragged.'
    }
    [pscustomobject]@{
      id = 'emoji_vs_plain'
      prompts = '7 vs 8'
      instruction = 'Confirm prompt 7 feels more positive than prompt 8 and that the emoji is not spoken literally.'
    }
    [pscustomobject]@{
      id = 'plain_vs_expressive_multisegment'
      prompts = '9 vs 10'
      instruction = 'Confirm prompt 10 has clearer inter-segment contrast, pauses, and expressive lift than prompt 9.'
    }
  )
}

function Assert-BaselineContrast {
  param([object[]]$PromptSummaries)

  $checks = @(Get-BaselineContrastChecks -PromptSummaries $PromptSummaries)
  $failed = @($checks | Where-Object { -not $_.passed })
  if ($failed.Count -gt 0) {
    throw "Baseline contrast checks failed: $($failed | ConvertTo-Json -Depth 8 -Compress)"
  }
  return $checks
}

function Invoke-NeutralSynthesis {
  param(
    [string]$WebUrl,
    [string]$Text,
    [string]$VoiceId = 'voice-1'
  )

  Invoke-WithRetry -OperationName "neutral synthesis" -Action {
    Invoke-JsonPost "$WebUrl/api/tts" @{
      text = $Text
      voiceId = $VoiceId
      metadata = @{ format = 'wav'; emotion = 'neutral'; intensity = 0 }
    }
  }
}

function Invoke-ExpressiveSynthesis {
  param(
    [string]$WebUrl,
    [string]$Text,
    [string]$VoiceId = 'voice-1'
  )

  Invoke-WithRetry -OperationName "expressive synthesis" -Action {
    Invoke-JsonPost "$WebUrl/api/tts" @{
      text = $Text
      voiceId = $VoiceId
      metadata = @{ format = 'wav' }
    }
  }
}

function Compute-BenchmarkMetrics {
  param(
    [object[]]$PromptResults
  )

  $metrics = @()
  foreach ($result in $PromptResults) {
    $neutralDurationMs = $result.neutralWavDurationMs
    $expressiveDurationMs = $result.expressiveWavDurationMs
    $durationDeltaMs = [math]::Round(($expressiveDurationMs - $neutralDurationMs), 2)

    $neutralBytes = $result.neutralWavBytes
    $expressiveBytes = $result.expressiveWavBytes
    $bytesDelta = $expressiveBytes - $neutralBytes

    $neutralSegments = $result.neutralSegmentCount
    $expressiveSegments = $result.expressiveSegmentCount
    $segmentDelta = $expressiveSegments - $neutralSegments

    $metrics += [pscustomobject]@{
      promptId = $result.promptId
      promptTitle = $result.promptTitle
      neutralWavBytes = $neutralBytes
      expressiveWavBytes = $expressiveBytes
      bytesDelta = $bytesDelta
      neutralWavDurationMs = $neutralDurationMs
      expressiveWavDurationMs = $expressiveDurationMs
      durationDeltaMs = $durationDeltaMs
      neutralSegmentCount = $neutralSegments
      expressiveSegmentCount = $expressiveSegments
      segmentDelta = $segmentDelta
      neutralEmotions = $result.neutralEmotions
      expressiveEmotions = $result.expressiveEmotions
    }
  }

  $totalNeutralBytes = ($metrics | Measure-Object -Property neutralWavBytes -Sum).Sum
  $totalExpressiveBytes = ($metrics | Measure-Object -Property expressiveWavBytes -Sum).Sum
  $avgNeutralDuration = Get-Average @($metrics | ForEach-Object { $_.neutralWavDurationMs })
  $avgExpressiveDuration = Get-Average @($metrics | ForEach-Object { $_.expressiveWavDurationMs })
  $avgDurationDelta = Get-Average @($metrics | ForEach-Object { $_.durationDeltaMs })

  return [pscustomobject]@{
    perPrompt = $metrics
    totalPrompts = $metrics.Count
    totalNeutralBytes = $totalNeutralBytes
    totalExpressiveBytes = $totalExpressiveBytes
    avgNeutralDurationMs = $avgNeutralDuration
    avgExpressiveDurationMs = $avgExpressiveDuration
    avgDurationDeltaMs = $avgDurationDelta
  }
}

function Write-BenchmarkReport {
  param(
    [object]$Metrics,
    [string]$ReportPath,
    [string]$SummaryPath,
    [string]$GeneratedAt,
    [string]$WebUrl,
    [string]$CorpusPath
  )

  $reportLines = @(
    '# Neutral vs Expressive Synthesis Benchmark Report',
    '',
    "Generated at: $GeneratedAt",
    "Web URL: $WebUrl",
    "Corpus: $CorpusPath",
    '',
    '## Summary',
    '',
    "- Total prompts: $($Metrics.totalPrompts)",
    "- Total neutral audio size: $($Metrics.totalNeutralBytes) bytes",
    "- Total expressive audio size: $($Metrics.totalExpressiveBytes) bytes",
    "- Avg neutral duration: $($Metrics.avgNeutralDurationMs) ms",
    "- Avg expressive duration: $($Metrics.avgExpressiveDurationMs) ms",
    "- Avg duration delta (expressive - neutral): $($Metrics.avgDurationDeltaMs) ms",
    '',
    '## Per-Prompt Comparison',
    '',
    '| ID | Title | Neutral (ms) | Expressive (ms) | Delta (ms) | Neutral (bytes) | Expressive (bytes) | Neutral Segments | Expressive Segments |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  )

  foreach ($m in $Metrics.perPrompt) {
    $reportLines += "| $($m.promptId) | $($m.promptTitle) | $($m.neutralWavDurationMs) | $($m.expressiveWavDurationMs) | $($m.durationDeltaMs) | $($m.neutralWavBytes) | $($m.expressiveWavBytes) | $($m.neutralSegmentCount) | $($m.expressiveSegmentCount) |"
  }

  $reportLines += ''
  $reportLines += '## Emotion Distribution'
  $reportLines += ''
  $reportLines += '| ID | Title | Neutral Emotions | Expressive Emotions |'
  $reportLines += '| --- | --- | --- | --- |'

  foreach ($m in $Metrics.perPrompt) {
    $reportLines += "| $($m.promptId) | $($m.promptTitle) | $($m.neutralEmotions) | $($m.expressiveEmotions) |"
  }

  $reportLines | Set-Content $ReportPath

  $summary = [pscustomobject]@{
    generatedAt = $GeneratedAt
    webUrl = $WebUrl
    corpusPath = $CorpusPath
    totalPrompts = $Metrics.totalPrompts
    totalNeutralBytes = $Metrics.totalNeutralBytes
    totalExpressiveBytes = $Metrics.totalExpressiveBytes
    avgNeutralDurationMs = $Metrics.avgNeutralDurationMs
    avgExpressiveDurationMs = $Metrics.avgExpressiveDurationMs
    avgDurationDeltaMs = $Metrics.avgDurationDeltaMs
    perPrompt = $Metrics.perPrompt
  }

  $summary | ConvertTo-Json -Depth 12 | Set-Content $SummaryPath
}

Export-ModuleMember -Function Invoke-WithRetry, Invoke-JsonGet, Invoke-JsonPost, Get-ReadinessJson, Invoke-AudioDownload, Get-WavDurationMs, Get-DockerCommandLine, Get-Average, Assert-ServiceIdentity, Assert-AnalyzeResponse, Assert-SynthesisResponse, Get-BaselineContrastChecks, Get-BaselineListeningChecklist, Assert-BaselineContrast, Invoke-NeutralSynthesis, Invoke-ExpressiveSynthesis, Compute-BenchmarkMetrics, Write-BenchmarkReport
