import './darkmatter.css';
import { h } from './dom.ts';

type AgentId = 'ebert' | 'spielberg' | 'lucas' | 'bohr';

interface DarkmatterAgent {
  id: AgentId;
  name: string;
  index: string;
  role: string;
  action: string;
  summary: string;
  output: string;
  accent: string;
}

interface LoopStep {
  agent: AgentId;
  label: string;
  detail: string;
}

const agents: DarkmatterAgent[] = [
  {
    id: 'ebert', name: 'Ebert', index: '01', role: 'The critic', action: 'Critique', accent: '#ff7b54',
    summary: 'Reads the film as an audience would—testing story, rhythm, continuity, and whether a new angle earns its place.',
    output: 'Editorial notes + revision brief',
  },
  {
    id: 'spielberg', name: 'Spielberg', index: '02', role: 'The filmmaker', action: 'Generate', accent: '#d9ff5a',
    summary: 'Generates the film, accepts Ebert’s direction, and returns after repair to shoot what the first camera could not see.',
    output: 'Film cuts + recovered camera angles',
  },
  {
    id: 'lucas', name: 'Lucas', index: '03', role: 'The worldbuilder', action: 'Reconstruct', accent: '#a98bff',
    summary: 'Transforms the moving image into an explorable 3D world with geometry, depth, objects, and a navigable camera.',
    output: 'Scene graph + explorable world',
  },
  {
    id: 'bohr', name: 'Bohr', index: '04', role: 'The inspector', action: 'Orbit + repair', accent: '#65ccff',
    summary: 'Moves through quantum-inspired camera orbitals to expose hidden defects, attribute them, and prepare bounded repairs.',
    output: 'Defect evidence + repair candidate',
  },
];

const loopSteps: LoopStep[] = [
  { agent: 'spielberg', label: 'Generate the opening cut', detail: 'A visible film emerges from the prompt and source material.' },
  { agent: 'ebert', label: 'Interrogate the cut', detail: 'Story, continuity, pacing, and visual coherence become revision constraints.' },
  { agent: 'spielberg', label: 'Refine the film', detail: 'The next cut incorporates the critique before the world is reconstructed.' },
  { agent: 'lucas', label: 'Lift film into 3D', detail: 'Frames become a scene with objects, depth, geometry, and a camera.' },
  { agent: 'bohr', label: 'Inspect the unseen', detail: 'Orbital views move beyond the hero frame and reveal hidden surface failures.' },
  { agent: 'bohr', label: 'Prepare the repair', detail: 'Evidence is attributed and a bounded, reversible repair candidate is formed.' },
  { agent: 'spielberg', label: 'Shoot recovered angles', detail: 'The repaired world returns to the filmmaker as new camera possibility.' },
  { agent: 'ebert', label: 'Close the loop', detail: 'The new material is critiqued again. The system is ready for another pass.' },
];

const orbitFrames = [
  {
    angle: '000°', ring: 'Equator / source-facing', status: 'No defect recorded', tone: 'clear',
    note: 'The source-facing view looks coherent. A single frame would stop here.',
    src: '/agent-studies/object-orbits-2026-11-07/images/3c34a21df7a4ec55347a86ee64c2347a7a0b7f746398963212dd145dd935fd83.jpg',
  },
  {
    angle: '120°', ring: 'Equator / far side', status: 'Major smear recorded', tone: 'alert',
    note: 'At 120°, the tail stretches into a thin sheet—a failure hidden from the opening camera.',
    src: '/agent-studies/object-orbits-2026-11-07/images/bd94f1004d0c8d8757eac5eeaa908fa9d791bf226a31fbb584f633174f48e334.jpg',
  },
  {
    angle: '180°', ring: 'Equator / reverse', status: 'Major smear confirmed', tone: 'alert',
    note: 'The reverse orbital confirms the defect persists across neighboring viewpoints.',
    src: '/agent-studies/object-orbits-2026-11-07/images/015b15acaf5a529189e46bb34e7c71ae47242dc61e923a6222753e9f8a61dbca.jpg',
  },
];

