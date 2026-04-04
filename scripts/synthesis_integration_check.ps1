param(
  [string]$WebUrl = 'http://localhost:5173',
  [string]$OutputPath = 'reports/latest-synthesis-check.wav',
  [string]$Text = 'Hello! :) How are you?',
  [string]$VoiceId = 'voice-1'
)

$ErrorActionPreference = 'Stop'

$parent = Split-Path -Parent $OutputPath
if ($parent) {
  New-Item -ItemType Directory -Force $parent | Out-Null
}

Write-Host 'Requesting /api/tts through web...'
$response = Invoke-RestMethod -Method Post -Uri "$WebUrl/api/tts" -ContentType 'application/json' -Body (@{
  text = $Text
  voiceId = $VoiceId
  metadata = @{ format = 'wav' }
} | ConvertTo-Json -Depth 10 -Compress)

if (-not $response.audioUrl) {
  throw "Synthesis response did not contain audioUrl: $($response | ConvertTo-Json -Depth 10)"
}

$audioUri = "$WebUrl$($response.audioUrl)"
Write-Host "Downloading generated audio from $audioUri ..."
$download = Invoke-WebRequest -UseBasicParsing -Uri $audioUri -OutFile $OutputPath -PassThru
$file = Get-Item $OutputPath

if ($download.StatusCode -ne 200) {
  throw "Unexpected audio download status: $($download.StatusCode)"
}

if ($download.Headers['Content-Type'] -notmatch 'audio/.+wav|audio/x-wav') {
  throw "Unexpected audio content type: $($download.Headers['Content-Type'])"
}

if ($file.Length -le 0) {
  throw "Downloaded WAV file is empty: $OutputPath"
}

Write-Host ''
Write-Host 'Synthesis integration summary:'
[pscustomobject]@{
  AudioUrl = $response.audioUrl
  OutputPath = $file.FullName
  Bytes = $file.Length
  ContentType = $download.Headers['Content-Type']
  SegmentCount = @($response.metadata.segments).Count
} | Format-List
