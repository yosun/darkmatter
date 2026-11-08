import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { AGENTS } from '../shared/scenario.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

async function service(endpoints = {}, settings = {}) {
  const env = { ...process.env, DARKMATTER_PORT: '0', DARKMATTER_AGENT_TOKEN: 'fixture-token', ...settings };
  for (const agent of AGENTS) env[`DARKMATTER_${agent.id.toUpperCase()}_ENDPOINT`] = endpoints[agent.id] || '';
  const child = spawn(process.execPath, ['server/index.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Event service did not start.')), 5000);
    child.stdout.on('data', (chunk) => {
      const match = /http:\/\/127\.0\.0\.1:\d+/.exec(String(chunk));
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Event service exited: ${code}`)); });
  });
  return { origin, close: async () => { child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit'); } };
}

async function collect(origin, id, onEvent = () => {}) {
  const response = await fetch(`${origin}/api/runs/${id}/events`, { signal: AbortSignal.timeout(7000) });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error('Event stream ended before a terminal event.');
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const line = frame.split('\n').find((part) => part.startsWith('data: '));
        if (!line) continue;
        const event = JSON.parse(line.slice(6));
        events.push(event);
        await onEvent(event);
        if (['run.completed', 'run.failed', 'run.cancelled'].includes(event.type)) return events;
      }
    }
  } finally { await reader.cancel(); }
}

test('live orchestration passes actual outputs between adapters and retains honest terminal states', async (t) => {
  const calls = [];
  const fixture = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body);
    calls.push({ ...payload, authorization: request.headers.authorization });
    const artifact = payload.brief === 'unsafe-artifact' && payload.step === 2
      ? { kind: 'image', url: 'javascript:alert(1)' }
      : { id: `fixture-${payload.step}`, kind: 'report', title: `${payload.agent} delivered`, text: `Prior artifacts: ${payload.context.artifacts.length}` };
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: `${payload.agent} received ${payload.context.messages.length} messages`, artifact }));
  });
  await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  t.after(async () => { fixture.closeAllConnections(); await new Promise((resolve) => fixture.close(resolve)); });
  const adapterOrigin = `http://127.0.0.1:${fixture.address().port}`;
  const live = await service(Object.fromEntries(AGENTS.map((agent) => [agent.id, `${adapterOrigin}/${agent.id}`])));
  t.after(() => live.close());
  const create = async (body) => {
    const response = await fetch(`${live.origin}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 202);
    return response.json();
  };

  await t.test('eight live calls carry every preceding message and artifact', async () => {
    const run = await create({ mode: 'live', brief: 'Fixture collaboration' });
    const events = await collect(live.origin, run.id);
    assert.equal(events.at(-1).type, 'run.completed');
    assert.equal((await fetch(`${live.origin}/api/runs/${run.id}`).then((response) => response.json())).status, 'completed');
    assert.equal(calls.length, 8);
    assert.deepEqual(calls.map((call) => call.agent), ['spielberg', 'ebert', 'spielberg', 'lucas', 'bohr', 'bohr', 'spielberg', 'ebert']);
    for (let i = 0; i < calls.length; i++) {
      assert.equal(calls[i].context.artifacts.length, i);
      assert.equal(calls[i].context.messages.length, i);
      assert.equal(calls[i].authorization, 'Bearer fixture-token');
      assert.ok(calls[i].instruction.length > 30);
      if (i) assert.equal(calls[i].context.artifacts.at(-1).id, `fixture-${i}`);
    }
    assert.equal(events.filter((event) => event.type === 'artifact.created').length, 8);
    assert.ok(events.every((event, i) => event.id === i + 1), 'SSE event IDs remain numeric and ordered independently of artifact IDs');
  });

  await t.test('one role can be invoked independently', async () => {
    const previous = calls.length;
    const run = await create({ mode: 'live', scope: 'ebert', brief: 'Independent critique', inputArtifacts: [{ id: 'prior-shot', kind: 'report', title: 'Previous shot context', text: 'Preserve the garden.' }] });
    const events = await collect(live.origin, run.id);
    assert.equal(events.at(-1).type, 'run.completed');
    assert.equal(calls.length, previous + 1);
    assert.equal(calls.at(-1).agent, 'ebert');
    assert.equal(calls.at(-1).context.artifacts[0].id, 'prior-shot');
    assert.equal(events.filter((event) => event.type === 'message')[0].to, null);
  });

  await t.test('an exact manual world camera reaches Spielberg as shared input', async () => {
    const camera = { position: [-1, .2, -2], quaternion: [0, 0, 0, 1], target: [-1, .2, -4], up: [0, 1, 0], fovY: 45, aspect: 1.5, layers: ['corgi-dog'] };
    const run = await create({ mode: 'live', scope: 'spielberg', inputArtifacts: [{ id: 'camera-brief', kind: 'world', title: 'Chosen angle', url: '/worlds/corgi/scene.json', viewer: 'splat', camera }] });
    assert.equal((await collect(live.origin, run.id)).at(-1).type, 'run.completed');
    const input = calls.at(-1).context.artifacts[0];
    assert.equal(input.viewer, 'splat');
    assert.deepEqual(input.camera, camera);
    for (const bad of [{ ...camera, position: [null, 0, 0] }, { ...camera, quaternion: [0, 0, 0, 0] }, { ...camera, fovY: 0 }]) {
      const response = await fetch(`${live.origin}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'live', scope: 'spielberg', inputArtifacts: [{ kind: 'world', viewer: 'splat', url: '/worlds/corgi/scene.json', camera: bad }] }) });
      assert.equal(response.status, 400, 'Invalid camera cannot become agent context');
    }
  });

  await t.test('unsafe artifact URLs fail the run and preserve preceding evidence', async () => {
    const run = await create({ mode: 'live', brief: 'unsafe-artifact' });
    const events = await collect(live.origin, run.id);
    assert.equal(events.at(-1).type, 'run.failed');
    assert.match(events.at(-1).message, /Artifact URL/);
    assert.equal(events.filter((event) => event.type === 'artifact.created').length, 1);
  });

  await t.test('cancelling a replay stops its pending work', async () => {
    const run = await create({ mode: 'replay' });
    let requested = false;
    const events = await collect(live.origin, run.id, async (event) => {
      if (event.type === 'agent.started' && !requested) {
        requested = true;
        const response = await fetch(`${live.origin}/api/runs/${run.id}/cancel`, { method: 'POST' });
        assert.equal(response.status, 200);
      }
    });
    assert.equal(events.at(-1).type, 'run.cancelled');
    assert.equal(events.filter((event) => event.type === 'artifact.created').length, 0);
  });

  await t.test('missing adapters cannot be presented as live execution', async () => {
    const empty = await service();
    try {
      const config = await fetch(`${empty.origin}/api/config`).then((response) => response.json());
      assert.equal(config.liveReady, false);
      const response = await fetch(`${empty.origin}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'live' }) });
      assert.equal(response.status, 409);
    } finally { await empty.close(); }
  });

  await t.test('a browser can start a replay from the service’s actual listening port', async () => {
    const response = await fetch(`${live.origin}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: live.origin }, body: JSON.stringify({ mode: 'replay' }) });
    assert.equal(response.status, 202);
    const run = await response.json();
    await fetch(`${live.origin}/api/runs/${run.id}/cancel`, { method: 'POST', headers: { Origin: live.origin } });
    assert.equal((await collect(live.origin, run.id)).at(-1).type, 'run.cancelled');
  });
});

