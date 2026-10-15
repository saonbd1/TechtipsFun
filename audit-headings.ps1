$report = @()
$files = Get-ChildItem 'src\content\blog' -Filter *.md | Sort-Object Name
foreach ($f in $files) {
	$lines = Get-Content $f.FullName
	$inFence = $false
	$inFm = $false
	$fmCount = 0
	$levels = @()
	$h1s = @()
	$empties = 0
	$lineNo = 0
	foreach ($ln in $lines) {
		$lineNo++
		if ($lineNo -eq 1 -and $ln.Trim() -eq '---') { $inFm = $true; $fmCount++; continue }
		if ($inFm) { if ($ln.Trim() -eq '---') { $fmCount++; if ($fmCount -ge 2) { $inFm = $false } }; continue }
		$ts = $ln.TrimStart()
		if ($ts.StartsWith('```') -or $ts.StartsWith('~~~')) { $inFence = -not $inFence; continue }
		if ($inFence) { continue }
		if ($ln -match '^(#{1,6})\s+(.*?)\s*$') {
			$lvl = $matches[1].Length
			$txt = $matches[2] -replace '[`*]',''
			$levels += $lvl
			if ($lvl -eq 1) { $h1s += ('L' + $lineNo + ': ' + $txt) }
			if ([string]::IsNullOrWhiteSpace($txt)) { $empties++ }
		}
	}
	$issues = @()
	if ($h1s.Count -gt 0) { $issues += 'DUP-H1(' + $h1s.Count + ')' }
	if ($empties -gt 0) { $issues += 'EMPTY(' + $empties + ')' }
	if ($levels.Count -gt 0) {
		if ($levels[0] -gt 2) { $issues += 'STARTS-H' + $levels[0] }
		for ($i = 1; $i -lt $levels.Count; $i++) {
			if ($levels[$i] -gt $levels[$i-1] + 1) { $issues += 'SKIP-H' + $levels[$i-1] + '-H' + $levels[$i] + '@#' + ($i+1) }
		}
	}
	$report += [pscustomobject]@{
		File = $f.BaseName
		Seq = ($levels -join ',')
		H1s = ($h1s -join ' | ')
		Issues = ($issues -join ' ')
	}
}
$report | Export-Csv '.heading-audit.csv' -NoTypeInformation
Write-Output '===== POSTS WITH ISSUES ====='
$bad = $report | Where-Object { $_.Issues }
$bad | Format-Table File, Issues, H1s -AutoSize -Wrap | Out-String -Width 220
Write-Output ('Total posts: ' + $report.Count + '; with issues: ' + $bad.Count)
