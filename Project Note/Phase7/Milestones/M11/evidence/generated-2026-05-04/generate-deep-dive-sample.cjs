const fs = require('node:fs');
const path = require('node:path');
const { runAnalysisPipeline } = require('C:/BOTS/Thesis/fintech/apps/dexter-worker/dist/apps/dexter-worker/src/pipeline.js');
const { loadConfig } = require('C:/BOTS/Thesis/fintech/apps/dexter-worker/dist/apps/dexter-worker/src/config.js');
const { buildEditorialPdfExport, buildEditorialReportHtml, buildEditorialReportPages } = require('C:/BOTS/Thesis/fintech/apps/product-api/dist/apps/product-api/src/report-pdf-editorial.js');

async function main() {
  const outDir = 'C:/BOTS/Thesis/fintech/Project Note/Phase7/Milestones/M11/evidence/generated-2026-05-04';
  const request = {
    request_id: 'req-m11-sample-msft',
    type: 'deep_dive',
    ticker: 'MSFT',
    job_id: 'job-m11-sample-msft',
    requested_at: '2026-05-04T12:00:00.000Z',
    options: {}
  };
  const config = loadConfig({ ...process.env, DEXTER_FIXTURE_MODE: 'true' });
  const report = await runAnalysisPipeline(request, config);
  const pages = buildEditorialReportPages(report);
  const html = buildEditorialReportHtml(report, pages);
  const pdf = buildEditorialPdfExport(report);
  fs.writeFileSync(path.join(outDir, 'deep-dive-m11-msft.html'), html, 'utf8');
  fs.writeFileSync(path.join(outDir, 'deep-dive-m11-msft.pdf'), pdf.buffer);
  fs.writeFileSync(path.join(outDir, 'deep-dive-m11-msft.report.json'), JSON.stringify({
    report_id: report.report_id,
    ticker: report.ticker,
    page_count: pdf.pageCount,
    page_titles: pdf.pageTitles,
    filing_intelligence: report.filing_intelligence
  }, null, 2), 'utf8');
  console.log(JSON.stringify({
    pdf: path.join(outDir, 'deep-dive-m11-msft.pdf'),
    html: path.join(outDir, 'deep-dive-m11-msft.html'),
    pageCount: pdf.pageCount,
    pageTitles: pdf.pageTitles
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
