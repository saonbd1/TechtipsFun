# Remove stale optimizer temp files that cause EPERM rename locks, then build.
Get-ChildItem 'public' -Filter '*.optimized' -File -ErrorAction SilentlyContinue |
	Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem 'dist' -Recurse -Include '*.map' -File -ErrorAction SilentlyContinue |
	Out-Null
Write-Output 'starting astro build...'
& npx astro build
if ($LASTEXITCODE -ne 0) { Write-Error "astro build failed with exit $LASTEXITCODE" }
