import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS, STEPS, REPLAY } from '../shared/scenario.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const port = Number(process.env.DARKMATTER_PORT || 8788);
const host = process.env.DARKMATTER_HOST || '127.0.0.1';
const publicOrigin = process.env.DARKMATTER_PUBLIC_ORIGIN || '';
const runs = new Map();
const connections = () => AGENTS.map((agent) => {
  const prefix = `DARKMATTER_${agent.id.toUpperCase()}`;
  const endpoint = process.env[`${prefix}_ENDPOINT`] || '';
  let nativeAgentverse = false;
  try { const url = new URL(endpoint); nativeAgentverse = url.hostname === 'agents.ai3d.dev' && /^\/(?:ebert|agentverse)(?:\/|$)/.test(url.pathname); } catch { /* Missing configuration stays unavailable. */ }
  const transport = nativeAgentverse || process.env[`${prefix}_TRANSPORT`] === 'agentverse' ? 'agentverse' : 'adapter';
  return { ...agent, address: process.env[`${prefix}_AGENT_ADDRESS`] || '', endpointConfigured: Boolean(endpoint), transport,
    configured: Boolean(endpoint) && transport === 'adapter' };
});
const json = (response, status, body) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); };
const emit = (run, type, data = {}) => {
  const event = { id: run.events.length + 1, at: new Date().toISOString(), runId: run.id, type, ...data };
  run.events.push(event);
  for (const response of run.clients) response.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
  return event;
};
const wait = (ms, signal) => new Promise((resolve, reject) => {
  const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
  signal.addEventListener('abort', onAbort, { once: true });
});
const readBody = async (request) => {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 64 * 1024) throw new Error('Request body exceeds 64 KB.');
  }
  return JSON.parse(body || '{}');
};

function safeCamera(raw) {
  const vector = (value, size) => Array.isArray(value) && value.length === size && value.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e6);
  if (!raw || !vector(raw.position, 3) || !vector(raw.quaternion, 4) || !vector(raw.target, 3) || !vector(raw.up, 3)
    || Math.hypot(...raw.quaternion) < .001 || Math.hypot(...raw.up) < .001
    || Math.hypot(...raw.position.map((n, i) => n - raw.target[i])) < .001
    || !(typeof raw.fovY === 'number' && raw.fovY >= 1 && raw.fovY <= 175)
    || !(typeof raw.aspect === 'number' && raw.aspect >= .1 && raw.aspect <= 10)) throw new Error('Invalid world camera pose.');
  return { position: raw.position, quaternion: raw.quaternion, target: raw.target, up: raw.up, fovY: raw.fovY, aspect: raw.aspect,
    ...(Array.isArray(raw.layers) ? { layers: raw.layers.slice(0, 32).filter((id) => typeof id === 'string' && /^[a-z0-9_-]{1,100}$/i.test(id)) } : {}) };
}

