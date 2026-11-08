// Explicit, billed live check. This is never part of npm test or deployment checks.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
if (!process.argv.includes('--live')) throw new Error('Pass --live to authorize actual Agentverse calls.');
const origin = process.env.DARKMATTER_CHECK_URL || 'http://127.0.0.1:5173';
const config = await fetch(origin + '/api/config').then((response) => response.json());
const native = config.agents.filter((agent) => agent.configured && agent.transport === 'agentverse');
assert.ok(native.length, 'The service has at least one configured native agent');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = []; page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(origin + '/?mode=live#system');
  const start = page.locator('.mc-start'); await start.waitFor();
  await page.waitForFunction(() => !document.querySelector('.mc-start')?.disabled);
  assert.match(await start.innerText(), /(?:Run|Unlock) live/);
  assert.equal(await page.getByRole('textbox', { name: 'Video URL for Ebert' }).isVisible(), true);
  const created = page.waitForResponse((response) => response.url().endsWith('/api/runs') && response.request().method() === 'POST');
  await start.click();
  if (config.liveAccessRequired) {
    assert.ok(process.env.DARKMATTER_LIVE_ACCESS_FILE, 'Set DARKMATTER_LIVE_ACCESS_FILE to the private demo access file');
    await page.getByLabel('Live demo access key', { exact: true }).fill((await readFile(process.env.DARKMATTER_LIVE_ACCESS_FILE, 'utf8')).trim());
    await page.getByRole('button', { name: 'Unlock and run', exact: true }).click();
  }
  assert.equal((await created).status(), 202);
  await page.waitForFunction(() => document.querySelector('.mc-status')?.textContent?.startsWith('Live run finished'), undefined, { timeout: 360000 });
  await mkdir('.scratch/qa', { recursive: true });
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '↓ Export trace', exact: true }).click();
  await (await download).saveAs('.scratch/qa/live-trace.json');
  const trace = JSON.parse(await readFile('.scratch/qa/live-trace.json', 'utf8'));
  const replies = trace.events.filter((event) => event.type === 'artifact.created' && event.artifact.provenance?.transport === 'agentverse');
  for (const agent of native) assert.ok(replies.some((event) => event.agent === agent.id && event.artifact.provenance.address === agent.address), `${agent.name} returned an attributed live reply`);
  assert.equal(await page.locator('.mc-verified').count(), native.length);
  for (const agent of config.agents.filter((agent) => !agent.configured)) assert.match(await page.locator(`[data-agent='${agent.id}'] .mc-agent-state`).innerText(), /Not configured/);
  assert.equal(trace.mode, 'live'); assert.deepEqual(errors, []);
  await page.locator('.mc-workspace').screenshot({ path: '.scratch/qa/live-agents.png' });
  await writeFile('.scratch/qa/live-result.json', JSON.stringify({ origin, checkedAt: new Date().toISOString(), runId: trace.runId,
    agents: replies.map((event) => ({ agent: event.agent, address: event.artifact.provenance.address, artifact: event.artifact.id })),
    missingAgents: config.agents.filter((agent) => !agent.configured).map((agent) => agent.id), errors }, null, 2));
  console.log(`Run live passed: ${replies.map((event) => event.agent).join(', ')} returned actual Agentverse replies. Evidence is in .scratch/qa/.`);
} finally { await browser.close(); }
