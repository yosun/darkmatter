// Browser integration check against the real WebGL viewer; no provider calls.
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const capturing = process.argv.includes('--capture');
const poses = {};
let service;
let origin = process.env.DARKMATTER_CHECK_URL;
if (!origin) {
  // Serve the production build with an isolated replay service. Never read .env.
  const env = { ...process.env, DARKMATTER_PORT: '0' };
  for (const id of ['EBERT', 'SPIELBERG', 'LUCAS', 'BOHR']) env[`DARKMATTER_${id}_ENDPOINT`] = '';
  service = spawn(process.execPath, ['server/index.mjs'], { cwd: fileURLToPath(new URL('../', import.meta.url)), env, stdio: ['ignore', 'pipe', 'inherit'] });
  origin = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test service did not start')), 5000);
    service.stdout.on('data', (chunk) => { const match = /http:\/\/127\.0\.0\.1:\d+/.exec(String(chunk)); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    service.once('error', reject);
  });
}
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1, hasTouch: true });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error' && !(capturing && message.text().includes('404'))) errors.push(message.text()); });
try {
  await page.goto(`${origin.replace(/\/$/, '')}/#system`);
  await page.getByRole('button', { name: '↗ Explore Corgaroo in 3D', exact: true }).click();
  const stage = page.locator('.wv-stage');
  await page.waitForFunction(() => document.querySelector('.wv-stage')?.getAttribute('data-ready') === 'true', undefined, { timeout: 90000 });
  await stage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  const initial = await stage.getAttribute('data-position');
  assert.equal(initial, '0,0,0');
  assert.equal(await stage.getAttribute('data-quaternion'), '0,0,0,1');
  assert.match(await stage.getAttribute('data-layers'), /corgi-dog/);
  if (capturing) await mkdir('public/worlds/corgi/frames', { recursive: true });
  await mkdir('.scratch/qa', { recursive: true });
  const capture = async (id, label) => {
    await page.getByRole('button', { name: label, exact: true }).click();
    if (id === 'corgi') await page.getByRole('button', { name: 'Isolate Corgaroo', exact: true }).click();
    await page.waitForTimeout(900);
    const bytes = await stage.screenshot({ type: 'jpeg', quality: 92 });
    const colors = await page.evaluate(async (bytes) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }));
      const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
      const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0, 80, 60); bitmap.close();
      const pixels = context.getImageData(0, 0, 80, 60).data;
      const colors = new Set();
      for (let i = 0; i < pixels.length; i += 4) colors.add(`${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4}`);
      return colors.size;
    }, [...bytes]);
    assert.ok(colors > 24, `The ${id} camera renders textured geometry (${colors} sampled colors)`);
    if (capturing) {
      await writeFile(`public/worlds/corgi/frames/${id}.jpg`, bytes);
      poses[id] = await stage.evaluate((node) => ({ position: node.dataset.position.split(',').map(Number), quaternion: node.dataset.quaternion.split(',').map(Number), target: node.dataset.target.split(',').map(Number), layers: node.dataset.layers.split(',') }));
    }
  };
  await capture('source', 'Original camera');
  await capture('corgi', 'Meet Corgaroo');
  await capture('orbit120', 'Orbit 120°');
  assert.equal(await stage.getAttribute('data-layers'), 'corgi-dog');
  await capture('orbit180', 'Orbit 180°');
  if (capturing) await writeFile('public/worlds/corgi/frames/cameras.json', JSON.stringify({ world: await stage.getAttribute('data-world'), capturedFrom: 'DARKMATTER native 3D viewer', poses }, null, 2));
  await page.getByRole('button', { name: 'Original camera', exact: true }).click();
  await page.getByRole('button', { name: 'Photo overlay', exact: true }).click();
  assert.equal(await page.locator('.wv-overlay').isVisible(), true);
  const canvas = page.locator('.wv-stage canvas');
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height * .55, { steps: 12 }); await page.mouse.up();
  const dragged = await stage.getAttribute('data-position');
  assert.notEqual(dragged, initial, 'Dragging changes the actual camera');
  assert.equal(await page.locator('.wv-overlay').isVisible(), false, 'Manual movement hides the reference overlay');
  assert.equal(await page.getByRole('button', { name: 'Manual camera', exact: true }).getAttribute('aria-pressed'), 'false');
  await page.mouse.wheel(0, -150);
  await page.waitForTimeout(250);
  assert.notEqual(await stage.getAttribute('data-position'), dragged, 'Wheel input zooms the camera');
  await page.getByRole('button', { name: 'Original camera', exact: true }).click();
  assert.equal(await stage.getAttribute('data-position'), initial);
  assert.equal(await stage.getAttribute('data-quaternion'), '0,0,0,1');
  await page.setViewportSize({ width: 1100, height: 900 });
  assert.equal(await stage.getAttribute('data-position'), initial, 'Resizing preserves camera pose');
  await page.getByRole('button', { name: 'Use this angle → Spielberg', exact: true }).click();
  assert.match(await page.locator('.mc-artifact-strip').innerText(), /Your camera → Spielberg/);
  const downloads = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.getByRole('button', { name: '↓ Save shot + camera', exact: true }).click();
  await page.waitForTimeout(500);
  assert.deepEqual(downloads.sort(), ['darkmatter-camera.json', 'darkmatter-corgaroo-shot.png']);
  await page.locator('.mc-workspace').screenshot({ path: '.scratch/qa/corgi-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No mobile horizontal overflow');
  await page.locator('.mc-artifact').screenshot({ path: '.scratch/qa/corgi-mobile.png' });
  await canvas.scrollIntoViewIfNeeded();
  const mobile = await canvas.boundingBox();
  const beforeTouch = await stage.getAttribute('data-position');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mobile.x + mobile.width * .4, y: mobile.y + mobile.height * .5 }] });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mobile.x + mobile.width * (.4 + i * .03), y: mobile.y + mobile.height * .5 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notEqual(await stage.getAttribute('data-position'), beforeTouch, 'Touch drag rotates the native scene on mobile');
  await cdp.detach();
  // A second page checks the full handoff circle and automatic camera presets.
  if (!capturing) {
  const replay = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  replay.on('pageerror', (error) => errors.push(error.message));
  await replay.goto(`${origin.replace(/\/$/, '')}/#system`);
  const created = replay.waitForResponse((response) => response.url().endsWith('/api/runs') && response.request().method() === 'POST');
  await replay.getByRole('button', { name: '▶ Run recorded collaboration', exact: true }).click();
  assert.equal((await created).status(), 202, 'The browser can start a replay from the same origin');
  await replay.waitForFunction(() => document.querySelector('.mc-status')?.textContent?.includes('Run complete'), undefined, { timeout: 60000 });
  assert.equal(await replay.locator('.mc-artifact-thumb').count(), 8);
  assert.equal(await replay.locator('.mc-counters > div:nth-child(2) strong').innerText(), '6');
  assert.equal(await replay.locator('.mc-counters > div:nth-child(3) strong').innerText(), '2');
  await replay.waitForFunction(() => document.querySelector('.wv-stage')?.getAttribute('data-preset') === 'corgi');
  assert.equal(await replay.locator('.wv-stage').getAttribute('data-world'), 'mw2ofi0ta9503b69');
  await replay.locator('.mc-workspace').screenshot({ path: '.scratch/qa/corgi-collaboration.png' });
  await replay.getByRole('button', { name: '▶ Run recorded collaboration', exact: true }).click();
  const replayCanvas = replay.locator('.wv-stage canvas'); await replayCanvas.scrollIntoViewIfNeeded();
  const replayBounds = await replayCanvas.boundingBox();
  await replay.mouse.move(replayBounds.x + replayBounds.width * .5, replayBounds.y + replayBounds.height * .5);
  await replay.mouse.down(); await replay.mouse.move(replayBounds.x + replayBounds.width * .7, replayBounds.y + replayBounds.height * .5, { steps: 8 }); await replay.mouse.up();
  const manualPose = await replay.locator('.wv-stage').getAttribute('data-position');
  await replay.waitForFunction(() => document.querySelector('.mc-status')?.textContent?.includes('Run complete'), undefined, { timeout: 60000 });
  assert.equal(await replay.locator('.wv-stage').getAttribute('data-position'), manualPose, 'Agent handoffs never hijack a manual camera');
  await replay.close();
  }
  assert.deepEqual(errors, []);
  await writeFile('.scratch/qa/corgi-result.json', JSON.stringify({ world: await stage.getAttribute('data-world'), initial, dragged, downloads, errors, checked: ['render', 'drag', 'zoom', 'reset', 'resize', 'isolate', 'overlay', 'camera brief', 'downloads', 'mobile'] }, null, 2));
  console.log('Corgi WebGL viewer passed: render, drag, zoom, reset, resize, isolation, overlay, camera brief, downloads and mobile layout.');
} finally { await browser.close(); if (service) { service.kill('SIGTERM'); if (service.exitCode === null) await once(service, 'exit'); } }
