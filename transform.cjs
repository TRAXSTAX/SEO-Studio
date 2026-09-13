const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'index.html');
let html = fs.readFileSync(filePath, 'utf8');

// Regex to extract .nav-item
const navItemRegex = /<li class="nav-item"(.*?)data-target="([^"]+)"(.*?)>([\s\S]*?)<\/li>/g;
const itemsMap = {};
let match;
while ((match = navItemRegex.exec(html)) !== null) {
  itemsMap[match[2]] = match[0];
}

const groups = [
  {
      title: '📊 Search Analytics & Intent',
      targets: ['gsc-analyzer', 'intent-mapper', 'cannibalization-checker']
  },
  {
      title: '🔍 Keyword Engineering',
      targets: ['keyword-discovery', 'keyword-clustering', 'rank-tracker']
  },
  {
      title: '⚡ Technical & Infrastructure',
      targets: ['master-audit', 'web-vitals', 'site-crawler', 'bulk-status', 'heading-analyzer']
  },
  {
      title: '🔗 Indexing & Architecture',
      targets: ['sitemap-tool', 'robots-analyzer', 'link-finder', 'broken-links']
  },
  {
      title: '📝 Content & Structured Data',
      targets: ['content-grader', 'meta-optimizer', 'schema-generator', 'schema-validator', 'duplicate-detector', 'log-analyzer', 'history-trends', 'serp-previewer']
  }
];

let newNav = '<ul class="nav-links">\n';
for (const g of groups) {
  newNav += `  <li class="nav-category">\n`;
  newNav += `    <details open>\n`;
  newNav += `      <summary class="nav-section-title" style="cursor:pointer; list-style:none; outline:none;">\n`;
  newNav += `        <span>${g.title}</span>\n`;
  newNav += `        <span class="badge" style="margin-left:auto">${g.targets.length}</span>\n`;
  newNav += `      </summary>\n`;
  newNav += `      <ul style="list-style:none; padding:0;">\n`;
  for (const target of g.targets) {
      if (itemsMap[target]) {
          newNav += '        ' + itemsMap[target] + '\n';
      } else {
          console.log(`Missing target: ${target}`);
      }
  }
  newNav += `      </ul>\n`;
  newNav += `    </details>\n`;
  newNav += `  </li>\n`;
}
newNav += '</ul>';

// Replace nav-links block
html = html.replace(/<ul class="nav-links">[\s\S]*?<\/ul>/, newNav);

// Add cmd-palette-shortcut
const shortcutStr = `      <div class="brand">
        <div class="logo-icon"></div>
        <h2>Enterprise SEO</h2>
      </div>
      <div class="cmd-palette-shortcut" style="padding: 0 2rem 1rem; color: var(--text-muted); font-size: 0.85rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="document.getElementById('cmd-palette').classList.add('active'); document.getElementById('cmd-input').focus();">
        <span>Search tools...</span>
        <kbd style="background: rgba(255,255,255,0.1); padding: 3px 6px; border-radius: 4px; font-family: monospace; font-size: 0.75rem;">Ctrl K</kbd>
      </div>`;
html = html.replace(/<div class="brand">[\s\S]*?<\/div>/, shortcutStr);

// Add modal
const modalStr = `  <div class="cmd-palette-backdrop" id="cmd-palette">
    <div class="cmd-palette-modal">
      <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);">
        <input type="text" id="cmd-input" placeholder="Search tools..." style="width:100%; background:transparent; border:none; color:var(--text); font-size:1.1rem; outline:none;" autocomplete="off" />
      </div>
      <div id="cmd-results" style="max-height: 400px; overflow-y: auto;">
      </div>
    </div>
  </div>
</body>`;
html = html.replace('</body>', modalStr);

const styleInjection = '<style>details > summary::-webkit-details-marker { display: none; }</style>\n</head>';
html = html.replace('</head>', styleInjection);

fs.writeFileSync(filePath, html, 'utf8');
console.log('Done!');
