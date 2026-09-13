const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

execSync('git checkout public/index.html');

const filePath = path.join(__dirname, 'public', 'index.html');
let html = fs.readFileSync(filePath, 'utf8');

const navItemRegex = /<li[^>]*class="nav-item[^"]*"[^>]*data-target="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g;
const itemsMap = {};
let match;
while ((match = navItemRegex.exec(html)) !== null) {
  itemsMap[match[1]] = match[0];
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
      }
  }
  newNav += `      </ul>\n`;
  newNav += `    </details>\n`;
  newNav += `  </li>\n`;
}
newNav += '</ul>';

html = html.replace(/<ul class="nav-links">[\s\S]*?<\/ul>/, newNav);

const brandEndIdx = html.indexOf('</div>', html.indexOf('<div class="brand">')) + 6;
const htmlBeforeBrand = html.substring(0, brandEndIdx);
const htmlAfterBrand = html.substring(brandEndIdx);

const shortcutHtml = `\n      <div class="cmd-palette-shortcut" style="padding: 0 2rem 1rem; color: var(--text-muted); font-size: 0.85rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="document.getElementById('cmd-palette').classList.add('active'); document.getElementById('cmd-input').focus();">\n        <span>Search tools...</span>\n        <kbd style="background: rgba(255,255,255,0.1); padding: 3px 6px; border-radius: 4px; font-family: monospace; font-size: 0.75rem;">Ctrl K</kbd>\n      </div>`;

html = htmlBeforeBrand + shortcutHtml + htmlAfterBrand;

const modalStr = `  <div class="cmd-palette-backdrop" id="cmd-palette">
    <div class="cmd-palette-modal">
      <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);">
        <input type="text" id="cmd-input" placeholder="Search tools..." style="width:100%; background:transparent; border:none; color:var(--text); font-size:1.1rem; outline:none;" autocomplete="off" />
      </div>
      <div id="cmd-results" style="max-height: 400px; overflow-y: auto;">
      </div>
    </div>
  </div>\n</body>`;
html = html.replace('</body>', modalStr);

html = html.replace('</head>', '<style>details > summary::-webkit-details-marker { display: none; }</style>\n</head>');

fs.writeFileSync(filePath, html, 'utf8');
console.log('Fixed everything properly!');
