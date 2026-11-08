// The replay reuses the saved corgi world. Dialogue is illustrative; live adapters supply new work.
export const AGENTS = [
  { id: 'spielberg', name: 'Spielberg', role: 'Filmmaker', color: '#d9ff5a' },
  { id: 'ebert', name: 'Ebert', role: 'Critic', color: '#ff7b54' },
  { id: 'lucas', name: 'Lucas', role: 'Worldbuilder', color: '#a98bff' },
  { id: 'bohr', name: 'Bohr', role: 'Inspector', color: '#65ccff' },
];

export const MEDIA = {
  opening: '/worlds/corgi/source.jpg',
  reconstruction: '/worlds/corgi/frames/source.jpg',
  front: '/worlds/corgi/frames/corgi.jpg',
  side: '/worlds/corgi/frames/orbit120.jpg',
  back: '/worlds/corgi/frames/orbit180.jpg',
};

export const STEPS = [
  { agent: 'spielberg', to: 'ebert', title: 'The opening shot', instruction: 'Generate an opening film from the brief. Return the playable film or an explicitly labeled frame artifact, together with camera and scene context.' },
  { agent: 'ebert', to: 'spielberg', title: 'A critique becomes direction', instruction: 'Critique the latest film artifact. Give concrete editorial direction and identify what must be preserved in the next version.' },
  { agent: 'spielberg', to: 'lucas', title: 'A revision becomes world context', instruction: 'Refine the cut using Ebert’s critique. Send Lucas the revised film, representative frames, and scene continuity constraints.' },
  { agent: 'lucas', to: 'bohr', title: 'The camera leaves the frame', instruction: 'Reconstruct the film as an explorable 3D world. Return a world URL or preview and the scene/camera metadata Bohr needs for inspection.' },
  { agent: 'bohr', to: null, title: 'The hidden defect becomes evidence', instruction: 'Inspect the world from multiple orbital camera positions. Record visible defects, their locations, the affected scene layer, and the required verification views.' },
  { agent: 'bohr', to: 'spielberg', title: 'A bounded repair returns to the filmmaker', instruction: 'Prepare a reversible repair candidate for the attributed defect. Compare the same camera before and after; report unresolved defects and regressions honestly.' },
  { agent: 'spielberg', to: 'ebert', title: 'A new angle becomes a new shot', instruction: 'Return to the latest repaired world and shoot a new angle. Return the film and camera pose, keeping candidate and verified world states distinct.' },
  { agent: 'ebert', to: null, title: 'The next critique closes the circle', instruction: 'Critique the new shot against the original brief and prior critique. Summarize demonstrated improvements, remaining problems, and the next revision. Include supplied SubQ evidence if available.' },
];

export const REPLAY = [
  { message: 'Corgaroo’s opening frame is ready. Ebert, preserve the corgi, red bicycle, bench and lemon tree as we leave this camera.', artifact: { id: 'opening', kind: 'image', title: 'Corgaroo / opening frame', url: MEDIA.opening, caption: 'The exact source photograph for the saved corgi garden. Replay uses a frame in place of a generated film.' } },
  { message: 'Keep Corgaroo recognizable. The next angle should reveal the space around him, while preserving the garden’s continuity.', artifact: { id: 'critique', kind: 'report', title: 'Ebert / continuity brief', text: 'SUBJECT: Corgaroo.\nKEEP: corgi, bicycle, bench, lemon tree.\nNEXT: inspect the reconstruction before choosing a new shot.', caption: 'Illustrative critique for the corgi rehearsal.' } },
  { message: 'Lucas, carry this frame and Ebert’s continuity brief into the world. We need a camera we can revisit, not another disconnected image.', artifact: { id: 'handoff', kind: 'image', title: 'Corgi scene context → Lucas', url: MEDIA.opening, caption: 'The same source frame is carried into the world handoff.' } },
  { message: 'The saved corgi garden is open in native 3D: Corgaroo, bicycle, bench, tree and surroundings are separate layers. Bohr, take the camera. You can also drag it yourself.', artifact: { id: 'world', kind: 'world', title: 'Lucas / Corgaroo’s garden', url: '/worlds/corgi/scene.json', viewer: 'splat', preset: 'source', caption: 'Existing corgi reconstruction, original transforms and source camera. No new generation in replay.' } },
  { message: 'I’m taking the camera around Corgaroo and isolating his layer. Inspect the unseen surface at 120° and 180°; a convincing source view alone cannot establish 3D continuity.', findings: [
    { title: 'Corgaroo / unseen-surface review', detail: 'Review the isolated corgi from 120° and 180°. These inspection requests are illustrative; a live Bohr call must return its own defect evidence.' },
    { title: 'Garden / source-camera comparison', detail: 'Use the aligned source-photo overlay to inspect the reconstruction’s silhouette, detail and placement.' },
  ], artifact: { id: 'inspection', kind: 'world', title: 'Bohr / Corgaroo at 120°', url: '/worlds/corgi/scene.json', viewer: 'splat', preset: 'orbit120', caption: 'Actual 3D orbital camera. Manual camera movement pauses agent camera changes.' } },
  { message: 'Spielberg, the inspection context is ready. A repair candidate still needs a live Bohr result and independent verification. Keep the saved world available while we choose the next angle.', artifact: { id: 'repair-brief', kind: 'report', title: 'Bohr / repair handoff', text: 'WORLD: Corgaroo’s garden.\nINSPECT: corgi orbitals and source alignment.\nREPAIR: awaiting a live candidate.\nVERIFY: revisit the same camera and neighboring views.', caption: 'Repair brief only. This replay does not modify the corgi world.' } },
  { message: 'Ebert, I’m back inside the same world, at Corgaroo’s new camera. You can orbit, save a frame and pass an exact camera brief to my independent agent.', artifact: { id: 'new-angle', kind: 'world', title: 'Spielberg / the next camera', url: '/worlds/corgi/scene.json', viewer: 'splat', preset: 'corgi', caption: 'A new viewpoint in the same saved 3D world. A live Spielberg run will supply the actual film.' } },
  { message: 'Corgaroo and the garden remain the shared subject across every handoff. The next live iteration should repair evidenced defects, shoot the chosen angle and return it for critique.', artifact: { id: 'review', kind: 'report', title: 'Ebert / next iteration', text: 'DEMONSTRATED: one shared corgi world, orbital cameras, manual shot selection and context handoffs.\nNEXT: live inspection → repair candidate → reshoot → critique.\nEVALUATION: awaiting SubQ evidence.', caption: 'Illustrative closing critique. Provider generation and evaluation run through live adapters.' } },
];
