# Paalam installer for Windows (PowerShell).
#   irm https://raw.githubusercontent.com/rehaanajani/paalam/main/scripts/install.ps1 | iex
# Installs into $HOME\paalam (or $env:PAALAM_DIR), sets it up, and starts it on http://localhost:8080.
# Run it again to update. $env:PAALAM_NO_START = "1" sets up without starting.
$ErrorActionPreference = "Stop"
$Repo = "https://github.com/rehaanajani/paalam.git"
$Dir = if ($env:PAALAM_DIR) { $env:PAALAM_DIR } else { Join-Path $HOME "paalam" }
function Say($m) { Write-Host "> $m" -ForegroundColor Magenta }
function Fail($m) { Write-Host "x $m" -ForegroundColor Red; exit 1 }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail "git is missing. Install it from https://git-scm.com, then run this again." }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js is missing. Install Node.js 20 or newer from https://nodejs.org, then run this again." }
$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 20) { Fail "Node.js $(node -v) is too old. Install Node.js 20 or newer from https://nodejs.org, then run this again." }

if (Test-Path (Join-Path $Dir ".git")) {
  Say "Updating Paalam in $Dir"
  git -C $Dir pull --ff-only
} else {
  Say "Downloading Paalam into $Dir"
  git clone --depth 1 $Repo $Dir
}
Set-Location $Dir

Say "Installing and building (a minute or two the first time)"
npm run setup --silent

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Say "Created .env: Paalam runs in demo mode until you add keys (see docs/KEYS.md)"
}

if ($env:PAALAM_NO_START -eq "1") { Say "Ready. Start it any time with:  cd `"$Dir`"; npm start"; exit 0 }

Say "Starting Paalam on http://localhost:8080  (Ctrl+C to stop)"
Start-Job { Start-Sleep 4; Start-Process "http://localhost:8080" } | Out-Null
npm start --silent
