import test from 'node:test';
import assert from 'node:assert/strict';
import { callAgentverse, callLinkedAgent, AgentverseError } from './agentverse.mjs';

const address = 'agent1qg7m4zkf6k5j80lclwfg57ym7lsxeg9gafhgc092n98mqspgwczkwqsrpr7';
const env = { FETCH_ASI_API: 'fixture-asi-key-not-a-real-credential' };
const request = { address, agent: 'lucas', brief: 'Preserve Corgaroo.', instruction: 'Explain the next reconstruction step.',
  context: { artifacts: [{ id: 'world', kind: 'world', url: '/worlds/corgi/scene.json', camera: { position: [1, 2, 3] } }], findings: [], messages: [] } };
const task = (entry) => ({ metadata: { phases: { 0: { tasks: { 0: entry } } } } });
function stream(chunks, cancel = () => {}) {
  const text = chunks.map((chunk) => `data: ${typeof chunk === 'string' ? chunk : JSON.stringify(chunk)}\r\n\r\n`).join('');
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 13) controller.enqueue(bytes.slice(i, i + 13)); controller.close();
  }, cancel }), { headers: { 'Content-Type': 'text/event-stream' } });
}

test('native bridge merges partial stream updates and returns only the configured agent reply', async () => {
  let outbound, calls = 0; const progress = [];
  const result = await callAgentverse({ ...request, onProgress: (item) => progress.push(item) }, { env, fetcher: async (url, options) => {
    calls++; outbound = JSON.parse(options.body);
    assert.equal(url, 'https://api.asi1.ai/v1/chat/completions');
    assert.ok(options.headers['x-session-id']);
    return stream([
      { choices: [{ delta: { content: 'Broker answer must not become an agent reply.', reasoning_content: 'Do not expose this.' } }] },
      task({ status: 'waiting_response', agent_used: { agent_address: address } }),
      task({ status: 'completed', agent_response: `Corgaroo 🪐: use the existing scene. ${env.FETCH_ASI_API} https://agents.ai3d.dev/agentverse/connect/private-token` }),
      '[DONE]',
    ]);
  } });
  assert.equal(calls, 1);
  assert.equal(outbound.planner_mode, true);
  assert.deepEqual(outbound.agents, [address]);
  assert.match(outbound.messages[0].content, /https:\/\/darkmatter.wom.quest\/worlds\/corgi\/scene.json/);
  assert.match(outbound.messages[0].content, /"position":\[1,2,3\]/);
  assert.match(result.text, /Corgaroo 🪐/);
  assert.doesNotMatch(result.text, /Broker answer|Do not expose|fixture-asi|private-token/);
  assert.equal(result.provenance.address, address);
  assert.ok(progress.some((item) => item.state === 'waiting_response'));
});

test('a successful HTTP stream with only broker content is not an agent result', async () => {
  await assert.rejects(callAgentverse(request, { env, fetcher: async () => stream([
    { choices: [{ delta: { content: 'I successfully called Lucas.' }, finish_reason: 'stop' }] }, '[DONE]',
  ]) }), (error) => error instanceof AgentverseError && error.code === 'no_verified_reply');
});

test('a different agent cannot satisfy the configured identity', async () => {
  await assert.rejects(callAgentverse(request, { env, fetcher: async () => stream([
    task({ status: 'completed', agent_used: { agent_address: 'agent1unrelated' }, agent_response: 'I am a replacement.' }), '[DONE]',
  ]) }), /no verified/);
});

test('timeout metadata is surfaced as uncertain and never automatically retried', async () => {
  let calls = 0;
  await assert.rejects(callAgentverse(request, { env, fetcher: async () => {
    calls++; return stream([task({ status: 'failed', agent_used: { agent_address: address }, agent_response: '[NO RESPONSE RECEIVED]' })]);
  } }), (error) => error.code === 'agent_timeout' && error.uncertain === true);
  assert.equal(calls, 1);
});