function safeArtifact(raw, fallbackId) {
  if (!raw || !['image', 'video', 'world', 'report'].includes(raw.kind)) return null;
  const artifact = { id: String(raw.id || fallbackId).slice(0, 100), kind: raw.kind,
    title: String(raw.title || 'Agent artifact').slice(0, 200), caption: String(raw.caption || '').slice(0, 1000) };
  if (raw.kind === 'report') artifact.text = String(raw.text || '').slice(0, 8000);
  else {
    const url = String(raw.url || '');
    if (!(url.startsWith('/') && !url.startsWith('//') && !/[\\\u0000-\u001f]/.test(url)) && !/^https:\/\//.test(url)) throw new Error('Artifact URL must use HTTPS or a local absolute path.');
    artifact.url = url;
    if (raw.poster) artifact.poster = String(raw.poster).slice(0, 4096);
    if (raw.kind === 'world' && raw.viewer === 'splat') {
      artifact.viewer = 'splat';
      if (typeof raw.preset === 'string' && /^[a-z0-9_-]{1,60}$/i.test(raw.preset)) artifact.preset = raw.preset;
      if (raw.camera) artifact.camera = safeCamera(raw.camera);
    }
  }
  return artifact;
}

async function invoke(run, step, index) {
  const endpoint = process.env[`DARKMATTER_${step.agent.toUpperCase()}_ENDPOINT`];
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.DARKMATTER_AGENT_TOKEN) headers.Authorization = `Bearer ${process.env.DARKMATTER_AGENT_TOKEN}`;
  const response = await fetch(endpoint, { method: 'POST', headers,
    signal: AbortSignal.any([run.controller.signal, AbortSignal.timeout(180000)]),
    body: JSON.stringify({ runId: run.id, step: index + 1, agent: step.agent, brief: run.brief,
      instruction: step.instruction, context: { artifacts: run.artifacts, findings: run.findings, messages: run.messages } }),
  });
  if (!response.ok) throw new Error(`${step.agent} endpoint returned HTTP ${response.status}.`);
  const raw = await response.text();
  if (raw.length > 128 * 1024) throw new Error(`${step.agent} response exceeds 128 KB.`);
  const result = JSON.parse(raw);
  if (typeof result.message !== 'string' || !result.message.trim()) throw new Error(`${step.agent} must return a message.`);
  const findings = Array.isArray(result.findings) ? result.findings.slice(0, 20) : result.finding ? [result.finding] : [];
  return { message: result.message.slice(0, 6000), artifact: safeArtifact(result.artifact, `step-${index + 1}`),
    findings: findings.map((finding) => ({ title: String(finding.title || 'Finding').slice(0, 200), detail: String(finding.detail || '').slice(0, 2000) })) };
}

