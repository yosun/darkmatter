// Scan Git's actual index, plus reachable history, without printing matched data.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

const git = (...args) => execFileSync('git', args, { maxBuffer: 128 * 1024 * 1024 });
const known = [];
for (const file of ['.env', '.env.local']) {
  try { for (const [key, value] of Object.entries(parseEnv(await readFile(file, 'utf8')))) {
    if (/KEY|TOKEN|SECRET|PASSWORD|_API$/.test(key) && value.length >= 8) known.push(Buffer.from(value));
  } } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const patterns = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\bgh[pousr]_[A-Za-z0-9]{24,}/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/,
  /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const seen = new Set(), findings = [];
function scan(sha, file) {
  if (seen.has(sha)) return; seen.add(sha);
  if (/^(?:\.env(?:\..+)?|.*\/(?:\.env(?:\..+)?|credentials\.json|.*\.pem))$/.test(file) && !file.endsWith('.env.example')) findings.push({ file, issue: 'Credential file tracked by Git' });
  const bytes = git('cat-file', 'blob', sha);
  if (known.some((secret) => bytes.includes(secret))) findings.push({ file, issue: 'Matches a locally configured credential' });
  if (!bytes.subarray(0, 8000).includes(0)) {
    const text = bytes.toString('utf8');
    if (patterns.some((pattern) => pattern.test(text))) findings.push({ file, issue: 'Credential-shaped value' });
  }
}
const entries = git('ls-files', '--stage', '-z').toString('utf8').split('\0').filter(Boolean);
for (const entry of entries) {
  const [metadata, file] = entry.split('\t'); const [, sha, stage] = metadata.split(' ');
  if (stage !== '0') throw new Error('Resolve the Git index conflict before scanning.');
  scan(sha, file);
}
if (process.argv.includes('--history')) {
  for (const row of git('rev-list', '--objects', '--all').toString('utf8').split('\n').filter(Boolean)) {
    const [sha, ...rest] = row.split(' '); const file = rest.join(' ');
    if (!file || seen.has(sha) || git('cat-file', '-t', sha).toString().trim() !== 'blob') continue;
    scan(sha, file);
  }
}
if (findings.length) { console.error(JSON.stringify(findings, null, 2)); process.exitCode = 1; }
else console.log(`Secret check passed: ${seen.size} Git blobs; index${process.argv.includes('--history') ? ' and reachable history' : ''}. No credential values printed.`);
