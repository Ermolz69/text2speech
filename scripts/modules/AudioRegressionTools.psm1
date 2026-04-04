Set-StrictMode -Version Latest

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

Export-ModuleMember -Function Invoke-JsonGet, Invoke-JsonPost, Get-ReadinessJson, Get-WavDurationMs, Get-DockerCommandLine, Get-Average, Assert-ServiceIdentity, Assert-AnalyzeResponse, Assert-SynthesisResponse, Get-BaselineContrastChecks, Get-BaselineListeningChecklist, Assert-BaselineContrast