async function execute(run) {
  emit(run, 'run.started', { mode: run.mode, brief: run.brief, scope: run.scope });
  try {
    const selected = run.scope ? STEPS.map((step, i) => ({ step, i })).filter(({ step }) => step.agent === run.scope).slice(0, 1)
      : STEPS.map((step, i) => ({ step, i }));
    for (let n = 0; n < selected.length; n++) {
      const { step, i } = selected[n];
      run.controller.signal.throwIfAborted();
      emit(run, 'agent.started', { agent: step.agent, step: i + 1, title: step.title });
      let result;
      if (run.mode === 'replay') { await wait(1800, run.controller.signal); result = REPLAY[i]; }
      else result = await invoke(run, step, i);
      run.controller.signal.throwIfAborted();
      const message = { agent: step.agent, to: run.scope ? null : step.to, text: result.message, step: i + 1 };
      run.messages.push(message);
      emit(run, 'message', message);
      for (const finding of result.findings || (result.finding ? [result.finding] : [])) {
        run.findings.push(finding); emit(run, 'finding.recorded', { agent: step.agent, ...finding });
      }
      if (result.artifact) {
        const artifactId = run.artifacts.some((prior) => prior.id === result.artifact.id) ? `${result.artifact.id}-${run.artifacts.length + 1}` : result.artifact.id;
        const artifact = { ...result.artifact, id: artifactId, agent: step.agent, step: i + 1 };
        run.artifacts.push(artifact);
        emit(run, 'artifact.created', { agent: step.agent, artifact });
      }
      emit(run, 'agent.completed', { agent: step.agent, step: i + 1 });
      if (run.mode === 'replay') await wait(700, run.controller.signal);
    }
    run.status = 'completed';
    emit(run, 'run.completed', { artifacts: run.artifacts.length, findings: run.findings.length });
  } catch (error) {
    run.status = run.controller.signal.aborted ? 'cancelled' : 'failed';
    emit(run, `run.${run.status}`, { message: run.status === 'cancelled' ? 'Run stopped. Existing artifacts remain available.' : String(error.message || 'Agent execution failed.') });
  }
}

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.json': 'application/json', '.spz': 'application/octet-stream' };
const server = createServer(async (request, response) => {
  try {
    const listeningPort = server.address().port;
    const url = new URL(request.url, `http://127.0.0.1:${listeningPort}`);
    if (request.method === 'POST') {
      const origin = request.headers.origin;
      if (origin && ![publicOrigin, `http://127.0.0.1:${listeningPort}`, `http://localhost:${listeningPort}`, 'http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173'].includes(origin)) return json(response, 403, { error: 'Origin is not allowed.' });
    }
    if (url.pathname === '/api/config' && request.method === 'GET') return json(response, 200, { agents: connections(), liveReady: connections().every((agent) => agent.configured) });
    if (url.pathname === '/api/runs' && request.method === 'POST') {
      const body = await readBody(request);
      if (!['replay', 'live'].includes(body.mode)) return json(response, 400, { error: 'Choose replay or live.' });
      if (body.scope && !AGENTS.some((agent) => agent.id === body.scope)) return json(response, 400, { error: 'Unknown agent.' });
      const needed = connections().filter((agent) => !body.scope || agent.id === body.scope);
      if (body.mode === 'live' && needed.some((agent) => !agent.configured)) return json(response, 409, { error: needed.some((agent) => agent.endpointConfigured && agent.transport === 'agentverse')
        ? 'These Agentverse endpoints require signed messages and a reply bridge. Evaluate them with npm run eval:agents -- --live; configure app adapters before using this live runner.'
        : 'Connect the requested agent endpoints before starting live execution.' });
      if ([...runs.values()].some((run) => run.status === 'running')) return json(response, 409, { error: 'Stop the current run before starting another.' });
      for (const [id, run] of runs) if (runs.size >= 20 && run.status !== 'running' && !run.clients.size) runs.delete(id);
      const inputArtifacts = body.scope && Array.isArray(body.inputArtifacts)
        ? body.inputArtifacts.slice(-20).map((artifact, index) => safeArtifact(artifact, `input-${index + 1}`)).filter(Boolean) : [];
      const run = { id: randomUUID(), mode: body.mode, brief: String(body.brief || 'A quiet garden. Preserve the dog and bicycle while discovering a new camera angle.').slice(0, 2000), scope: body.scope || null,
        status: 'running', events: [], clients: new Set(), artifacts: inputArtifacts, findings: [], messages: [], controller: new AbortController() };
      runs.set(run.id, run);
      json(response, 202, { id: run.id, mode: run.mode });
      void execute(run);
      return;
    }
    const runInfo = /^\/api\/runs\/([a-f0-9-]+)$/.exec(url.pathname);
    if (runInfo && request.method === 'GET') {
      const run = runs.get(runInfo[1]);
      return run ? json(response, 200, { id: run.id, mode: run.mode, status: run.status, lastEventId: run.events.length })
        : json(response, 404, { error: 'Run not found.' });
    }
    const stream = /^\/api\/runs\/([a-f0-9-]+)\/events$/.exec(url.pathname);
    if (stream && request.method === 'GET') {
      const run = runs.get(stream[1]);
      if (!run) return json(response, 404, { error: 'Run not found.' });
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      response.write(': connected\n\n');
      const lastId = Number(request.headers['last-event-id'] || 0);
      for (const event of run.events) if (event.id > lastId) response.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
      run.clients.add(response);
      const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15000);
      request.on('close', () => { clearInterval(heartbeat); run.clients.delete(response); });
      return;
    }
    const stop = /^\/api\/runs\/([a-f0-9-]+)\/cancel$/.exec(url.pathname);
    if (stop && request.method === 'POST') {
      const run = runs.get(stop[1]);
      if (!run) return json(response, 404, { error: 'Run not found.' });
      run.controller.abort(new Error('Stopped by the user.'));
      return json(response, 200, { ok: true });
    }
    if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Endpoint not found.' });
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Method not allowed.' });
    const filename = path.resolve(dist, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    if (!filename.startsWith(dist + path.sep) || !existsSync(filename) || !(await stat(filename)).isFile()) return json(response, 404, { error: 'File not found. Use npm run dev, or build the application first.' });
    response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    if (request.method === 'HEAD') response.end(); else createReadStream(filename).pipe(response);
  } catch { if (!response.headersSent) json(response, 400, { error: 'The request could not be processed.' }); else response.end(); }
});
server.listen(port, host, () => console.log(`DARKMATTER event service: http://${host}:${server.address().port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const run of runs.values()) { run.controller.abort(new Error('Server stopped.')); for (const client of run.clients) client.end(); }
  server.close(() => process.exit(0));
});
