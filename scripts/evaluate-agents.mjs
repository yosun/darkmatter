// Real network evaluation. Default: identity, readiness and adapter-contract probes.
// --live additionally sends bounded capability requests through ASI:One planner.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';

const env = { ...parseEnv(await readFile(new URL('../.env', import.meta.url), 'utf8')), ...process.env };
const roles = ['ebert', 'spielberg', 'lucas', 'bohr'];
const selected = process.argv.find((arg) => arg.startsWith('--role='))?.split('=')[1];
if (selected && !roles.includes(selected)) throw new Error('Unknown agent role.');
const live = process.argv.includes('--live');
const video = process.argv.find((arg) => arg.startsWith('--video='))?.slice('--video='.length);
if (video && (selected !== 'ebert' || !live || new URL(video).protocol !== 'https:')) throw new Error('--video requires --live --role=ebert and an HTTPS video URL.');
const secrets = Object.entries(env).filter(([key, value]) => /KEY|TOKEN|SECRET|PASSWORD|_API$/.test(key) && value.length >= 8).map(([, value]) => value);
function redact(value) {
  if (typeof value === 'string') {
    for (const secret of secrets) value = value.split(secret).join('[credential redacted]');
    return value.replace(/https:\/\/[^\s"<>]+\/connect\/[^\s"<>]+/g, '[account connection link withheld]')
      .replace(/([?&](?:token|key|signature|credential|code)=)[^&\s"<>]+/gi, '$1[redacted]');
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/reasoning|thought|secret|authorization|credential|api_key|access_token/i.test(key)).map(([key, item]) => [key, redact(item)]));
  return value;
}
async function request(url, options = {}) {
  const start = performance.now();
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), ...options });
    const body = await response.text(); let data;
    try { data = JSON.parse(body); } catch { data = null; }
    return { status: response.status, elapsedMs: Math.round(performance.now() - start), type: response.headers.get('content-type'),
      readiness: response.headers.get('x-uagents-status'), data };
  } catch (error) { return { status: null, error: error.name, elapsedMs: Math.round(performance.now() - start) }; }
}
const prompts = {
  ebert: 'You are being evaluated for DARKMATTER. No video is supplied. Do not invent a review or score. Explain your actual required media inputs, review outputs, and how a director should use your directives. Can you inspect and repair a 3D SPZ world directly? Distinguish capabilities from limitations. Do not generate or modify assets.',
  lucas: 'You are being evaluated for DARKMATTER: Corgaroo, a corgi, in a garden with a red bicycle, bench and lemon tree. Explain your actual backend-routing capabilities and what evidence drives a route. Can you directly take a film or existing SPZ world and repair stretched corgi-tail geometry? Explain required inputs, available outputs, account linking and quote approval. Do not submit a generation or approve any quote. Do not invent an inspection or quality score.',
  spielberg: 'Explain your current video-generation inputs, camera controls, supported output, pricing/approval workflow and whether you can shoot an existing SPZ world or autonomously act on an Ebert review. Do not generate a video or approve a quote.',
  bohr: 'Explain your current orbital inspection protocol, supported 3D inputs, defect evidence and repair outputs. Distinguish implemented capabilities from plans. Do not modify assets.',
};
if (video) prompts.ebert = `Request exactly one Ebert review of this public five-second example clip. Do not request a second review if one is pending or fails. No original generation prompt is supplied: assess only the observable clip and state that prompt fidelity is unverified. Return the actual score, verdict, timestamped issues, uncertainty and actionable director instructions when ready. Do not generate or revise any video.\nReview ${video}\nmodel: h3-max-image-to-video\nintent: DARKMATTER live critic capability evaluation; this is a public example clip, not the Corgaroo film.`;
async function planner(role, address) {
  const key = env.FETCH_ASI_API || env.ASI_ONE_API_KEY;
  if (!key) return { status: 'not_run', reason: 'ASI:One API key is not configured.' };
  const sessionId = randomUUID(); const probeId = `darkmatter-${role}-${randomUUID().slice(0, 8)}`;
  const prompt = `Contact only @${address}; relay the following request to that exact Agentverse agent and report its reply. Do not substitute your own answer. Ask it to echo probe ID ${probeId}. ${prompts[role]}`;
  const start = performance.now();
  const result = { sessionId, probeId, agent: address, prompt, httpStatus: null, streamCompleted: false, finishReasons: [], metadata: [], text: '' };
  try {
    const response = await fetch('https://api.asi1.ai/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(300000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'x-session-id': sessionId },
      body: JSON.stringify({ model: 'asi1', planner_mode: true, agents: [address], stream: true, messages: [{ role: 'user', content: prompt }] }),
    });
    result.httpStatus = response.status;
    if (!response.ok) { result.error = redact((await response.text()).slice(0, 1500)); return result; }
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
        if (!line.startsWith('data:')) continue;
        const text = line.slice(5).trim(); if (text === '[DONE]') { result.streamCompleted = true; continue; }
        let chunk; try { chunk = JSON.parse(text); } catch { continue; }
        if (chunk.metadata) result.metadata.push(redact(chunk.metadata));
        if (chunk.usage) result.usage = chunk.usage;
        for (const choice of chunk.choices || []) {
          if (choice.delta?.content) result.text += choice.delta.content;
          if (choice.finish_reason) result.finishReasons.push(choice.finish_reason);
        }
      }
    }
  } catch (error) { result.error = error.name; }
  finally { result.elapsedMs = Math.round(performance.now() - start); }
  return redact(result);
}
const report = { schema: 'darkmatter-agent-evaluation/1', startedAt: new Date().toISOString(), mode: live ? 'live-capability' : 'transport',
  scope: 'Configured .env identities only; no asset generation, account linking, quote approval, or 3D mutation.', agents: [] };
