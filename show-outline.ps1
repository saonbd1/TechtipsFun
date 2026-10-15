# Extract the heading outline (h1-h6) rendered in a built HTML post.
param([string]$Path)
$raw = Get-Content -Raw $Path
# Keep only the article body so TOC/Share/Author headings from the layout
# are included but the page-wide <h1> title still shows for context.
$regex = [regex]'<h([1-6])[^>]*>(.*?)</h\1>'
$out = $regex.Matches($raw) | ForEach-Object {
	$lvl = $_.Groups[1].Value
	$txt = $_.Groups[2].Value -replace '<[^>]+>','' -replace '&[a-z]+;',''
	('h' + $lvl + '  ' + $txt)
}
$out
