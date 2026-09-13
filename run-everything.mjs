import { runBatchAudit } from './lib/batch-processor.mjs';
import fs from 'fs';

(async () => {
  console.log('Starting deep audit on all pages...');
  try {
    const results = await runBatchAudit(
      'https://ambarstores.com/en/sitemap_pages_1.xml?from=91542880304&to=117322580016',
      'women fashion',
      (type, msg) => console.log(msg)
    );
    
    let md = '# Deep Audit Results - Ambar Stores\n\n';
    results.forEach(r => {
      md += `## ${r.url}\n`;
      if (r.status === 'Success') {
        md += `- **Score**: ${r.score}/100\n`;
      } else {
        md += `- **Status**: Failed\n- **Error**: ${r.error}\n`;
      }
      md += '\n';
    });
    
    fs.writeFileSync('C:/Users/PC/.gemini/antigravity/brain/b88fad24-1ff0-4793-adc8-44e6d25ef8ad/master_audit_results.md', md);
    console.log('Results written to artifact!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
