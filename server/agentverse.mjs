import { randomUUID } from 'node:crypto';

const ASI_ENDPOINT = 'https://api.asi1.ai/v1/chat/completions';
const FAILED = new Set(['failed', 'error', 'timeout', 'skipped']);
export class AgentverseError extends Error {
  constructor(message, code = 'agentverse_failed', uncertain = false) { super(message); this.name = 'AgentverseError'; this.code = code; this.uncertain = uncertain; }
}
export function redactAgentText(text, env = process.env) {
  let value = String(text);
  for (const [key, secret] of Object.entries(env)) {
    if (/KEY|TOKEN|SECRET|PASSWORD|_API$/.test(key) && typeof secret === 'string' && secret.length >= 8) value = value.split(secret).join('[credential withheld]');
  }
  return value.replace(/https:\/\/[^\s"<>]+\/connect\/[^\s"<>]+/g, '[account link withheld; connect through the agent’s Agentverse profile]');
}
function nativeMessage({ agent, brief, instruction, context, videoUrl, videoModel, publicOrigin }) {
  // Ebert treats the first URL as a video. Do not send him scene/image URLs as a substitute.
  if (agent === 'ebert') {
    if (!videoUrl) return 'No video has been supplied to DARKMATTER yet. Please return your required video-review input instructions. Do not invent a score or review.';
    return `Review ${videoUrl}\n${videoModel ? `model: ${videoModel}\n` : ''}intent: DARKMATTER critic review of the supplied video. Do not generate or revise a video.\nprompt: ${brief.replace(/[\r\n]+/g, ' ')}`;
  }
  const compact = { ...(videoUrl ? { videoUrl } : {}), artifacts: context.artifacts.slice(-12).map((artifact) => ({ ...artifact,
    url: artifact.url?.startsWith('/') ? new URL(artifact.url, publicOrigin).href : artifact.url, text: artifact.text?.slice(0, 6000) })),
    findings: context.findings.slice(-12), messages: context.messages.slice(-8).map((message) => ({ ...message, text: message.text?.slice(0, 2000) })) };
  return `DARKMATTER / ${agent}\nThis is a brief live demo. Prioritize low latency and reply in at most 100 words. Acknowledge the previous agent's response and the supplied scene, then state one next action and its required input. Explain the task; do not execute it yet. Do not call tools, fetch assets, list model catalogs or prices, generate, repair, link an account, or approve quotes in this test. Do not claim inspection or completed work.\nCreative brief: ${brief}\nNext task: ${instruction}\nShared context:\n${JSON.stringify(compact).slice(0, 30000)}`;
}

