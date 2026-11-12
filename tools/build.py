"""Build static public site: python3 build.py <csv_dir> <out_dir>"""
import csv, json, os, sys, glob, datetime as dt

src = os.path.dirname(os.path.abspath(__file__))
csv_dir, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)

data = {}
for p in sorted(glob.glob(os.path.join(csv_dir, '*.csv'))):
    with open(p, encoding='utf-8-sig', newline='') as f:
        r = list(csv.reader(f))
    if not r:
        continue
    cols = r[0]
    data[os.path.basename(p)[:-4]] = {'columns': cols, 'rows': [dict(zip(cols, row + [''] * (len(cols) - len(row)))) for row in r[1:]]}

body = open(os.path.join(src, 'body.html'), encoding='utf-8').read()
app = open(os.path.join(src, 'app.js'), encoding='utf-8').read()
asof = data.get('asof', {}).get('rows', [{}])[0].get('기준일', '')
built = (dt.datetime.utcnow() + dt.timedelta(hours=9)).strftime('%Y-%m-%d %H:%M')

head = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LS증권 채권운용 · {asof}</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
:root {{
  --font-anthropic-sans: Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  --font-anthropic-serif: Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', serif;
  --color-bg: #f7f7f5; --color-fg: #1f1f1d; --color-fg-muted: #6b6b66; --color-panel: #ffffff; --color-border-line: #e3e2de;
  --cds-gap-xs: 4px; --cds-gap-sm: 8px; --cds-gap-md: 14px; --cds-gap-lg: 20px; --cds-gap-xl: 32px;
  --cds-pad-xs: 4px; --cds-pad-md: 12px; --cds-pad-lg: 16px; --cds-radius: 8px;
  --cds-font-size-title: 26px; --cds-font-size-heading: 17px; --cds-font-size-body: 14px; --cds-font-size-caption: 12px; --cds-font-weight-medium: 600;
  --cds-text-secondary: #6b6b66; --cds-chart-grid: #ecebe7; --cds-chart-axis: #c9c8c3; --cds-chart-reference: #9a9993;
  --cds-surface-popover: #ffffff; --cds-border: #e3e2de; --cds-shadow-popover: 0 4px 14px rgba(0,0,0,.08);
}}
@media (prefers-color-scheme: dark) {{
  :root {{ --color-bg: #1c1c1a; --color-fg: #ecebe6; --color-fg-muted: #a09f99; --color-panel: #262624; --color-border-line: #3a3936;
    --cds-text-secondary: #a09f99; --cds-chart-grid: #33322f; --cds-chart-axis: #4a4945; --cds-chart-reference: #7a7974;
    --cds-surface-popover: #2c2c2a; --cds-border: #3a3936; }}
}}
html {{ background: var(--color-bg); }}
body {{ margin: 0; padding: 28px 20px 48px; max-width: 1280px; margin-inline: auto; }}
</style>
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
</head>
<body>
"""
html = (head + body
        + f'\n<p style="font:12px var(--font-anthropic-sans);color:var(--color-fg-muted);margin-top:24px">페이지 생성 {built} KST</p>\n'
        + '<script>window.DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';</script>\n'
        + '<script>\n' + app + '\n</script>\n</body>\n</html>\n')
open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(html)
open(os.path.join(out_dir, '.nojekyll'), 'w').close()
print('ok', asof, len(html), 'bytes', len(data), 'datasets')
