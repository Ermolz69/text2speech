Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '../modules/AudioRegressionTools.psm1') -Force

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Assert-Throws {
  param(
    [scriptblock]$Action,
    [string]$Message
  )

  try {
    & $Action
  } catch {
    return
  }

  throw $Message
}

function New-TestWavFile {
  param(
    [string]$Path,
    [int]$DurationMs = 1000,
    [int]$SampleRate = 8000
  )

  $channels = 1
  $bitsPerSample = 16
  $blockAlign = $channels * ($bitsPerSample / 8)
  $byteRate = $SampleRate * $blockAlign
  $frameCount = [int]($SampleRate * ($DurationMs / 1000.0))
  $dataBytes = New-Object byte[] ($frameCount * $blockAlign)
  $fmtChunkSize = 16
  $listPayload = [System.Text.Encoding]::ASCII.GetBytes('INFO')
  $listChunkSize = $listPayload.Length
  $dataChunkSize = $dataBytes.Length
  $riffSize = 4 + (8 + $fmtChunkSize) + (8 + $listChunkSize) + (8 + $dataChunkSize)

  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  try {
    $writer = New-Object System.IO.BinaryWriter($stream)
    $writer.Write([System.Text.Encoding]::ASCII.GetBytes('RIFF'))
    $writer.Write([uint32]$riffSize)
    $writer.Write([System.Text.Encoding]::ASCII.GetBytes('WAVE'))

    $writer.Write([System.Text.Encoding]::ASCII.GetBytes('fmt '))
    $writer.Write([uint32]$fmtChunkSize)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$channels)
    $writer.Write([uint32]$SampleRate)
    $writer.Write([uint32]$byteRate)
    $writer.Write([uint16]$blockAlign)
    $writer.Write([uint16]$bitsPerSample)

    $writer.Write([System.Text.Encoding]::ASCII.GetBytes('LIST'))
    $writer.Write([uint32]$listChunkSize)
    $writer.Write($listPayload)

    $writer.Write([System.Text.Encoding]::ASCII.GetBytes('data'))
    $writer.Write([uint32]$dataChunkSize)
    $writer.Write($dataBytes)
    $writer.Flush()
  } finally {
    $stream.Dispose()
  }
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ('audio-regression-tests-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $tempDir | Out-Null

try {
  $wavPath = Join-Path $tempDir 'sample.wav'
  New-TestWavFile -Path $wavPath -DurationMs 1000
  $durationMs = Get-WavDurationMs -Path $wavPath
  Assert-True ([math]::Abs($durationMs - 1000) -lt 1) "Expected WAV duration around 1000ms, got $durationMs"

  Assert-True ((Get-Average @(1, 2, 3)) -eq 2) 'Expected average of 1,2,3 to be 2'
  Assert-True ((Get-Average @()) -eq 0) 'Expected average of empty array to be 0'

  Assert-ServiceIdentity -Payload ([pscustomobject]@{ service = 'gateway'; status = 'ok' }) -ExpectedService 'gateway' -Context 'Gateway health'
  Assert-Throws { Assert-ServiceIdentity -Payload ([pscustomobject]@{ service = 'web' }) -ExpectedService 'gateway' -Context 'Gateway health' } 'Expected service identity assertion to throw for wrong service'

  Assert-AnalyzeResponse -Payload ([pscustomobject]@{ segments = @([pscustomobject]@{ text = 'Hello' }) })
  Assert-Throws { Assert-AnalyzeResponse -Payload ([pscustomobject]@{ segments = @() }) } 'Expected analyze response assertion to throw for empty segments'

  Assert-SynthesisResponse -Payload ([pscustomobject]@{ audioUrl = '/audio/test.wav' })
  Assert-Throws { Assert-SynthesisResponse -Payload ([pscustomobject]@{ metadata = @{} }) } 'Expected synthesis response assertion to throw when audioUrl is missing'

  $goodSummaries = @(
    [pscustomobject]@{ id = '1'; avgRate = 1.0; avgPitchHint = 0.0; avgPauseMs = 150; emotions = 'neutral' },
    [pscustomobject]@{ id = '2'; avgRate = 1.18; avgPitchHint = 3.0; avgPauseMs = 150; emotions = 'neutral' },
    [pscustomobject]@{ id = '3'; avgRate = 0.96; avgPitchHint = 0.0; avgPauseMs = 220; emotions = 'sadness' },
    [pscustomobject]@{ id = '7'; avgRate = 1.0; avgPitchHint = 2.0; avgPauseMs = 150; emotions = 'joy' },
    [pscustomobject]@{ id = '8'; avgRate = 1.0; avgPitchHint = 0.0; avgPauseMs = 150; emotions = 'neutral' },
    [pscustomobject]@{ id = '9'; avgRate = 1.0; avgPitchHint = 0.0; avgPauseMs = 150; emotions = 'neutral / neutral / neutral' },
    [pscustomobject]@{ id = '10'; avgRate = 1.05; avgPitchHint = 1.67; avgPauseMs = 173.33; emotions = 'sadness / neutral / joy' }
  )

  $checks = @(Assert-BaselineContrast -PromptSummaries $goodSummaries)
  Assert-True ($checks.Count -eq 4) 'Expected four baseline contrast checks'
  Assert-True ((@($checks | Where-Object { $_.passed }).Count) -eq 4) 'Expected all baseline contrast checks to pass'

  $badSummaries = @(
    $goodSummaries[0],
    [pscustomobject]@{ id = '2'; avgRate = 1.0; avgPitchHint = 0.0; avgPauseMs = 150; emotions = 'neutral' },
    $goodSummaries[2],
    $goodSummaries[3],
    $goodSummaries[4],
    $goodSummaries[5],
    $goodSummaries[6]
  )
  Assert-Throws { Assert-BaselineContrast -PromptSummaries $badSummaries } 'Expected baseline contrast assertion to fail for flattened emphatic prompt'

  Write-Host 'Script helper tests passed.'
} finally {
  if (Test-Path $tempDir) {
    Remove-Item -LiteralPath $tempDir -Recurse -Force
  }
}