test('the configured HTTPS deployment origin can run replay while unrelated origins are rejected', async (t) => {
  const live = await service({}, { DARKMATTER_PUBLIC_ORIGIN: 'https://darkmatter.wom.quest' });
  t.after(() => live.close());
  const create = (origin) => fetch(`${live.origin}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ mode: 'replay' }) });
  assert.equal((await create('https://unrelated.example')).status, 403);
  const response = await create('https://darkmatter.wom.quest');
  assert.equal(response.status, 202);
  const run = await response.json();
  assert.equal((await fetch(`${live.origin}/api/runs/${run.id}/cancel`, { method: 'POST', headers: { Origin: 'https://darkmatter.wom.quest' } })).status, 200);
  assert.equal((await collect(live.origin, run.id)).at(-1).type, 'run.cancelled');
});

test('native Agentverse URLs are not misrepresented as compatible app adapters', async (t) => {
  const live = await service({ ebert: 'https://agents.ai3d.dev/ebert', lucas: 'https://agents.ai3d.dev/agentverse' });
  t.after(() => live.close());
  const config = await fetch(`${live.origin}/api/config`).then((response) => response.json());
  assert.equal(config.liveReady, false);
  for (const role of ['ebert', 'lucas']) {
    const agent = config.agents.find((item) => item.id === role);
    assert.equal(agent.endpointConfigured, true);
    assert.equal(agent.transport, 'agentverse');
    assert.equal(agent.configured, false);
    const response = await fetch(`${live.origin}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'live', scope: role }) });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /signed messages/);
  }
});
