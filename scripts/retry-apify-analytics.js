/**
 * Script to retry storing analytics from a specific Apify run ID
 * 
 * Usage:
 *   node scripts/retry-apify-analytics.js <runId> [username] [startDate] [endDate]
 * 
 * Example:
 *   node scripts/retry-apify-analytics.js hv2W0bikTzwMTGQpX
 *   node scripts/retry-apify-analytics.js hv2W0bikTzwMTGQpX myusername 2025-08-01 2026-01-08
 */

const runId = process.argv[2];
const username = process.argv[3];
const startDate = process.argv[4] || '2025-08-01';
const endDate = process.argv[5] || '2026-01-08';

if (!runId) {
  console.error('❌ Error: Run ID is required');
  console.log('\nUsage: node scripts/retry-apify-analytics.js <runId> [username] [startDate] [endDate]');
  console.log('\nExample:');
  console.log('  node scripts/retry-apify-analytics.js hv2W0bikTzwMTGQpX');
  process.exit(1);
}

console.log('🔄 Retrying analytics store from Apify run...');
console.log(`   Run ID: ${runId}`);
if (username) {
  console.log(`   Username: ${username}`);
}
console.log(`   Date range: ${startDate} to ${endDate}`);
console.log('\n⚠️  Note: This script requires the API to be running.');
console.log('   You can also call the API directly from your browser console:\n');
console.log(`   fetch('/api/analytics/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    retryFromRunId: '${runId}',
    ${username ? `username: '${username}',` : '// username will be retrieved from stored settings'}
    startDate: '${startDate}',
    endDate: '${endDate}'
  })
})
.then(r => r.json())
.then(console.log);\n`);