for (const role of roles.filter((id) => !selected || id === selected)) {
  const prefix = `DARKMATTER_${role.toUpperCase()}`; const address = env[`${prefix}_AGENT_ADDRESS`] || ''; const endpoint = env[`${prefix}_ENDPOINT`] || '';
  const agent = { role, address: /^agent1[a-z0-9]+$/.test(address) ? address : null, endpointConfigured: Boolean(endpoint), configured: Boolean(address && endpoint) };
  report.agents.push(agent);
  if (!agent.configured) { agent.status = 'not_configured'; continue; }
  const url = new URL(endpoint); if (url.protocol !== 'https:') { agent.status = 'unsupported_endpoint'; continue; }
  agent.endpoint = `${url.origin}${url.pathname}`;
  const [identity, readiness, contract, almanac] = await Promise.all([
    request(endpoint), request(endpoint, { method: 'HEAD', headers: { 'x-uagents-address': address } }),
    request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: `evaluation-${randomUUID()}`, step: 1, agent: role, brief: prompts[role], instruction: 'Capability check only. No asset generation.', context: { artifacts: [], messages: [], findings: [] } }) }),
    request(`https://agentverse.ai/v1/almanac/agents/${encodeURIComponent(address)}`),
  ]);
  agent.identity = identity; agent.readiness = readiness; agent.adapterContract = contract; agent.almanac = almanac;
  agent.identityMatched = identity.data?.address === address || identity.data?.agents?.some((item) => item.address === address) || false;
  if (env.AGENTVERSE_API_KEY) {
    const profile = await request(`https://agentverse.ai/v2/agents/${encodeURIComponent(address)}`, { headers: { Authorization: `Bearer ${env.AGENTVERSE_API_KEY}` } });
    agent.profile = { status: profile.status, data: profile.data ? Object.fromEntries(['name', 'address', 'readme', 'description', 'protocols', 'active', 'type'].filter((key) => profile.data[key] !== undefined).map((key) => [key, profile.data[key]])) : null };
  }
  if (live) { console.log(`${role}: calling the configured Agentverse agent through ASI:One planner…`); agent.live = await planner(role, address); }
  console.log(`${role}: identity=${agent.identityMatched}, readiness=${readiness.status}, adapter=${contract.status}, live=${agent.live?.httpStatus ?? 'not run'}`);
}
report.completedAt = new Date().toISOString();
const output = new URL(`../.scratch/eval/${report.startedAt.replace(/[:.]/g, '-')}${selected ? `-${selected}` : ''}.json`, import.meta.url);
await mkdir(new URL('../.scratch/eval/', import.meta.url), { recursive: true }); await writeFile(output, JSON.stringify(redact(report), null, 2) + '\n');
console.log(`Evaluation evidence saved to ${output.pathname.split('/').slice(-3).join('/')}.`);
