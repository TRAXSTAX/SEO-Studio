import fs from 'fs';

const appJs = fs.readFileSync('./public/app.js', 'utf8');
const indexHtml = fs.readFileSync('./public/index.html', 'utf8');

// Extract all getElementById calls
const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const ids = new Set();

while ((match = idRegex.exec(appJs)) !== null) {
  ids.add(match[1]);
}

console.log(`=== AUDITING FRONTEND DOM ELEMENT IDs ===`);
console.log(`Found ${ids.size} unique IDs referenced in app.js.`);

let missing = 0;
for (const id of ids) {
  const hasId = indexHtml.includes(`id="${id}"`) || indexHtml.includes(`id='${id}'`);
  if (!hasId) {
    console.error(`✕ MISSING ID IN index.html: "${id}"`);
    missing++;
  }
}

if (missing === 0) {
  console.log(`\n========================================`);
  console.log(`DOM Audit Complete: ALL ${ids.size} IDs MATCH 100%!`);
  console.log(`========================================`);
} else {
  console.log(`\n========================================`);
  console.log(`DOM Audit Complete: ${missing} MISSING IDs DETECTED.`);
  console.log(`========================================`);
  process.exit(1);
}