/** Return only a reply attributed to the exact configured agent in ASI's streamed task metadata. */
export async function callAgentverse(options, { fetcher = fetch, env = process.env } = {}) {
  const { address, agent, signal, onProgress = () => {} } = options;
  const key = env.FETCH_ASI_API || env.ASI_ONE_API_KEY;
  if (!key) throw new AgentverseError('Set FETCH_ASI_API on the server to call Agentverse agents.', 'missing_credentials');
  if (!/^agent1[a-z0-9]{20,}$/.test(address || '')) throw new AgentverseError(`${agent} has no valid Agentverse address.`, 'missing_address');
  const sessionId = randomUUID(), controller = new AbortController();
  const combined = AbortSignal.any([controller.signal, AbortSignal.timeout(300000), ...(signal ? [signal] : [])]);
  const message = redactAgentText(options.directMessage || nativeMessage({ ...options, publicOrigin: env.DARKMATTER_PUBLIC_ORIGIN || 'https://darkmatter.wom.quest' }), env);
  const prompt = `Contact only @${address}. Send exactly one message to that agent with the request below, then return its actual reply. Do not answer yourself, discover a replacement agent, retry a failed or pending request, or approve any quotes.\n\n${message}`;
  const tasks = new Map(); let bytes = 0, doneMarker = false, reader;
  const progress = new Set();
  try {
    onProgress({ state: 'contacting', text: `Contacting ${agent} through Agentverse…`, address });
    const response = await fetcher(ASI_ENDPOINT, { method: 'POST', signal: combined, redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'x-session-id': sessionId },
      body: JSON.stringify({ model: 'asi1', planner_mode: true, agents: [address], stream: true, messages: [{ role: 'user', content: prompt }] }) });
    if (!response.ok) {
      await response.body?.cancel();
      throw new AgentverseError(`Agentverse transport returned HTTP ${response.status}${response.status === 401 ? ' (check the server’s ASI:One key)' : ''}.`, 'transport_error');
    }
    if (!response.body) throw new AgentverseError('Agentverse returned an empty response.', 'empty_stream');
    reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    function inspect(frame) {
      const data = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n').trim();
      if (!data) return;
      if (data === '[DONE]') { doneMarker = true; return; }
      let chunk; try { chunk = JSON.parse(data); } catch { return; }
      const metadata = chunk.metadata;
      for (const [phase, phaseData] of Object.entries(metadata?.phases || {})) {
        for (const [task, update] of Object.entries(phaseData.tasks || {})) {
          const id = `${phase}/${task}`, previous = tasks.get(id) || {};
          const state = { ...previous, ...update, agent_used: { ...previous.agent_used, ...update.agent_used } }; tasks.set(id, state);
          if (state.agent_used?.agent_address !== address) continue;
          if (state.status && !progress.has(`${id}/${state.status}`)) {
            progress.add(`${id}/${state.status}`);
            onProgress({ state: String(state.status).slice(0, 50), text: `Waiting for ${agent}’s response…`, address, phase, task });
          }
          const reply = typeof state.agent_response === 'string' ? state.agent_response.trim() : '';
          if (FAILED.has(state.status) || /^\[NO RESPONSE RECEIVED\]$/i.test(reply)) throw new AgentverseError(
            `${agent} did not return a result before Agentverse stopped waiting. Work may still be running remotely; this app will not retry automatically.`, 'agent_timeout', true);
          if (state.status === 'completed' && reply) {
            const accountLink = reply.match(/https:\/\/agents\.ai3d\.dev\/agentverse\/connect\/[a-z0-9_-]{16,200}/i)?.[0];
            return { text: redactAgentText(reply, env).slice(0, 24000), accountLink,
              provenance: { transport: 'agentverse', address, sessionId, phase, task },
              needsInput: Boolean(accountLink) || agent === 'ebert' && !options.videoUrl, inputKind: accountLink ? 'account' : agent === 'ebert' && !options.videoUrl ? 'video' : null };
          }
        }
      }
      if (['clarification_requested', 'payment_requested', 'card_interaction_requested'].includes(metadata?.plan_status)) throw new AgentverseError(
        `${agent} needs input, account setup or approval in Agentverse before continuing. No generation was approved by DARKMATTER.`, 'needs_input');
      // Plain assistant content is intentionally ignored: it is not an authenticated agent result.
    }
    while (true) {
      signal?.throwIfAborted();
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8 * 1024 * 1024) throw new AgentverseError('Agentverse response exceeded the stream limit.', 'stream_limit');
      buffer = (buffer + decoder.decode(part.value, { stream: true })).replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const result = inspect(frame); if (result) return result;
      }
    }
    if (buffer.trim()) { const result = inspect(buffer); if (result) return result; }
    throw new AgentverseError(doneMarker ? `${agent} returned no verified Agentverse reply.` : `${agent}’s connection ended before a verified reply arrived.`, 'no_verified_reply');
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    if (error instanceof AgentverseError) throw error;
    throw new AgentverseError(`${agent}’s Agentverse connection was interrupted. The request was not retried.`, 'connection_interrupted', true);
  } finally { controller.abort(); await reader?.cancel().catch(() => {}); }
}

/** Link this bridge's ASI identity using a fresh agent-issued form; keys never enter chat. */
export async function callLinkedAgent(options, dependencies = {}) {
  const { env = process.env, fetcher = fetch } = dependencies;
  const first = await callAgentverse(options, dependencies);
  if (!first.accountLink || !env.AI3D_API_KEY || options.agent === 'ebert') return first;
  const onProgress = options.onProgress || (() => {});
  onProgress({ state: 'account_setup', text: 'Connecting the configured AI3D account for agent chat…', address: options.address });
  // Do not trust a link echoed from user context. Request a fresh link with a server-owned message.
  const fresh = await callAgentverse({ ...options, directMessage: 'Connect my AI3D account. Generate a new one-time connection link for this chat identity.', onProgress: () => {} }, dependencies);
  if (!fresh.accountLink) throw new AgentverseError('The agent did not provide a fresh account connection link.', 'account_setup_failed');
  const link = new URL(fresh.accountLink);
  if (link.origin !== 'https://agents.ai3d.dev' || !/^\/agentverse\/connect\/[a-z0-9_-]{16,200}$/i.test(link.pathname)) throw new AgentverseError('The account connection destination was rejected.', 'account_setup_failed');
  const response = await fetcher(link.href, { method: 'POST', redirect: 'error',
    signal: AbortSignal.any([AbortSignal.timeout(30000), ...(options.signal ? [options.signal] : [])]),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ api_key: env.AI3D_API_KEY }).toString() });
  const html = await response.text();
  const match = response.ok && html.match(/aria-label="Confirmation code">\s*(\d{3})(?:&nbsp;|\s)+(\d{3})\s*</);
  if (!match) throw new AgentverseError('AI3D account linking did not finish. Check the server’s AI3D_API_KEY and account access.', 'account_setup_failed');
  const code = match[1] + match[2];
  const confirmed = await callAgentverse({ ...options, directMessage: `My account connection code is ${code}.`, onProgress: () => {} }, dependencies);
  if (!/connected/i.test(confirmed.text) || /not connected|isn.t connected|wrong code|doesn.t match|cancelled|expired/i.test(confirmed.text))
    throw new AgentverseError('The agent did not confirm the AI3D account connection. No generation was approved.', 'account_setup_failed');
  onProgress({ state: 'account_connected', text: 'AI3D account connected. Requesting the agent’s response…', address: options.address });
  // This is a new task after a confirmed setup, not a retry of uncertain work.
  return callAgentverse(options, dependencies);
}
