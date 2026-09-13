export function generateActionPlan(report) {
  const plan = [];

  // Vitals Rules
  if (report.vitals) {
    const lcp = parseFloat(report.vitals.lcp);
    if (lcp > 2.5) {
      plan.push({
        priority: 'High',
        task: `Improve LCP (currently ${report.vitals.lcp}). Optimize hero image, defer non-critical CSS, and use a CDN.`
      });
    }
    
    const tbtStr = String(report.vitals.tbt).replace(/[^0-9]/g, '');
    const tbt = parseInt(tbtStr, 10);
    if (tbt > 200) {
      plan.push({
        priority: 'High',
        task: `Reduce Total Blocking Time (currently ${report.vitals.tbt}). Break up long JavaScript tasks and defer third-party scripts.`
      });
    }
  }

  // Content Rules
  if (report.content) {
    if (report.content.percentage < 60) {
      plan.push({
        priority: 'High',
        task: `Rewrite content to include missing semantic entities: ${report.content.missing.slice(0, 5).join(', ')}.`
      });
    }
  }

  // Technical Rules
  if (report.technical) {
    if (!report.technical.canonical) {
      plan.push({
        priority: 'Medium',
        task: 'Add a self-referencing canonical tag to prevent duplicate content issues.'
      });
    }
    if (!report.technical.jsonLd) {
      plan.push({
        priority: 'Medium',
        task: 'Implement Schema.org JSON-LD markup to enhance search appearance (e.g., Breadcrumb or Product schema).'
      });
    }
    if (report.technical.brokenLinks > 0) {
      plan.push({
        priority: 'High',
        task: `Fix ${report.technical.brokenLinks} broken links detected on the page.`
      });
    }
  }

  // Fallback
  if (plan.length === 0) {
    plan.push({
      priority: 'Low',
      task: 'Page looks technically sound. Focus on acquiring high-quality backlinks and fresh content.'
    });
  }

  return plan;
}
