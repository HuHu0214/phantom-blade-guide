# Download the local map tiles / landmark screenshots used by the "地图" tab.
# The assets are intentionally not stored in this repository (game imagery).
param(
    [string]$Repo = "https://github.com/MapleEve/pbz-map.git"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "public\map"
$tmp = Join-Path $env:TEMP "pbz-map-assets-source"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "未找到 git。请先安装 Git for Windows。"
}

if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
Write-Host "正在下载地图素材（约 110 MB）..."
git clone --depth 1 $Repo $tmp

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item (Join-Path $tmp "public\assets") (Join-Path $dest "assets") -Recurse -Force
Copy-Item (Join-Path $tmp "public\data") (Join-Path $dest "data") -Recurse -Force
if (Test-Path (Join-Path $tmp "LICENSE")) {
    Copy-Item (Join-Path $tmp "LICENSE") (Join-Path $dest "LICENSE-pbz-map.txt") -Force
}

Remove-Item -Recurse -Force $tmp
Write-Host ""
Write-Host "地图素材已复制到 public/map。"
Write-Host "这些素材不随仓库分发，仅本地个人使用。"
Write-Host "来源：MapleEve/pbz-map，CC BY-NC 4.0（原始项目内容）；游戏地图/截图版权归原方。"
