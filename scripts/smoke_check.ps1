param(
  [string]$WebUrl = 'http://localhost:5173',
  [string]$GatewayUrl = 'http://localhost:4000',
  [string]$TextAnalysisUrl = 'http://localhost:8001',
  [string]$TtsAdapterUrl = 'http://localhost:8002',
  [switch]$RequireSynthesisReady
)

$ErrorActionPreference = 'Stop'

function Get-Json($Url) {
  return Invoke-RestMethod -Method Get -Uri $Url
}

function Post-Json($Url, $Body) {
  return Invoke-RestMethod -Method Post -Uri $Url -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 10 -Compress)
}

function Get-ReadyJson($Url) {
  try {
    return Invoke-RestMethod -Method Get -Uri $Url
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

Write-Host 'Checking gateway health...'
$gatewayHealth = Get-Json "$GatewayUrl/health"
if ($gatewayHealth.service -ne 'gateway') {
  throw "Gateway health returned unexpected payload: $($gatewayHealth | ConvertTo-Json -Depth 5)"
}

Write-Host 'Checking web proxy health...'
$webHealth = Get-Json "$WebUrl/health"
if ($webHealth.service -ne 'gateway') {
  throw "Web proxy health returned unexpected payload: $($webHealth | ConvertTo-Json -Depth 5)"
}

Write-Host 'Checking text-analysis health...'
$textHealth = Get-Json "$TextAnalysisUrl/health"
if ($textHealth.service -ne 'text-analysis') {
  throw "Text-analysis health returned unexpected payload: $($textHealth | ConvertTo-Json -Depth 5)"
}

Write-Host 'Checking tts-adapter health...'
$ttsHealth = Get-Json "$TtsAdapterUrl/health"
if ($ttsHealth.service -ne 'tts-adapter') {
  throw "TTS adapter health returned unexpected payload: $($ttsHealth | ConvertTo-Json -Depth 5)"
}

Write-Host 'Checking analyze flow through web proxy...'
$analyzeResponse = Post-Json "$WebUrl/api/analyze" @{ text = 'Hello! :) How are you?' }
if (-not $analyzeResponse.segments -or $analyzeResponse.segments.Count -lt 1) {
  throw 'Analyze response did not contain segments.'
}

Write-Host 'Checking tts-adapter readiness...'
$readyResponse = Get-ReadyJson "$TtsAdapterUrl/health/ready"

if ($RequireSynthesisReady -and -not $readyResponse.ready) {
  throw "TTS adapter is not synthesis-ready: $($readyResponse | ConvertTo-Json -Depth 10)"
}

Write-Host ''
Write-Host 'Smoke check summary:'
[pscustomobject]@{
  GatewayStatus = $gatewayHealth.status
  WebProxyStatus = $webHealth.status
  TextAnalysisStatus = $textHealth.status
  TtsAdapterStatus = $ttsHealth.status
  TtsReady = $readyResponse.ready
  SegmentCount = $analyzeResponse.segments.Count
} | Format-List

if ($readyResponse.ready) {
  Write-Host 'Synthesis readiness is OK.'
} else {
  Write-Host 'Synthesis readiness is not OK yet. Add a Piper model to models/piper/model.onnx for full /api/tts verification.'
}