test('Ebert gets no scene URL masquerading as a video when input is missing', async () => {
  let text;
  const result = await callAgentverse({ ...request, agent: 'ebert' }, { env, fetcher: async (url, options) => {
    text = JSON.parse(options.body).messages[0].content;
    return stream([task({ status: 'completed', agent_used: { agent_address: address }, agent_response: 'Send me a video to review.' })]);
  } });
  assert.doesNotMatch(text, /https:\/\//);
  assert.equal(result.needsInput, true);
});

test('a supplied video is the first URL in Ebert’s request', async () => {
  let text;
  await callAgentverse({ ...request, agent: 'ebert', videoUrl: 'https://example.com/take.mp4' }, { env, fetcher: async (url, options) => {
    text = JSON.parse(options.body).messages[0].content;
    return stream([task({ status: 'completed', agent_used: { agent_address: address }, agent_response: 'Actual review.' })]);
  } });
  assert.equal(text.match(/https:\/\/\S+/)[0], 'https://example.com/take.mp4');
});

test('cancellation aborts the pending transport', async () => {
  const abort = new AbortController(); let reached;
  const started = new Promise((resolve) => { reached = resolve; });
  const pending = callAgentverse({ ...request, signal: abort.signal }, { env, fetcher: async (url, options) => {
    reached(); return new Response(new ReadableStream({ start(controller) { options.signal.addEventListener('abort', () => controller.error(options.signal.reason), { once: true }); } }));
  } });
  await started; abort.abort(new Error('Stopped by test.'));
  await assert.rejects(pending, /Stopped by test/);
});

test('the supplied film reaches Lucas alongside prior outputs and the saved world', async () => {
  let prompt;
  await callAgentverse({ ...request, videoUrl: 'https://example.com/take.mp4' }, { env, fetcher: async (url, options) => {
    prompt = JSON.parse(options.body).messages[0].content;
    return stream([task({ status: 'completed', agent_used: { agent_address: address }, agent_response: 'I need the existing job ID.' })]);
  } });
  assert.match(prompt, /"videoUrl":"https:\/\/example.com\/take.mp4"/);
  assert.match(prompt, /scene.json/);
});

test('account setup uses a fresh trusted form and keeps the AI3D key out of chat', async () => {
  const settings = { ...env, AI3D_API_KEY: 'ai3d_fixture_account_key_for_test_only' };
  let asiCalls = 0, formCalls = 0;
  const prompts = [];
  const result = await callLinkedAgent(request, { env: settings, fetcher: async (url, options) => {
    if (url !== 'https://api.asi1.ai/v1/chat/completions') {
      formCalls++; assert.equal(url, 'https://agents.ai3d.dev/agentverse/connect/fresh_link_0123456789');
      assert.equal(new URLSearchParams(options.body).get('api_key'), settings.AI3D_API_KEY);
      return new Response('<p class="code" aria-label="Confirmation code">123&nbsp;456</p>');
    }
    const prompt = JSON.parse(options.body).messages[0].content; prompts.push(prompt);
    const reply = [
      'Connect: https://agents.ai3d.dev/agentverse/connect/older_link_0123456789',
      'New link: https://agents.ai3d.dev/agentverse/connect/fresh_link_0123456789',
      '✅ Connected to AI3D account. Jobs require your approval.',
      'Actual routed answer after account setup.',
    ][asiCalls++];
    return stream([task({ status: 'completed', agent_used: { agent_address: address }, agent_response: reply })]);
  } });
  assert.equal(formCalls, 1); assert.equal(asiCalls, 4);
  assert.ok(prompts[1].includes('Generate a new one-time'));
  assert.ok(prompts[2].includes('123456'));
  assert.ok(prompts.every((prompt) => !prompt.includes(settings.AI3D_API_KEY)));
  assert.equal(result.text, 'Actual routed answer after account setup.');
});
