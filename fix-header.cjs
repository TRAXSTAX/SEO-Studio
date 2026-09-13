const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
const searchStr = `      <div class="brand">
        <div class="logo-icon"></div>
        <h2>Enterprise SEO</h2>
      </div>
      <div class="cmd-palette-shortcut" style="padding: 0 2rem 1rem; color: var(--text-muted); font-size: 0.85rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="document.getElementById('cmd-palette').classList.add('active'); document.getElementById('cmd-input').focus();">
        <span>Search tools...</span>
        <kbd style="background: rgba(255,255,255,0.1); padding: 3px 6px; border-radius: 4px; font-family: monospace; font-size: 0.75rem;">Ctrl K</kbd>
      </div>
        <h2>Enterprise SEO</h2>
      </div>`;
const replaceStr = `      <div class="brand">
        <div class="logo-icon"></div>
        <h2>Enterprise SEO</h2>
      </div>
      <div class="cmd-palette-shortcut" style="padding: 0 2rem 1rem; color: var(--text-muted); font-size: 0.85rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="document.getElementById('cmd-palette').classList.add('active'); document.getElementById('cmd-input').focus();">
        <span>Search tools...</span>
        <kbd style="background: rgba(255,255,255,0.1); padding: 3px 6px; border-radius: 4px; font-family: monospace; font-size: 0.75rem;">Ctrl K</kbd>
      </div>`;
html = html.replace(searchStr, replaceStr);
fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Fixed header duplicate!');
