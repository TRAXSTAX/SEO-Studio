import re
from bs4 import BeautifulSoup

def main():
    file_path = 'C:\\Users\\PC\\.gemini\\antigravity\\scratch\\seo-studio\\public\\index.html'
    with open(file_path, 'r', encoding='utf-8') as f:
        html = f.read()

    soup = BeautifulSoup(html, 'html.parser')

    nav_items = soup.select('.nav-links .nav-item')

    items_map = {}
    for item in nav_items:
        items_map[item['data-target']] = str(item)

    groups = [
        {
            'title': '📊 Search Analytics & Intent',
            'targets': ['gsc-analyzer', 'intent-mapper', 'cannibalization-checker']
        },
        {
            'title': '🔍 Keyword Engineering',
            'targets': ['keyword-discovery', 'keyword-clustering', 'rank-tracker']
        },
        {
            'title': '⚡ Technical & Infrastructure',
            'targets': ['master-audit', 'web-vitals', 'site-crawler', 'bulk-status', 'heading-analyzer']
        },
        {
            'title': '🔗 Indexing & Architecture',
            'targets': ['sitemap-tool', 'robots-analyzer', 'link-finder', 'broken-links']
        },
        {
            'title': '📝 Content & Structured Data',
            'targets': ['content-grader', 'meta-optimizer', 'schema-generator', 'schema-validator', 'duplicate-detector', 'log-analyzer', 'history-trends', 'serp-previewer']
        }
    ]

    new_nav = '<ul class="nav-links">\n'
    for g in groups:
        count = len(g['targets'])
        new_nav += f'  <li class="nav-category">\n'
        new_nav += f'    <details open>\n'
        new_nav += f'      <summary class="nav-section-title" style="cursor:pointer; list-style:none; outline:none;">\n'
        new_nav += f'        <span>{g["title"]}</span>\n'
        new_nav += f'        <span class="badge" style="margin-left:auto">{count}</span>\n'
        new_nav += f'      </summary>\n'
        new_nav += f'      <ul style="list-style:none; padding:0;">\n'
        for target in g['targets']:
            if target in items_map:
                new_nav += '        ' + items_map[target] + '\n'
            else:
                print(f'Missing target: {target}')
        new_nav += f'      </ul>\n'
        new_nav += f'    </details>\n'
        new_nav += f'  </li>\n'
    new_nav += '</ul>'

    # Regex replace old nav-links
    html = re.sub(r'<ul class="nav-links">.*?</ul>', new_nav, html, flags=re.DOTALL)

    # Add cmd-palette-shortcut
    shortcut_str = '''      <div class="brand">
        <div class="logo-icon"></div>
        <h2>Enterprise SEO</h2>
      </div>
      <div class="cmd-palette-shortcut" style="padding: 0 2rem 1rem; color: var(--text-muted); font-size: 0.85rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="document.getElementById('cmd-palette').classList.add('active'); document.getElementById('cmd-input').focus();">
        <span>Search tools...</span>
        <kbd style="background: rgba(255,255,255,0.1); padding: 3px 6px; border-radius: 4px; font-family: monospace; font-size: 0.75rem;">Ctrl K</kbd>
      </div>'''
    html = re.sub(r'<div class="brand">.*?</div>', shortcut_str, html, flags=re.DOTALL, count=1)

    # Add modal
    modal_str = '''  <div class="cmd-palette-backdrop" id="cmd-palette">
    <div class="cmd-palette-modal">
      <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);">
        <input type="text" id="cmd-input" placeholder="Search tools..." style="width:100%; background:transparent; border:none; color:var(--text); font-size:1.1rem; outline:none;" autocomplete="off" />
      </div>
      <div id="cmd-results" style="max-height: 400px; overflow-y: auto;">
      </div>
    </div>
  </div>
</body>'''
    html = html.replace('</body>', modal_str)

    style_injection = '<style>details > summary::-webkit-details-marker { display: none; }</style>\n</head>'
    html = html.replace('</head>', style_injection)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(html)

if __name__ == '__main__':
    main()
