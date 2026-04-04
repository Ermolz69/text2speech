param(
  [string]$WebUrl = 'http://localhost:5173',
  [string]$GatewayUrl = 'http://localhost:4000',
  [string]$TextAnalysisUrl = 'http://localhost:8001',
  [string]$TtsAdapterUrl = 'http://localhost:8002',
  [switch]$RequireSynthesisReady
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'modules/AudioRegressionTools.psm1') -Force

Write-Host 'Checking gateway health...'
$gatewayHealth = Invoke-JsonGet "$GatewayUrl/health"
Assert-ServiceIdentity -Payload $gatewayHealth -ExpectedService 'gateway' -Context 'Gateway health'

Write-Host 'Checking web proxy health...'
$webHealth = Invoke-JsonGet "$WebUrl/health"
Assert-ServiceIdentity -Payload $webHealth -ExpectedService 'gateway' -Context 'Web proxy health'

Write-Host 'Checking text-analysis health...'
$textHealth = Invoke-JsonGet "$TextAnalysisUrl/health"
Assert-ServiceIdentity -Payload $textHealth -ExpectedService 'text-analysis' -Context 'Text-analysis health'

Write-Host 'Checking tts-adapter health...'
$ttsHealth = Invoke-JsonGet "$TtsAdapterUrl/health"
Assert-ServiceIdentity -Payload $ttsHealth -ExpectedService 'tts-adapter' -Context 'TTS adapter health'

Write-Host 'Checking analyze flow through web proxy...'
$analyzeResponse = Invoke-JsonPost "$WebUrl/api/analyze" @{ text = 'Hello! :) How are you?' }
Assert-AnalyzeResponse -Payload $analyzeResponse

Write-Host 'Checking tts-adapter readiness...'
$readyResponse = Get-ReadinessJson "$TtsAdapterUrl/health/ready"

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
