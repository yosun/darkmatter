import './mission.css';
import { h } from './dom.ts';
import { AGENTS, MEDIA } from '../shared/scenario.mjs';
import type { Artifact } from '../shared/scenario.mjs';
import type { createWorldViewer } from './world-viewer.ts';

type AgentId = 'ebert' | 'spielberg' | 'lucas' | 'bohr';
type RunEvent = { id: number; type: string; at: string; runId: string; agent?: AgentId; to?: AgentId | null; text?: string; message?: string; step?: number; title?: string; [key: string]: unknown };
type Connection = { id: AgentId; name: string; role: string; color: string; address: string; configured: boolean; endpointConfigured?: boolean; transport?: 'agentverse' | 'adapter' };

export function createMission() {
  let config: Connection[] = [];
  let stream: EventSource | null = null;
  let runId = '';
  let running = false;
  let starting = false;
  let disposed = false;
  let selectedAgent: AgentId = 'spielberg';
  let mode: 'replay' | 'live' = 'replay';
  let startedAt = 0;
  let clock: number | null = null;
  let follow = true;
  let artifacts: Artifact[] = [];
  let events: RunEvent[] = [];
  let view: 'artifact' | 'world' = 'artifact';
  let world: ReturnType<typeof createWorldViewer> | undefined;
  let worldLoading: Promise<void> | undefined;
  let worldManifest = '';
  let pendingWorld: Artifact | undefined;
  let currentArtifact: Artifact | undefined;
  const received = new Set<number>();
  const statuses = new Map<string, string>();
  const agentName = (id?: string | null) => AGENTS.find((agent) => agent.id === id)?.name || 'DARKMATTER';
  const agentColor = (id?: string) => AGENTS.find((agent) => agent.id === id)?.color || '#d9ff5a';

  const status = h('span.mc-status', 'Connecting to event service…');
  const elapsed = h('span.mc-elapsed', '00:00');
  const runLabel = h('span.mc-run-label', 'NO RUN');
  const modeSelect = h('select', { 'aria-label': 'Execution mode', onchange: () => { mode = modeSelect.value as typeof mode; paintControls(); } },
    h('option', { value: 'replay' }, 'Recorded replay'), h('option', { value: 'live' }, 'Live agents'));
  const brief = h('textarea', { rows: 2, maxLength: 2000, 'aria-label': 'Creative brief' }, 'Corgaroo in a quiet garden. Preserve the corgi and red bicycle. Move beyond the opening frame and earn a new camera angle.');
  const start = h('button.mc-start', { type: 'button', disabled: true, onclick: () => void startRun() }, '▶ Run the collaboration');
  const stop = h('button.mc-stop', { type: 'button', disabled: true, onclick: () => void cancelRun() }, '■ Stop');
  const reset = h('button.mc-minor', { type: 'button', onclick: () => resetRun() }, 'Reset');
  const exportButton = h('button.mc-minor', { type: 'button', disabled: true, onclick: () => exportTrace() }, '↓ Export trace');
  const connections = h('button.mc-connections', { type: 'button', onclick: () => showConnections() }, 'Connections');
  const notice = h('p.mc-notice', { role: 'status' }, 'Replay uses recorded 3D evidence and illustrative agent dialogue.');
  const agentsRail = h('div.mc-agents', { 'aria-label': 'Collaborating agents' });
  const agentCards = new Map<string, { button: HTMLButtonElement; state: HTMLElement; card: HTMLElement; invoke: HTMLButtonElement }>();
  const selectedSummary = h('span', 'Spielberg creates a shot, then passes it to Ebert for critique.');
  const stepTitle = h('strong', 'One shared scene. Four different responsibilities.');
  const stepNumber = h('span', 'READY');
  const progress = h('i');
  const messages = h('div.mc-messages', { role: 'log', 'aria-label': 'Agent collaboration messages', 'aria-live': 'polite' },
    h('div.mc-empty', h('span', '↗'), h('strong', 'Follow the handoffs.'), h('p', 'Run the collaboration to see who speaks, what they pass on, and how the shared work changes.')));
  const followButton = h('button.mc-follow', { type: 'button', 'aria-pressed': 'true', onclick: () => {
    follow = !follow; followButton.setAttribute('aria-pressed', String(follow)); followButton.textContent = follow ? 'Following ↓' : 'Follow ↓';
  } }, 'Following ↓');
  const artifactTitle = h('strong', 'The starting scene');
  const artifactBy = h('span', 'Recorded source-camera reconstruction');
  const viewport = h('div.mc-viewport');
  const worldMount = h('div.mc-world-mount', { hidden: true });
  const artifactTab = h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => selectView('artifact') }, 'Shared artifact');
  const worldTab = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => void exploreWorld() }, '↗ Explore Corgaroo in 3D');
  const artifactCaption = h('p.mc-artifact-caption');
  const artifactStrip = h('div.mc-artifact-strip', { 'aria-label': 'Artifacts created during this run' });
  const artifactCount = h('strong', '0');
  const handoffCount = h('strong', '0');
  const findingCount = h('strong', '0');
  const reviewState = h('strong', 'Not evaluated');
  const dialog = h('dialog.mc-dialog',
    h('div.mc-dialog-head', h('h3', 'Agent connections'), h('button', { type: 'button', onclick: () => dialog.close(), 'aria-label': 'Close agent connections' }, '×')),
    h('p', 'Each live adapter receives the brief and the artifacts, messages, and findings produced by the previous agents.'),
    h('div.mc-connection-list'),
    h('p.mc-connection-help', 'Add the four agent endpoint URLs to this project’s .env and restart npm run dev. The README documents the adapter contract.'));
  dialog.addEventListener('close', () => connections.focus());

  function selectView(next: typeof view) {
    view = next; viewport.hidden = next === 'world'; worldMount.hidden = next !== 'world';
    artifactTab.setAttribute('aria-pressed', String(next === 'artifact')); worldTab.setAttribute('aria-pressed', String(next === 'world'));
    world?.setActive(next === 'world');
    artifactTitle.textContent = next === 'world' ? 'Corgaroo’s explorable world' : currentArtifact?.title || 'The starting scene';
    artifactBy.textContent = next === 'world' ? 'Native 3D · five saved scene layers' : currentArtifact?.agent ? `${agentName(currentArtifact.agent)} / ${mode === 'replay' ? 'replay artifact' : 'live output'}` : 'Corgi garden / source photograph';
    artifactCaption.textContent = next === 'world' ? 'Take the camera yourself. Manual movement pauses agent camera changes. Save a shot or add your angle to Spielberg’s context.' : currentArtifact?.caption || '';
  }

  async function exploreWorld(artifact: Artifact = { id: 'corgi-world', kind: 'world', title: 'Corgaroo’s garden', url: '/worlds/corgi/scene.json', viewer: 'splat', preset: 'source' }, force = false) {
    pendingWorld = artifact; selectView('world');
    if (worldLoading) {
      await worldLoading;
      if (!disposed && pendingWorld?.url !== worldManifest) await exploreWorld(pendingWorld, force);
      return;
    }
    if (world && worldManifest === artifact.url) { await world.show(artifact, force); return; }
    worldLoading = (async () => {
      try {
        worldMount.replaceChildren(h('p.mc-notice', 'Loading the native 3D viewer…'));
        const { createWorldViewer } = await import('./world-viewer.ts');
        if (disposed) return;
        world?.dispose(); worldManifest = artifact.url!;
        world = createWorldViewer(worldManifest, (cameraArtifact) => { addArtifact(cameraArtifact); selectAgent('spielberg'); });
        worldMount.replaceChildren(world.element); world.setActive(view === 'world');
        await world.ready;
        if (pendingWorld) await world.show(pendingWorld);
      } catch {
        worldMount.replaceChildren(h('p.mc-image-error', 'The 3D viewer could not load. Refresh to try again.'));
      }
    })();
    await worldLoading; worldLoading = undefined;
  }

  function showArtifact(artifact: Artifact, select = true) {
    currentArtifact = artifact;
    viewport.replaceChildren();
    viewport.dataset.kind = artifact.kind;
    if (artifact.kind === 'world' && artifact.viewer === 'splat') {
      viewport.append(h('div.mc-world-link', h('strong', artifact.title), h('button.mc-minor', { type: 'button', onclick: () => void exploreWorld(artifact) }, 'Explore this 3D world')));
      void exploreWorld(artifact, select);
    } else if (select) selectView('artifact');
    selectView(view);
    if (artifact.kind === 'report') viewport.append(h('article.mc-report', h('span', agentName(artifact.agent)), h('h4', artifact.title), h('pre', artifact.text || '')));
    else if (artifact.kind === 'video') viewport.append(h('video', { controls: true, src: artifact.url, poster: artifact.poster, preload: 'metadata', 'aria-label': artifact.title }));
    else if (artifact.kind === 'world') {
      if (artifact.viewer !== 'splat') viewport.append(h('div.mc-world-link', h('strong', 'World ready to explore'), h('a', { href: artifact.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open the 3D world ↗')));
    }
    else {
      const image = h('img', { src: artifact.url, alt: artifact.title });
      image.addEventListener('error', () => viewport.append(h('p.mc-image-error', 'This image could not load. Refresh the app from its local server.')), { once: true });
      viewport.append(image);
      if (artifact.annotation) {
        const box = artifact.annotation;
        viewport.append(h('span.mc-annotation', { style: { left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` } }, h('b', box.label)));
      }
    }
    for (const button of artifactStrip.querySelectorAll<HTMLButtonElement>('button')) button.setAttribute('aria-pressed', String(button.dataset.artifactId === artifact.id));
  }

  function addArtifact(artifact: Artifact) {
    artifacts.push(artifact);
    const button = h('button.mc-artifact-thumb', { type: 'button', dataset: { artifactId: artifact.id }, 'aria-pressed': 'true', onclick: () => showArtifact(artifact) },
      artifact.kind === 'image' ? h('img', { src: artifact.url, alt: '', loading: 'lazy' }) : h('span', artifact.kind === 'report' ? '≡' : '↗'),
      h('strong', artifact.title), h('small', agentName(artifact.agent)));
    artifactStrip.append(button);
    showArtifact(artifact, false);
    artifactCount.textContent = String(artifacts.length);
  }

  function selectAgent(id: AgentId) {
    selectedAgent = id;
    for (const [key, card] of agentCards) card.button.setAttribute('aria-pressed', String(key === id));
    const agent = AGENTS.find((item) => item.id === id)!;
    const instructions: Record<AgentId, string> = {
      spielberg: 'Spielberg creates and refines the film, then returns to the repaired world for another angle.',
      ebert: 'Ebert turns critique into direction and reviews the new shot at the end of the loop.',
      lucas: 'Lucas turns the film’s scene into a world that Bohr can inspect and the camera can revisit.',
      bohr: 'Bohr exposes defects from new viewpoints, attributes them, and returns a repair candidate.',
    };
    selectedSummary.textContent = instructions[id];
    selectedSummary.style.color = agent.color;
  }

  for (const agent of AGENTS) {
    const state = h('span.mc-agent-state', 'Waiting');
    const button = h('button.mc-agent-select', { type: 'button', 'aria-pressed': String(agent.id === selectedAgent), onclick: () => selectAgent(agent.id as AgentId) },
      h('span.mc-agent-avatar', agent.name.slice(0, 1)), h('span', h('strong', agent.name), h('small', agent.role)), state);
    const invoke = h('button.mc-agent-invoke', { type: 'button', 'aria-label': `Run ${agent.name} independently`, title: `Run ${agent.name} independently`, onclick: () => void startRun(agent.id as AgentId) }, '↗');
    const card = h('div.mc-agent-card', { dataset: { agent: agent.id, state: 'waiting' }, style: `--agent-color:${agent.color}` }, button, invoke);
    agentsRail.append(card);
    agentCards.set(agent.id, { button, state, card, invoke });
  }

  function paintControls() {
    const available = config.filter((agent) => agent.configured).length;
    const busy = running || starting;
    start.disabled = busy || !config.length || (mode === 'live' && available !== AGENTS.length);
    stop.disabled = !running;
    reset.disabled = busy;
    modeSelect.disabled = busy;
    brief.disabled = busy;
    start.textContent = starting ? 'Starting…' : running ? 'Collaboration running…' : mode === 'live' ? '▶ Run live collaboration' : '▶ Run recorded collaboration';
    const native = config.filter((agent) => agent.endpointConfigured && agent.transport === 'agentverse').length;
    connections.textContent = `Connections ${config.filter((agent) => agent.endpointConfigured || agent.configured).length}/4`;
    for (const [id, card] of agentCards) card.invoke.disabled = busy || !config.length || (mode === 'live' && !config.find((agent) => agent.id === id)?.configured);
    if (!busy && !events.length && !notice.dataset.tone) notice.textContent = mode === 'replay'
      ? 'Replay: the real corgi garden with illustrative agent dialogue. Inspect it in 3D; live agents will supply new films and repairs.'
      : available === 4 ? 'Live: each agent receives the previous agents’ actual outputs through its adapter.'
        : native ? `Live setup: ${native} Agentverse endpoints configured; their signed-message bridge is still needed. ${available}/4 app adapters configured. See Connections.`
          : `Live setup: ${available}/4 adapters configured. Configured agents can be called individually with ↗.`;
  }

  function setAgentState(id: string, state: string, label: string) {
    statuses.set(id, state);
    const card = agentCards.get(id);
    if (card) { card.card.dataset.state = state; card.state.textContent = label; }
  }

  function onEvent(event: RunEvent) {
    if (received.has(event.id)) return;
    received.add(event.id);
    events.push(event);
    exportButton.disabled = false;
    if (event.type === 'agent.started' && event.agent) {
      setAgentState(event.agent, 'working', 'Working'); selectAgent(event.agent);
      stepTitle.textContent = event.title || 'Agent working';
      stepNumber.textContent = `${String(event.step).padStart(2, '0')} / 08`;
      progress.style.width = `${((event.step || 1) / 8) * 100}%`;
      status.textContent = `${mode === 'replay' ? 'Replay' : 'Live'} · ${agentName(event.agent)} working`;
    }
    if (event.type === 'agent.completed' && event.agent) {
      setAgentState(event.agent, 'done', 'Delivered');
      status.textContent = `${mode === 'replay' ? 'Replay' : 'Live'} · ${agentName(event.agent)} delivered`;
    }
    if (event.type === 'message') {
      if (messages.querySelector('.mc-empty')) messages.replaceChildren();
      const route = event.to ? `${agentName(event.agent)} → ${agentName(event.to)}` : `${agentName(event.agent)} → Shared workspace`;
      messages.append(h('article.mc-message', { style: `--agent-color:${agentColor(event.agent)}` },
        h('div', h('strong', route), h('time', new Date(event.at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }))), h('p', event.text || '')));
      if (event.to) { handoffCount.textContent = String(events.filter((item) => item.type === 'message' && item.to).length); setAgentState(event.to, 'receiving', 'Received'); }
      if (follow) messages.scrollTop = messages.scrollHeight;
    }
    if (event.type === 'artifact.created') addArtifact(event.artifact as Artifact);
    if (event.type === 'finding.recorded') findingCount.textContent = String(events.filter((item) => item.type === 'finding.recorded').length);
    if (['run.completed', 'run.cancelled', 'run.failed'].includes(event.type)) {
      running = false;
      if (clock !== null) window.clearInterval(clock);
      clock = null;
      stream?.close(); stream = null;
      status.textContent = event.type === 'run.completed' ? 'Run complete · review retained' : event.type === 'run.cancelled' ? 'Run stopped · artifacts retained' : 'Agent run failed';
      if (event.type === 'run.failed') { notice.textContent = event.message || 'The agent endpoint failed.'; notice.dataset.tone = 'error'; }
      else notice.textContent = event.type === 'run.completed' ? 'The handoff circle is complete. Select an artifact to inspect what each agent contributed.' : event.message || 'Run stopped.';
      reviewState.textContent = mode === 'replay' ? 'Verification open' : 'See agent review';
      for (const [id, state] of statuses) if (['working', 'receiving'].includes(state)) {
        setAgentState(id, event.type === 'run.completed' ? 'done' : 'waiting', event.type === 'run.completed' ? 'Context retained' : 'Stopped');
      }
      paintControls();
    }
  }

  async function startRun(scope?: AgentId) {
    if (running || starting) return;
    const inputArtifacts: Artifact[] = scope ? artifacts.length ? [...artifacts] : [{ id: 'starting-scene', kind: 'image', title: 'Starting scene / input', url: MEDIA.opening, caption: 'Input context for this independent invocation.' }] : [];
    resetRun();
    starting = true;
    notice.dataset.tone = '';
    paintControls();
    try {
      const response = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, brief: brief.value, scope, inputArtifacts }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not start the run.');
      if (disposed) return;
      runId = body.id; running = true; startedAt = Date.now();
      runLabel.textContent = `${mode.toUpperCase()} / ${scope ? `${scope.toUpperCase()} / ` : ''}${runId.slice(0, 8)}`;
      for (const artifact of inputArtifacts) addArtifact(artifact);
      status.textContent = scope ? `${agentName(scope)} · independent invocation` : 'Collaboration started';
      clock = window.setInterval(() => { const seconds = Math.floor((Date.now() - startedAt) / 1000); elapsed.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }, 1000);
      stream = new EventSource(`/api/runs/${runId}/events`);
      stream.onmessage = (message) => { try { onEvent(JSON.parse(message.data)); } catch { notice.textContent = 'An event could not be read. The previous evidence is retained.'; } };
      stream.onerror = () => {
        if (!running) return;
        status.textContent = 'Connection interrupted · reconnecting…';
        const expectedRun = runId;
        void fetch(`/api/runs/${runId}`).then((response) => {
          if (response.status !== 404 || !running || runId !== expectedRun) return;
          running = false; stream?.close(); stream = null;
          if (clock !== null) window.clearInterval(clock);
          clock = null;
          status.textContent = 'Run unavailable · evidence retained';
          notice.textContent = 'The event service restarted or this run expired. The artifacts already received remain available; start another run to continue.';
          notice.dataset.tone = 'error';
          for (const [id, state] of statuses) if (['working', 'receiving'].includes(state)) setAgentState(id, 'waiting', 'Disconnected');
          paintControls();
        }).catch(() => { /* EventSource retries a temporary outage. */ });
      };
    } catch (error) { notice.textContent = error instanceof Error ? error.message : 'Could not start the run.'; notice.dataset.tone = 'error'; }
    finally { starting = false; paintControls(); }
  }

  async function cancelRun() {
    if (!running || !runId) return;
    stop.disabled = true;
    try { const response = await fetch(`/api/runs/${runId}/cancel`, { method: 'POST' }); if (!response.ok) throw new Error(); }
    catch { notice.textContent = 'Could not reach the event service to stop the run. Try again.'; stop.disabled = false; }
  }

  function resetRun() {
    if (running) return;
    stream?.close(); stream = null;
    if (clock !== null) window.clearInterval(clock);
    clock = null; runId = ''; events = []; artifacts = []; received.clear(); notice.dataset.tone = '';
    artifactStrip.replaceChildren();
    messages.replaceChildren(h('div.mc-empty', h('span', '↗'), h('strong', 'Follow the handoffs.'), h('p', 'Messages and artifacts will appear here as the agents contribute.')));
    for (const agent of AGENTS) setAgentState(agent.id, 'waiting', 'Waiting');
    handoffCount.textContent = '0'; artifactCount.textContent = '0'; findingCount.textContent = '0';
    reviewState.textContent = 'Not evaluated'; elapsed.textContent = '00:00'; runLabel.textContent = 'NO RUN';
    stepTitle.textContent = 'One shared scene. Four different responsibilities.'; stepNumber.textContent = 'READY'; progress.style.width = '0%'; exportButton.disabled = true;
    showArtifact({ id: 'starting-scene', kind: 'image', title: 'Corgaroo / the starting frame', url: MEDIA.opening, caption: 'The source photograph for this exact corgi garden. Explore the reconstruction in 3D, then run the agent handoff rehearsal.' }, false);
    status.textContent = config.length ? 'Ready to collaborate' : 'Connecting to event service…';
    paintControls();
  }

  function showConnections() {
    dialog.querySelector('.mc-connection-list')!.replaceChildren(...config.map((agent) => h('div',
      h('strong', agent.name), h('span', agent.transport === 'agentverse' && agent.endpointConfigured ? 'Agentverse · bridge needed' : agent.configured ? 'Adapter configured' : 'Not configured'), h('small', agent.address || 'Agentverse address pending'))));
    dialog.showModal();
  }

  function exportTrace() {
    const blob = new Blob([JSON.stringify({ runId, mode, brief: brief.value, events }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = h('a', { href: url, download: `darkmatter-${runId || 'trace'}.json` }); anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const element = h('div.mc-workspace',
    h('div.mc-topbar', h('div', h('span.mc-dot'), status), h('div', runLabel, elapsed, connections)),
    h('div.mc-brief', h('label', h('span', 'CREATIVE BRIEF / GARDEN–01'), brief), h('div', modeSelect, start, stop)),
    notice,
    agentsRail,
    h('p.mc-agent-summary', h('span', 'SELECTED AGENT'), selectedSummary),
    h('div.mc-stage-head', stepNumber, stepTitle, h('div.mc-step-progress', progress)),
    h('div.mc-main',
      h('section.mc-artifact', { 'aria-label': 'Shared artifact' }, h('div.mc-artifact-head', h('div', artifactTitle, artifactBy), h('span', 'SHARED ARTIFACT')), h('div.mc-view-tabs', artifactTab, worldTab), viewport, worldMount, artifactCaption),
      h('section.mc-transcript', { 'aria-label': 'Collaboration transcript' }, h('div.mc-transcript-head', h('strong', 'Agent → Agent'), followButton), messages)),
    h('div.mc-bottom', h('div.mc-counters', h('div', artifactCount, h('span', 'Artifacts')), h('div', handoffCount, h('span', 'Handoffs')), h('div', findingCount, h('span', 'Findings')), h('div', reviewState, h('span', 'Quality gate'))), h('div', reset, exportButton)),
    artifactStrip, dialog);
  resetRun();
  void fetch('/api/config').then(async (response) => { if (!response.ok) throw new Error(); const body = await response.json(); if (disposed) return; config = body.agents; status.textContent = 'Ready to collaborate'; paintControls(); })
    .catch(() => { if (!disposed) { status.textContent = 'Event service unavailable'; notice.textContent = 'Start both the app and event service with npm run dev from the darkmatter directory.'; notice.dataset.tone = 'error'; } });

  return { element, selectAgent, exploreWorld, dispose: () => { disposed = true; stream?.close(); world?.dispose(); if (clock !== null) window.clearInterval(clock); dialog.close(); } };
}
