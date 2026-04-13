param(
  [string]$WebUrl = 'http://localhost:5173',
  [string]$OutputPath = 'reports/latest-synthesis-check.wav',
  [string]$Text = 'Hello! :) How are you?',
  [string]$VoiceId = 'voice-1',
  [string]$PersistentAudioDir = 'src/services/tts-adapter/generated-audio'
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'modules/AudioRegressionTools.psm1') -Force

$parent = Split-Path -Parent $OutputPath
if ($parent) {
  New-Item -ItemType Directory -Force $parent | Out-Null
}

Write-Host 'Requesting /api/tts through web...'
$response = Invoke-WithRetry -OperationName "synthesis request" -Action { Invoke-JsonPost "$WebUrl/api/tts" @{
  text = $Text
  voiceId = $VoiceId
  metadata = @{ format = 'wav' }
} }
Assert-SynthesisResponse -Payload $response

$audioUri = "$WebUrl$($response.audioUrl)"
Write-Host "Downloading generated audio from $audioUri ..."
$download = Invoke-WithRetry -OperationName "synthesis audio download" -Action { Invoke-AudioDownload -Uri $audioUri -OutputPath $OutputPath }
$file = Get-Item $OutputPath
$persistentAudioPath = Join-Path $PersistentAudioDir ([System.IO.Path]::GetFileName($response.audioUrl))

if ($download.StatusCode -ne 200) {
  throw "Unexpected audio download status: $($download.StatusCode)"
}

if ($download.Headers['Content-Type'] -notmatch 'audio/.+wav|audio/x-wav') {
  throw "Unexpected audio content type: $($download.Headers['Content-Type'])"
}

if ($file.Length -le 0) {
  throw "Downloaded WAV file is empty: $OutputPath"
}

if (-not (Test-Path $persistentAudioPath)) {
  throw "Persistent generated WAV file was not found: $persistentAudioPath"
}

Write-Host ''
Write-Host 'Synthesis integration summary:'
[pscustomobject]@{
  AudioUrl = $response.audioUrl
  OutputPath = $file.FullName
  PersistentAudioPath = (Resolve-Path $persistentAudioPath).Path
  Bytes = $file.Length
  DurationMs = (Get-WavDurationMs -Path $file.FullName)
  ContentType = $download.Headers['Content-Type']
  SegmentCount = @($response.metadata.segments).Count
} | Format-List

