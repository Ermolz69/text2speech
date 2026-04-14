param(
    [switch]$IncludeWeb,
    [switch]$IncludeGateway,
    [switch]$IncludeTextAnalysis,
    [switch]$IncludeTtsAdapter
)

$ErrorActionPreference = 'Stop'

$runAll = -not ($IncludeWeb -or $IncludeGateway -or $IncludeTextAnalysis -or $IncludeTtsAdapter)
if ($runAll) {
    $IncludeWeb = $true
    $IncludeGateway = $true
    $IncludeTextAnalysis = $true
    $IncludeTtsAdapter = $true
}

function Invoke-Step {
    param(
        [string]$Label,
        [string]$Command,
        [string]$WorkingDirectory
    )

    Write-Host "==> $Label"
    Push-Location $WorkingDirectory
    try {
        Invoke-Expression $Command
        if ($LASTEXITCODE -ne 0) {
            throw "$Label failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Get-JsCoverageSummary {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $null
    }

    $coverage = Get-Content $Path -Raw | ConvertFrom-Json
    return [PSCustomObject]@{
        Lines = $coverage.total.lines.pct
        Statements = $coverage.total.statements.pct
        Functions = $coverage.total.functions.pct
        Branches = $coverage.total.branches.pct
    }
}

function Get-PythonCoverageSummary {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $null
    }

    $lineCoverage = (& py -c "import json,sys; data=json.load(open(sys.argv[1], encoding='utf-8')); print(data['totals']['percent_covered_display'])" $Path).Trim()
    $statementCoverage = (& py -c "import json,sys; data=json.load(open(sys.argv[1], encoding='utf-8')); print(data['totals'].get('percent_statements_covered_display', data['totals']['percent_covered_display']))" $Path).Trim()

    return [PSCustomObject]@{
        Lines = $lineCoverage
        Statements = $statementCoverage
        Functions = 'n/a'
        Branches = 'n/a'
    }
}

$results = @()

if ($IncludeWeb) {
    Invoke-Step -Label 'Web coverage' -Command 'pnpm.cmd --dir src/apps/web run coverage' -WorkingDirectory $PSScriptRoot\..
    $results += [PSCustomObject]@{ Service = 'web'; Summary = Get-JsCoverageSummary "$PSScriptRoot\..\src\apps\web\coverage\coverage-summary.json" }
}

if ($IncludeGateway) {
    Invoke-Step -Label 'Gateway coverage' -Command 'pnpm.cmd --dir src/apps/gateway run coverage' -WorkingDirectory $PSScriptRoot\..
    $results += [PSCustomObject]@{ Service = 'gateway'; Summary = Get-JsCoverageSummary "$PSScriptRoot\..\src\apps\gateway\coverage\coverage-summary.json" }
}

if ($IncludeTextAnalysis) {
    Invoke-Step -Label 'Text-analysis coverage' -Command 'py -m pytest -q --cov=app --cov-report=term-missing --cov-report=json:coverage/coverage.json --cov-report=html:coverage/html' -WorkingDirectory "$PSScriptRoot\..\src\services\text-analysis"
    $results += [PSCustomObject]@{ Service = 'text-analysis'; Summary = Get-PythonCoverageSummary "$PSScriptRoot\..\src\services\text-analysis\coverage\coverage.json" }
}

if ($IncludeTtsAdapter) {
    Invoke-Step -Label 'TTS adapter coverage' -Command 'py -m pytest -q --cov=app --cov-report=term-missing --cov-report=json:coverage/coverage.json --cov-report=html:coverage/html' -WorkingDirectory "$PSScriptRoot\..\src\services\tts-adapter"
    $results += [PSCustomObject]@{ Service = 'tts-adapter'; Summary = Get-PythonCoverageSummary "$PSScriptRoot\..\src\services\tts-adapter\coverage\coverage.json" }
}

Write-Host ''
Write-Host 'Coverage summary:'
$results | ForEach-Object {
    if ($null -eq $_.Summary) {
        Write-Host ("- {0}: no coverage summary found" -f $_.Service)
        return
    }

    Write-Host ("- {0}: lines {1}%, statements {2}%, functions {3}, branches {4}" -f $_.Service, $_.Summary.Lines, $_.Summary.Statements, $_.Summary.Functions, $_.Summary.Branches)
}
