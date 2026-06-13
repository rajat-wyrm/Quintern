# Full E2E integration test runner. Hits every API endpoint with proper
# auth + CSRF tokens. Use from the repo root:
#
#   pwsh scripts/full-test.ps1
#
# This is a thin shell around the backend's jest integration suite. Run
# `npm test` from `backend/` for the canonical test pass; this script
# just exposes the same suite to the PowerShell workflow used by CI.

$ErrorActionPreference = "Stop"
Set-Location -Path (Join-Path $PSScriptRoot "..\backend")
npm test
