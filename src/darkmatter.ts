import './darkmatter.css';
import { h } from './dom.ts';
import { createMission } from './mission.ts';
import { MEDIA } from '../shared/scenario.mjs';

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

const orbitFrames = [
  {
    angle: '000°', ring: 'Corgaroo / front', status: 'Starting view', tone: 'clear',
    note: 'Meet Corgaroo inside the reconstructed garden. This camera is only the beginning of inspection.',
    src: MEDIA.front,
  },
  {
    angle: '120°', ring: 'Corgaroo / far side', status: 'Inspect unseen surfaces', tone: 'alert',
    note: 'Isolate the corgi and inspect the surface the source camera never saw. Open the native viewer to move between these angles yourself.',
    src: MEDIA.side,
  },
  {
    angle: '180°', ring: 'Corgaroo / reverse', status: 'Complete the orbit', tone: 'alert',
    note: 'The reverse view completes the inspection set. A live Bohr agent will turn located defects into a bounded repair request.',
    src: MEDIA.back,
  },
];

function mark(label: string) {
  return h('span.dm-mark', { 'aria-hidden': 'true' }, h('span', label), h('i'), h('i'));
}

export function renderDarkmatter(root: HTMLElement): () => void {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mission = createMission();

  const dossiers = h('div.dm-dossiers');
  for (const agent of agents) {
    const button = h('button.dm-dossier', {
      type: 'button', dataset: { agent: agent.id }, 'aria-pressed': 'false',
      style: { '--agent-accent': agent.accent } as Partial<CSSStyleDeclaration>,
      onclick: () => { mission.selectAgent(agent.id); mission.element.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' }); },
    },
    h('span.dm-dossier-index', agent.index),
    h('span.dm-dossier-main', h('strong', agent.name), h('em', agent.role)),
    h('span.dm-dossier-action', agent.action), h('span.dm-dossier-arrow', '↗'));
    dossiers.append(button);
  }

  const orbitImage = h('img', { src: orbitFrames[0].src, alt: 'Front view of Corgaroo in the reconstructed 3D garden' });
  const orbitAngle = h('strong', orbitFrames[0].angle);
  const orbitRing = h('span', orbitFrames[0].ring);
  const orbitStatus = h('span.dm-orbit-status', { dataset: { tone: orbitFrames[0].tone } }, orbitFrames[0].status);
  const orbitNote = h('p', orbitFrames[0].note);
  const orbitTabs = h('div.dm-orbit-tabs', { role: 'tablist', 'aria-label': 'Recorded orbital views' });
  const setOrbit = (index: number) => {
    const frame = orbitFrames[index];
    orbitImage.src = frame.src;
    orbitImage.alt = `${frame.ring} captured from the native 3D corgi viewer`;
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
    src: MEDIA.reconstruction,
    alt: 'Saved corgi garden reconstruction at its original camera',
  }), h('span', '3D reconstruction'));
  const compareLine = h('i.dm-compare-line');
  const compareValue = h('span', '38% revealed');
  const showBefore = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setCompare(0) }, 'Source photograph');
  const showCandidate = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setCompare(100) }, '3D reconstruction');
  function setCompare(value: number) {
    compareRange.value = String(value);
    compareAfter.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
    compareLine.style.left = `${value}%`;
    compareValue.textContent = `${value}% revealed`;
    showBefore.setAttribute('aria-pressed', String(value === 0));
    showCandidate.setAttribute('aria-pressed', String(value === 100));
  }
  const compareRange = h('input', {
    type: 'range', min: '0', max: '100', value: '38',
    'aria-label': 'Reveal the corgi 3D reconstruction over its source photograph',
    oninput: (event: Event) => {
      setCompare(Number((event.currentTarget as HTMLInputElement).value));
    },
  });

  const page = h('main.darkmatter-page',
    h('header.dm-nav',
      h('a.dm-brand', { href: '/', 'aria-label': 'DARKMATTER home' },
        h('span.dm-brand-sigil', { 'aria-hidden': 'true' }, h('i'), h('i')), h('strong', 'DARKMATTER')),
      h('nav', { 'aria-label': 'DARKMATTER navigation' },
        h('a', { href: '#system' }, 'System'), h('a', { href: '#agents' }, 'Agents'), h('a', { href: '#evidence' }, 'Evidence')),
      h('a.dm-nav-status', { href: '#system' }, h('span'), 'Mission control')),

    h('section.dm-hero', { 'aria-labelledby': 'darkmatter-title' },
      h('div.dm-hero-copy',
        h('p.dm-kicker', mark('GENERATION / AND EVERYTHING AFTER'), 'Autonomous creative infrastructure'),
        h('h1#darkmatter-title', h('span', 'DARK'), h('span', 'MATTER')),
        h('p.dm-thesis', 'Generative AI creates the visible ', h('strong', '3%'), '. ', h('span', 'We tackle the invisible 97%.' )),
        h('p.dm-hero-note', 'Four agents critique, generate, reconstruct, inspect, repair, and return the camera to the world. Then they do it again.'),
        h('div.dm-hero-actions',
          h('a.dm-primary-link', { href: '#system' }, h('span', 'Watch agents collaborate'), h('i', '↘')),
          h('a.dm-text-link', { href: '#system', onclick: () => void mission.exploreWorld() }, 'Explore Corgaroo in 3D', h('span', '→')))),
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
      h('div.dm-section-head', h('div', mark('01 / COLLABORATION ROOM'), h('h2#system-title', 'Watch the work move between minds.')),
        h('p', 'One brief becomes a shot, a critique, a world, evidence, and a new camera angle. Follow every agent’s contribution and the context it passes to the next.')),
      mission.element),

    h('section.dm-agents#agents', { 'aria-labelledby': 'agents-title' },
      h('div.dm-section-head', h('div', mark('02 / AUTONOMOUS CAST'), h('h2#agents-title', 'Four names. Four disciplines. One shared artifact.')),
        h('p', 'Call each role individually or run the shared loop. Their outputs become the next agent’s context, carrying the same creative work forward.')),
      dossiers),
    h('section.dm-handoff', { 'aria-label': 'Agent handoff sequence' },
      h('div', h('span', '01'), h('strong', 'FILM'), h('em', 'Spielberg creates')), h('i', '→'),
      h('div', h('span', '02'), h('strong', 'CRITIQUE'), h('em', 'Ebert directs')), h('i', '→'),
      h('div', h('span', '03'), h('strong', 'WORLD'), h('em', 'Lucas reconstructs')), h('i', '→'),
      h('div', h('span', '04'), h('strong', 'EVIDENCE'), h('em', 'Bohr repairs')), h('i', '↺')),

    h('section.dm-evidence#evidence', { 'aria-labelledby': 'evidence-title' },
      h('div.dm-section-head', h('div', mark('03 / THE UNSEEN'), h('h2#evidence-title', 'A hero frame can hide a broken world.')),
        h('p', 'One corgi garden, inspected from cameras beyond the source photograph. Every view below comes from the same saved 3D world.')),
      h('div.dm-orbit-evidence',
        h('div.dm-orbit-copy',
          h('p.dm-evidence-label', 'BOHR / ORBITAL INSPECTION'),
          h('h3', 'Move the camera. Change what can be known.'),
          h('p', 'A plausible front view is not proof of a coherent object. Sample an orbital field and the hidden surface becomes testable.'),
          orbitTabs,
          h('div.dm-orbit-meta', h('div', orbitAngle, orbitRing), orbitStatus), orbitNote,
          h('small', 'Corgaroo’s saved garden · native 3D camera captures')),
        h('figure.dm-orbit-frame', orbitImage,
          h('span.dm-frame-corner.dm-frame-corner-a'), h('span.dm-frame-corner.dm-frame-corner-b'),
          h('figcaption', h('span', 'CAM / ORBIT–B'), h('span', 'OBJECT / CORGAROO'))))),
    h('section.dm-repair', { 'aria-labelledby': 'repair-title' },
      h('div.dm-repair-copy', mark('04 / SOURCE CONTINUITY'), h('h2#repair-title', 'One photograph. A world beyond it.'),
        h('p', 'Slide between Corgaroo’s source photograph and its reconstructed garden at the same camera. Then leave the frame in native 3D: inspect, choose a new shot, and hand its exact camera to Spielberg.'),
        h('ol', h('li', h('span', '01'), h('div', h('strong', 'Observe'), h('p', 'Capture the failing angle and the scene layers that produce it.'))),
          h('li', h('span', '02'), h('div', h('strong', 'Attribute'), h('p', 'Separate geometry defects from camera, background, or generation changes.'))),
          h('li', h('span', '03'), h('div', h('strong', 'Repair + verify'), h('p', 'Apply a bounded candidate and revisit every required view.'))))),
      h('div.dm-compare-wrap',
        h('div.dm-compare-choices', showBefore, showCandidate),
        h('div.dm-compare',
          h('img', { src: MEDIA.opening, alt: 'Original source photograph of Corgaroo beside the bicycle, bench and lemon tree' }),
          h('span.dm-before-label', 'Source photo'), compareAfter, compareLine),
        h('div.dm-compare-control', h('span', 'Photo'), compareRange, compareValue),
        h('p.dm-repair-explanation', h('strong', 'Same scene, same camera. '), 'Compare the silhouette, detail and placement; orbit to inspect what the photograph could not show.'),
        h('p', h('span.dm-candidate-dot'), ' Saved reconstruction · live repair and verification are the next iteration'))),

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
      h('a.dm-brand', { href: '/' }, h('span.dm-brand-sigil', { 'aria-hidden': 'true' }, h('i'), h('i')), h('strong', 'DARKMATTER')),
      h('p', 'Generative AI creates the visible 3%. We tackle the invisible 97%.'),
      h('div', h('a', { href: 'https://wom.quest/', target: '_blank', rel: 'noopener noreferrer' }, 'World of a Memory'), h('span', '© 2026'))),
  );

  root.append(page);
  setCompare(38);
  if (new URLSearchParams(location.search).get('view') === '3d') void mission.exploreWorld();
  return () => mission.dispose();
}
