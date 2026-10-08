param(
    [switch]$ReinstallDependencies,
    [switch]$SkipVerification,
    [switch]$Render
)

$ErrorActionPreference = 'Stop'
$aerialRoot = Split-Path -Parent $PSCommandPath
$aerialNode = Get-Command node -ErrorAction Stop
$aerialNpm = Get-Command npm.cmd -ErrorAction Stop

function Invoke-AerialNpm {
    param([string[]]$Arguments)
    & $aerialNpm.Source --prefix $aerialRoot @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "The project command failed: npm $($Arguments -join ' ')"
    }
}

try {
    $aerialVersion = & $aerialNode.Source --version
    if ($LASTEXITCODE -ne 0 -or [int]($aerialVersion.TrimStart('v').Split('.')[0]) -lt 22) {
        throw 'Node.js 22 or later is required. Install Node.js from https://nodejs.org/ and run setup again.'
    }

    $aerialInstallNeeded = $ReinstallDependencies.IsPresent
    if (-not $aerialInstallNeeded) {
        & $aerialNode.Source (Join-Path $aerialRoot 'scripts/check-install.mjs')
        $aerialInstallNeeded = $LASTEXITCODE -ne 0
    }
    if ($aerialInstallNeeded) {
        Invoke-AerialNpm -Arguments @('ci', '--no-audit', '--no-fund')
    }

    foreach ($aerialDirectory in @('private', 'public/data')) {
        $aerialTarget = Join-Path $aerialRoot $aerialDirectory
        New-Item -ItemType Directory -Path $aerialTarget -Force | Out-Null
    }
    $aerialEnv = Join-Path $aerialRoot '.env.local'
    if (-not (Test-Path -LiteralPath $aerialEnv)) {
        Copy-Item -LiteralPath (Join-Path $aerialRoot '.env.example') -Destination $aerialEnv
    }
    $aerialManifest = Join-Path $aerialRoot 'private/dataset.json'
    if (-not (Test-Path -LiteralPath $aerialManifest)) {
        Copy-Item -LiteralPath (Join-Path $aerialRoot 'dataset.example.json') -Destination $aerialManifest
    }

    & $aerialNpm.Source --prefix $aerialRoot run browser:check
    $aerialBrowserExit = $LASTEXITCODE
    if ($aerialBrowserExit -eq 3) {
        Invoke-AerialNpm -Arguments @('run', 'install:browser')
        Invoke-AerialNpm -Arguments @('run', 'browser:check')
    } elseif ($aerialBrowserExit -ne 0) {
        throw 'Browser configuration is invalid. Correct CHROMIUM_PATH in .env.local; existing configuration has been preserved.'
    }

    Invoke-AerialNpm -Arguments @('run', 'doctor', '--', '--save')
    if (-not $SkipVerification) {
        Invoke-AerialNpm -Arguments @('test')
        Invoke-AerialNpm -Arguments @('run', 'build')
        Invoke-AerialNpm -Arguments @('run', 'smoke')
    }
    Write-Host ''
    Write-Host 'Local setup is complete. Existing configuration and license files were preserved.'
    Write-Host 'The property video requires the real licensed survey described in README.md.'
    Write-Host 'Preview: npm --prefix aerial run dev'
    Write-Host 'Render after supplying the survey: npm --prefix aerial run render'
    if ($Render) {
        Invoke-AerialNpm -Arguments @('run', 'render')
    }
} catch {
    Write-Error $_.Exception.Message -ErrorAction Continue
    exit 1
}