const agentById = (id: AgentId) => agents.find((agent) => agent.id === id)!;

function mark(label: string) {
  return h('span.dm-mark', { 'aria-hidden': 'true' }, h('span', label), h('i'), h('i'));
}

function agentButton(agent: DarkmatterAgent, onSelect: (id: AgentId) => void) {
  return h('button.dm-agent-button', {
    type: 'button', dataset: { agent: agent.id },
    style: { '--agent-accent': agent.accent } as Partial<CSSStyleDeclaration>,
    onclick: () => onSelect(agent.id),
  }, h('span.dm-agent-index', agent.index), h('span.dm-agent-name', agent.name), h('span.dm-agent-action', agent.action));
}

export function renderDarkmatter(root: HTMLElement): () => void {
  const timers = new Set<number>();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let selected: AgentId = 'spielberg';
  let stepIndex = 0;
  let running = false;
  let completed = false;

  const runButton = h('button.dm-run', { type: 'button' }, h('span.dm-run-icon', '↗'), h('span', 'Run the loop'));
  const agentHeading = h('h3', 'Spielberg');
  const agentRole = h('p.dm-console-role', 'The filmmaker · Generate');
  const agentSummary = h('p.dm-console-summary', agentById(selected).summary);
  const agentOutput = h('span.dm-output-value', agentById(selected).output);
  const stepNumber = h('span', '01');
  const stepLabel = h('strong', loopSteps[0].label);
  const stepDetail = h('span', loopSteps[0].detail);
  const progress = h('i');
  const announcement = h('p.dm-sr-only', { role: 'status', 'aria-live': 'polite' }, 'Demo ready.');
  const loopShell = h('div.dm-loop-shell');
  const loopAgentButtons: HTMLButtonElement[] = [];
  const dossierButtons: HTMLButtonElement[] = [];

  const clearTimers = () => {
    for (const timer of timers) window.clearTimeout(timer);
    timers.clear();
  };

  const updateAgent = (id: AgentId, announce = true) => {
    selected = id;
    const agent = agentById(id);
    loopShell.dataset.activeAgent = id;
    loopShell.style.setProperty('--active-agent', agent.accent);
    agentHeading.textContent = agent.name;
    agentRole.textContent = `${agent.role} · ${agent.action}`;
    agentSummary.textContent = agent.summary;
    agentOutput.textContent = agent.output;
    for (const button of [...loopAgentButtons, ...dossierButtons]) {
      const active = button.dataset.agent === id;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    if (announce) announcement.textContent = `${agent.name} selected. ${agent.summary}`;
  };

  const paintStep = (index: number) => {
    const step = loopSteps[index];
    updateAgent(step.agent, false);
    stepNumber.textContent = String(index + 1).padStart(2, '0');
    stepLabel.textContent = step.label;
    stepDetail.textContent = step.detail;
    progress.style.width = `${((index + 1) / loopSteps.length) * 100}%`;
    loopShell.dataset.step = String(index + 1);
    announcement.textContent = `Step ${index + 1} of ${loopSteps.length}. ${agentById(step.agent).name}: ${step.label}.`;
  };

  const paintRunButton = () => {
    runButton.classList.toggle('is-running', running);
    runButton.querySelector('span:last-child')!.textContent = running ? 'Pause the loop' : completed ? 'Run it again' : 'Run the loop';
    runButton.querySelector('.dm-run-icon')!.textContent = running ? 'Ⅱ' : '↗';
    runButton.setAttribute('aria-pressed', String(running));
  };

  const queueNext = () => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!running) return;
      if (stepIndex >= loopSteps.length - 1) {
        running = false;
        completed = true;
        loopShell.dataset.runState = 'complete';
        paintRunButton();
        announcement.textContent = 'Demo loop complete. Ebert has closed the critique cycle.';
        return;
      }
      stepIndex += 1;
      paintStep(stepIndex);
      queueNext();
    }, reducedMotion.matches ? 360 : 1350);
    timers.add(timer);
  };

  const pauseLoop = () => {
    running = false;
    clearTimers();
    loopShell.dataset.runState = completed ? 'complete' : 'paused';
    paintRunButton();
    announcement.textContent = `Demo paused at step ${stepIndex + 1}.`;
  };

  const startLoop = () => {
    if (running) return pauseLoop();
    if (completed || stepIndex >= loopSteps.length - 1) {
      stepIndex = 0;
      completed = false;
    }
    running = true;
    loopShell.dataset.runState = 'running';
    paintStep(stepIndex);
    paintRunButton();
    queueNext();
  };

  runButton.addEventListener('click', startLoop);

  const selectAgent = (id: AgentId) => {
    if (running) pauseLoop();
    updateAgent(id);
  };

  const loopAgents = h('div.dm-loop-agents', { 'aria-label': 'Select an agent' });
  for (const agent of agents) {
    const button = agentButton(agent, selectAgent);
    loopAgentButtons.push(button);
    loopAgents.append(button);
  }

  loopShell.append(
    h('div.dm-loop-topbar',
      h('div', h('span.dm-live-dot'), h('span', 'Demo trace'), h('em', 'integration pending')),
      h('div', h('span', 'loop'), h('strong', 'DM–001'))),
    h('div.dm-loop-body',
      h('div.dm-stage',
        h('img.dm-stage-image', {
          src: '/agent-studies/scene-repair-2026-11-07/images/c05e3430624feb4df94eeaefeb96939d76adef5295d0c52f74686cb658723744.jpg',
          alt: 'Generated 3D garden scene with a dog, bicycle, bench, and lemon tree',
        }),
        h('div.dm-stage-grid'),
        h('div.dm-stage-vignette'),
        h('div.dm-orbit-system', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('span.dm-orbit-probe')),
        h('div.dm-stage-readout', h('span', 'WORLD / GARDEN–01'), h('span', 'ORBITAL FIELD ACTIVE')),
        loopAgents,
        h('div.dm-stage-center', h('span', '3D'), h('strong', 'WORLD'), h('small', 'revision 06'))),
      h('aside.dm-agent-console', { 'aria-label': 'Selected agent' },
        h('div.dm-console-head', mark('AGENT'), h('span.dm-agent-state', 'standby')),
        h('div.dm-agent-glyph', { 'aria-hidden': 'true' }, h('span', '●'), h('i'), h('i')),
        agentHeading, agentRole, agentSummary,
        h('div.dm-console-output', h('span', 'Returns'), agentOutput))),
    h('div.dm-loop-controls',
      runButton,
      h('div.dm-step-copy', stepNumber, h('p', stepLabel, stepDetail)),
      h('div.dm-progress', { 'aria-hidden': 'true' }, progress),
      h('span.dm-step-total', `/ ${String(loopSteps.length).padStart(2, '0')}`)),
    announcement,
  );

  const dossiers = h('div.dm-dossiers');
  for (const agent of agents) {
    const button = h('button.dm-dossier', {
      type: 'button', dataset: { agent: agent.id }, 'aria-pressed': 'false',
      style: { '--agent-accent': agent.accent } as Partial<CSSStyleDeclaration>,
      onclick: () => { selectAgent(agent.id); loopShell.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' }); },
    },
    h('span.dm-dossier-index', agent.index),
    h('span.dm-dossier-main', h('strong', agent.name), h('em', agent.role)),
    h('span.dm-dossier-action', agent.action), h('span.dm-dossier-arrow', '↗'));
    dossierButtons.push(button);
    dossiers.append(button);
  }

  const orbitImage = h('img', { src: orbitFrames[0].src, alt: 'Source-facing orbital view of a reconstructed golden retriever' });
  const orbitAngle = h('strong', orbitFrames[0].angle);
  const orbitRing = h('span', orbitFrames[0].ring);
  const orbitStatus = h('span.dm-orbit-status', { dataset: { tone: orbitFrames[0].tone } }, orbitFrames[0].status);
  const orbitNote = h('p', orbitFrames[0].note);
  const orbitTabs = h('div.dm-orbit-tabs', { role: 'tablist', 'aria-label': 'Recorded orbital views' });
  const setOrbit = (index: number) => {
    const frame = orbitFrames[index];
    orbitImage.src = frame.src;
    orbitImage.alt = `${frame.ring} recorded view of the reconstructed golden retriever`;
    orbitAngle.textContent = frame.angle;
    orbitRing.textContent = frame.ring;
    orbitStatus.textContent = frame.status;
    orbitStatus.dataset.tone = frame.tone;
    orbitNote.textContent = frame.note;
    [...orbitTabs.children].forEach((node, i) => {
      const button = node as HTMLButtonElement;
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
    });
  };
  orbitFrames.forEach((frame, index) => orbitTabs.append(h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(index === 0), tabIndex: index === 0 ? 0 : -1,
    onclick: () => setOrbit(index),
  }, h('span', String(index + 1).padStart(2, '0')), frame.angle)));
  orbitTabs.addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent) || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const current = [...orbitTabs.children].findIndex((node) => node.getAttribute('aria-selected') === 'true');
    const next = (current + (event.key === 'ArrowRight' ? 1 : orbitFrames.length - 1)) % orbitFrames.length;
    event.preventDefault();
    setOrbit(next);
    (orbitTabs.children[next] as HTMLButtonElement).focus();
  });

  const compareAfter = h('div.dm-compare-after', h('img', {
    src: '/agent-studies/scene-repair-2026-11-07/images/b7009493bf855ca0cc63976eba068bc4fb27ad24d01cc9093836281e81a32d2d.jpg',
    alt: 'Candidate repaired novel-angle garden render',
  }), h('span', 'Candidate'));
  const compareLine = h('i.dm-compare-line');
  const compareValue = h('span', '52% candidate');
  const compareRange = h('input', {
    type: 'range', min: '0', max: '100', value: '52',
    'aria-label': 'Reveal candidate repair over the recorded before frame',
    oninput: (event: Event) => {
      const value = (event.currentTarget as HTMLInputElement).value;
      compareAfter.style.clipPath = `inset(0 ${100 - Number(value)}% 0 0)`;
      compareLine.style.left = `${value}%`;
      compareValue.textContent = `${value}% candidate`;
    },
  });

  const page = h('main.darkmatter-page',
    h('header.dm-nav',
      h('a.dm-brand', { href: '/darkmatter', 'aria-label': 'DARKMATTER home' },
        h('span.dm-brand-sigil', { 'aria-hidden': 'true' }, h('i'), h('i')), h('strong', 'DARKMATTER')),
      h('nav', { 'aria-label': 'DARKMATTER navigation' },
        h('a', { href: '#system' }, 'System'), h('a', { href: '#agents' }, 'Agents'), h('a', { href: '#evidence' }, 'Evidence')),
      h('a.dm-nav-status', { href: '#system' }, h('span'), 'Loop offline')),

    h('section.dm-hero', { 'aria-labelledby': 'darkmatter-title' },
      h('div.dm-hero-copy',
        h('p.dm-kicker', mark('GENERATION / AND EVERYTHING AFTER'), 'Autonomous creative infrastructure'),
        h('h1#darkmatter-title', h('span', 'DARK'), h('span', 'MATTER')),
        h('p.dm-thesis', 'Generative AI creates the visible ', h('strong', '3%'), '. ', h('span', 'We tackle the invisible 97%.' )),
        h('p.dm-hero-note', 'Four agents critique, generate, reconstruct, inspect, repair, and return the camera to the world. Then they do it again.'),
        h('div.dm-hero-actions',
          h('a.dm-primary-link', { href: '#system' }, h('span', 'Enter the loop'), h('i', '↘')),
          h('a.dm-text-link', { href: '#agents' }, 'Meet the four agents', h('span', '→')))),
      h('div.dm-ratio', { 'aria-label': 'Three percent generation, ninety-seven percent critique, reconstruction, inspection, repair, and iteration' },
        h('div.dm-ratio-head', h('span', 'VISIBLE OUTPUT'), h('strong', '03%')),
        h('div.dm-ratio-field',
          h('div.dm-ratio-disc', { 'aria-hidden': 'true' }, h('span.dm-three-arc'), h('i'), h('i'), h('b')),
          h('strong.dm-ninety-seven', '97'),
          h('div.dm-ratio-label', h('span', 'INVISIBLE'), h('span', 'SYSTEM'))),
        h('div.dm-ratio-foot', h('span', 'critique'), h('span', 'worldbuilding'), h('span', 'inspection'), h('span', 'repair')))),

    h('div.dm-marquee', { 'aria-hidden': 'true' }, h('div',
      'GENERATE', h('span', '✦'), 'CRITIQUE', h('span', '✦'), 'RECONSTRUCT', h('span', '✦'), 'ORBIT', h('span', '✦'), 'REPAIR', h('span', '✦'), 'RESHOOT', h('span', '✦'),
      'GENERATE', h('span', '✦'), 'CRITIQUE', h('span', '✦'), 'RECONSTRUCT', h('span', '✦'), 'ORBIT', h('span', '✦'), 'REPAIR', h('span', '✦'), 'RESHOOT')),

    h('section.dm-system#system', { 'aria-labelledby': 'system-title' },
      h('div.dm-section-head', h('div', mark('01 / CLOSED LOOP'), h('h2#system-title', 'One film. One world. No final frame.')),
        h('p', 'This interface simulates the planned handoffs. The visual evidence below comes from recorded WOM orbital and repair studies. Agentverse endpoints will replace the demo trace as each agent comes online.')),
      loopShell),

    h('section.dm-agents#agents', { 'aria-labelledby': 'agents-title' },
      h('div.dm-section-head', h('div', mark('02 / AUTONOMOUS CAST'), h('h2#agents-title', 'Four names. Four disciplines. One shared artifact.')),
        h('p', 'Each agent is independently callable. Together they move the work from generation to judgment, space, evidence, and back to the camera.')),
      dossiers),
    h('section.dm-handoff', { 'aria-label': 'Agent handoff sequence' },
      h('div', h('span', '01'), h('strong', 'FILM'), h('em', 'Spielberg creates')), h('i', '→'),
      h('div', h('span', '02'), h('strong', 'CRITIQUE'), h('em', 'Ebert directs')), h('i', '→'),
      h('div', h('span', '03'), h('strong', 'WORLD'), h('em', 'Lucas reconstructs')), h('i', '→'),
      h('div', h('span', '04'), h('strong', 'EVIDENCE'), h('em', 'Bohr repairs')), h('i', '↺')),

    h('section.dm-evidence#evidence', { 'aria-labelledby': 'evidence-title' },
      h('div.dm-section-head', h('div', mark('03 / THE UNSEEN'), h('h2#evidence-title', 'A hero frame can hide a broken world.')),
        h('p', 'Recorded evidence from the underlying 3D workflow demonstrates the inspection problem DARKMATTER is designed to automate.')),
      h('div.dm-orbit-evidence',
        h('div.dm-orbit-copy',
          h('p.dm-evidence-label', 'BOHR / ORBITAL INSPECTION'),
          h('h3', 'Move the camera. Change what can be known.'),
          h('p', 'A plausible front view is not proof of a coherent object. Sample an orbital field and the hidden surface becomes testable.'),
          orbitTabs,
          h('div.dm-orbit-meta', h('div', orbitAngle, orbitRing), orbitStatus), orbitNote,
          h('small', 'Recorded WOM object-orbit study · November 7, 2026')),
        h('figure.dm-orbit-frame', orbitImage,
          h('span.dm-frame-corner.dm-frame-corner-a'), h('span.dm-frame-corner.dm-frame-corner-b'),
          h('figcaption', h('span', 'CAM / ORBIT–B'), h('span', 'OBJECT / GOLDEN RETRIEVER'))))),
    h('section.dm-repair', { 'aria-labelledby': 'repair-title' },
      h('div.dm-repair-copy', mark('04 / BOUNDED REPAIR'), h('h2#repair-title', 'Find it. Attribute it. Change only what failed.'),
        h('p', 'Bohr turns a defect into evidence and a reversible repair candidate. The comparison shown here is recorded work—not a claim of an independently verified win.'),
        h('ol', h('li', h('span', '01'), h('div', h('strong', 'Observe'), h('p', 'Capture the failing angle and the scene layers that produce it.'))),
          h('li', h('span', '02'), h('div', h('strong', 'Attribute'), h('p', 'Separate geometry defects from camera, background, or generation changes.'))),
          h('li', h('span', '03'), h('div', h('strong', 'Repair + verify'), h('p', 'Apply a bounded candidate and revisit every required view.'))))),
      h('div.dm-compare-wrap',
        h('div.dm-compare',
          h('img', { src: '/agent-studies/scene-repair-2026-11-07/images/bd55303ba59f925183f955b8c4548fe5f4e2c45cf6fbb0689a2a0842b990d95f.jpg', alt: 'Recorded before frame from a novel garden angle' }),
          h('span.dm-before-label', 'Before'), compareAfter, compareLine),
        h('div.dm-compare-control', h('span', 'Before'), compareRange, compareValue),
        h('p', h('span.dm-candidate-dot'), ' Candidate repair · review status: not independently confirmed'))),

    h('section.dm-stack', { 'aria-labelledby': 'stack-title' },
      h('div.dm-stack-intro', mark('05 / INFRASTRUCTURE'), h('h2#stack-title', 'Independent agents. Shared context. Observable handoffs.'),
        h('p', 'Every role can be called on its own through Fetch.ai Agentverse, then composed into the complete DARKMATTER loop.')),
      h('div.dm-stack-grid',
        h('article', h('span', 'ORCHESTRATION'), h('strong', 'Fetch.ai'), h('em', 'Agentverse'), h('p', 'Discovery, identity, messaging, and independent invocation.')),
        h('article', h('span', 'GENERATION'), h('strong', 'Muse'), h('em', 'Wonder'), h('p', 'Film and world generation inside the creative loop.')),
        h('article', h('span', 'REASONING'), h('strong', 'Gemini 4'), h('em', 'Argon'), h('p', 'Multimodal critique, inspection, and repair reasoning.')),
        h('article', h('span', 'EVALUATION'), h('strong', 'SubQ'), h('em', 'Evaluation'), h('p', 'Independent evidence and quality signals across iterations.')))),

    h('section.dm-final',
      h('div.dm-final-orbit', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('span')),
      h('p', 'THE OTHER NINETY-SEVEN PERCENT'),
      h('h2', 'Generation is only the beginning.'),
      h('a', { href: '#system' }, 'Run the DARKMATTER loop', h('span', '↗'))),

    h('footer.dm-footer',
      h('a.dm-brand', { href: '/darkmatter' }, h('span.dm-brand-sigil', { 'aria-hidden': 'true' }, h('i'), h('i')), h('strong', 'DARKMATTER')),
      h('p', 'Generative AI creates the visible 3%. We tackle the invisible 97%.'),
      h('div', h('a', { href: '/#/' }, 'World of a Memory'), h('span', '© 2026'))),
  );

  root.append(page);
  updateAgent(selected, false);
  paintStep(0);
  paintRunButton();

  return () => {
    clearTimers();
    runButton.removeEventListener('click', startLoop);
  };
}
