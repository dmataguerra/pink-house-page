$ErrorActionPreference = 'Stop'
$aerialRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$packageRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $aerialRoot))
$packageOutput = [System.IO.Path]::GetFullPath((Join-Path $packageRoot 'output'))
New-Item -ItemType Directory -Path $packageOutput -Force | Out-Null
$packageFinal = [System.IO.Path]::GetFullPath((Join-Path $packageOutput 'house_flyover_source.zip'))
$packageTemporary = [System.IO.Path]::GetFullPath((Join-Path $packageOutput ('.source-' + [Guid]::NewGuid().ToString('N') + '.zip')))
if ([System.IO.Path]::GetDirectoryName($packageFinal) -ne $packageOutput -or [System.IO.Path]::GetDirectoryName($packageTemporary) -ne $packageOutput) {
    throw 'The source archive path is outside the intended output directory.'
}

$packageFiles = @{}
foreach ($packageFile in @('.env.example', '.gitignore', 'dataset.example.json', 'index.html', 'package.json', 'package-lock.json', 'README.md', 'START_HERE.md', 'TECHNICAL_REPORT.md', 'SURVEYED_MODE_RESEARCH.md', 'tsconfig.json', 'vite.config.ts', 'setup.ps1')) {
    $packagePath = Join-Path $aerialRoot $packageFile
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Missing source file: $packageFile" }
    $packageFiles[('aerial/' + $packageFile)] = $packagePath
}
foreach ($packageFolder in @('src', 'server', 'scripts', 'tests', 'types')) {
    $packageFolderPath = Join-Path $aerialRoot $packageFolder
    foreach ($packageItem in (Get-ChildItem -LiteralPath $packageFolderPath -Recurse -File)) {
        if ($packageItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Linked source files cannot be packaged.' }
        if ($packageItem.Extension -notin @('.ts', '.tsx', '.css', '.mjs', '.ps1')) { continue }
        $packageRelative = $packageItem.FullName.Substring($aerialRoot.Length + 1).Replace('\', '/')
        $packageFiles[('aerial/' + $packageRelative)] = $packageItem.FullName
    }
}
$packageFiles['START_HERE.md'] = Join-Path $aerialRoot 'START_HERE.md'
foreach ($packageItem in (Get-ChildItem -LiteralPath (Join-Path $aerialRoot 'public/open-data') -File)) {
    if ($packageItem.Extension -notin @('.json', '.geojson', '.txt', '.md')) { continue }
    if ($packageItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Linked data files cannot be packaged.' }
    $packageFiles[('aerial/public/open-data/' + $packageItem.Name)] = $packageItem.FullName
}
$packageFiles['output/.gitignore'] = Join-Path $packageOutput '.gitignore'
if (-not (Test-Path -LiteralPath $packageFiles['output/.gitignore'] -PathType Leaf)) {
    Set-Content -LiteralPath $packageFiles['output/.gitignore'] -Value "*`n!.gitignore" -Encoding ascii
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageArchive = [System.IO.Compression.ZipFile]::Open($packageTemporary, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($packageEntry in ($packageFiles.Keys | Sort-Object)) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($packageArchive, $packageFiles[$packageEntry], $packageEntry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $packageArchive.Dispose() }

$packageArchive = [System.IO.Compression.ZipFile]::OpenRead($packageTemporary)
try {
    $packageEntries = @($packageArchive.Entries | ForEach-Object { $_.FullName })
    foreach ($packageRequired in @('START_HERE.md', 'aerial/setup.ps1', 'aerial/package-lock.json', 'aerial/.env.example', 'aerial/scripts/render.ts', 'output/.gitignore')) {
        if ($packageRequired -notin $packageEntries) { throw "The source archive is incomplete: $packageRequired" }
    }
    foreach ($packageEntry in $packageEntries) {
        if ($packageEntry -match '(^|/)(node_modules|dist|private)(/|$)|(^|/)\.env($|\.local$)|/public/data/|\.mp4$|\.png$|\.exe$') {
            throw 'The source archive contains an excluded private or generated file.'
        }
    }
} finally { $packageArchive.Dispose() }

if (Test-Path -LiteralPath $packageFinal) {
    if (-not (Test-Path -LiteralPath $packageFinal -PathType Leaf)) { throw 'The existing source archive is not a file.' }
    $packageBackup = [System.IO.Path]::GetFullPath((Join-Path $packageOutput ('house_flyover_source.previous-' + [Guid]::NewGuid().ToString('N') + '.zip')))
    if ([System.IO.Path]::GetDirectoryName($packageBackup) -ne $packageOutput) { throw 'The backup path is outside the output directory.' }
    Move-Item -LiteralPath $packageFinal -Destination $packageBackup
}
Move-Item -LiteralPath $packageTemporary -Destination $packageFinal
$packageHasher = [System.Security.Cryptography.SHA256]::Create()
$packageStream = [System.IO.File]::OpenRead($packageFinal)
try {
    $packageHash = [System.BitConverter]::ToString($packageHasher.ComputeHash($packageStream)).Replace('-', '').ToLowerInvariant()
} finally { $packageStream.Dispose(); $packageHasher.Dispose() }
Set-Content -LiteralPath (Join-Path $packageOutput 'house_flyover_source.zip.sha256') -Value ($packageHash + '  house_flyover_source.zip') -Encoding ascii
Write-Host ('Source package verified: output/house_flyover_source.zip (' + $packageEntries.Count + ' files).')
Write-Host 'Credentials, license documents, survey assets and generated video are excluded.'
