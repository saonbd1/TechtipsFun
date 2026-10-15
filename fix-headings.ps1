# Fix heading-hierarchy violations (exactly one H1 per page is owned by the
# layout; markdown body must start at H2 and never skip levels).

# 1) simple-tips: all 8 top-level sections are H3 -> promote to H2.
$st = 'src\content\blog\simple-tips-to-solve-your-pc-startup-and-shutdown-problems.md'
$lines = Get-Content $st
$cnt = 0
$new = $lines | ForEach-Object {
	if ($_ -match '^###\s.+') { $cnt++; $_ -replace '^###\s', '## ' } else { $_ }
}
$new | Set-Content -Path $st -Encoding utf8
Write-Output ($st + ' : promoted ' + $cnt + ' headings ### -> ##')

# 2) muse-glimmer: ONLY the misplaced opening H3 (top-level section that
#    belongs with the other H2s) -> H2. Leave the legitimately nested H3s
#    (Option 1/2/3, Is X free?, Is X safe?) as H3.
$mg = 'src\content\blog\muse-glimmer-ai-local-guide.md'
$lines = Get-Content $mg
$cnt = 0
$new = $lines | ForEach-Object {
	if ($_ -eq '### What is Muse Glimmer AI?') { $cnt++; '## What is Muse Glimmer AI?' } else { $_ }
}
$new | Set-Content -Path $mg -Encoding utf8
Write-Output ($mg + ' : promoted ' + $cnt + ' heading ### -> ## (only the misplaced top-level H3)')
