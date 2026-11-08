// Freeze the existing corgi garden into this app; never alter the source world.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(process.argv[2] || '../WOM/web/corgi-garden-demo/assets');
const destination = fileURLToPath(new URL('../public/worlds/corgi/', import.meta.url));
const provenance = JSON.parse(await readFile(resolve(source, 'provenance.json'), 'utf8'));
await mkdir(destination, { recursive: true });
for (const asset of provenance.assets) {
  const bytes = await readFile(resolve(source, asset.file));
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Source changed: ${asset.file}`);
  await copyFile(resolve(source, asset.file), resolve(destination, asset.file));
}
await writeFile(resolve(destination, 'provenance.json'), JSON.stringify({ ...provenance, packagedFor: 'DARKMATTER', description: 'Unmodified saved corgi garden, source photograph, camera and layer transforms. No new generation or repair.' }, null, 2) + '\n');
console.log(`Packaged ${provenance.assets.length} verified files from corgi world ${provenance.world}.`);
