import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { MEDIA, REPLAY } from '../shared/scenario.mjs';

test('the corgi demo packages its exact source scene and assets independently of WOM', async () => {
  const folder = new URL('../public/worlds/corgi/', import.meta.url);
  const provenance = JSON.parse(await readFile(new URL('provenance.json', folder)));
  const scene = JSON.parse(await readFile(new URL('scene.json', folder)));
  assert.equal(scene.world, 'mw2ofi0ta9503b69');
  assert.equal(scene.world, provenance.world);
  assert.deepEqual(scene.objects.map((object) => object.id), ['corgi-dog', 'red-vintage-bicycle', 'wooden-garden-bench', 'potted-lemon-tree']);
  for (const asset of provenance.assets) {
    const bytes = await readFile(new URL(asset.file, folder));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `Exact saved asset: ${asset.file}`);
  }
  for (const url of Object.values(MEDIA)) {
    assert.ok(url.startsWith('/worlds/corgi/'), 'Every page image uses the corgi world');
    assert.ok((await readFile(new URL(`../public${url}`, import.meta.url))).length > 10000);
  }
  for (const item of REPLAY.filter((step) => step.artifact?.kind === 'world')) {
    assert.equal(item.artifact.url, '/worlds/corgi/scene.json');
    assert.equal(item.artifact.viewer, 'splat');
  }
});
