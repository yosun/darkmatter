import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { h } from './dom.ts';
import type { Artifact, CameraPose } from '../shared/scenario.mjs';
import './world-viewer.css';

type Layer = { id?: string; name?: string; file: string; position: number[]; quaternion: number[]; scale: number };
type Garden = { title: string; world: string; source: { file: string }; camera: { fovY: number; aspect: number; up: number[]; target: number[] }; background: Layer; objects: Layer[] };
export const CORGI_WORLD = '/worlds/corgi/scene.json';

export function createWorldViewer(manifestUrl: string, onCameraBrief: (artifact: Artifact) => void) {
  let renderer: THREE.WebGLRenderer | undefined;
  let spark: SparkRenderer | undefined;
  let controls: OrbitControls | undefined;
  let camera: THREE.PerspectiveCamera | undefined;
  let scene: THREE.Scene | undefined;
  let config: Garden | undefined;
  let disposed = false, active = true, inView = true, setting = false, following = true, frame = 0;
  let currentPreset = 'source';
  const loaded = new Map<string, SplatMesh>();
  const abort = new AbortController();
  const status = h('p.wv-loading', { role: 'status' }, 'Opening Corgaroo’s garden…');
  const poseLabel = h('span.wv-pose-label', 'SOURCE CAMERA');
  const stage = h('div.wv-stage', { dataset: { ready: 'false' } }, status);
  const overlay = h('img.wv-overlay', { alt: '', 'aria-hidden': 'true', hidden: true });
  stage.append(overlay);
  const toolbar = h('div.wv-presets', { 'aria-label': '3D camera presets' });
  const follow = h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => {
    following = !following; paintFollow();
  } }, 'Following agents');
  const isolate = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => {
    stopFollowing(); setIsolated(isolate.getAttribute('aria-pressed') !== 'true'); hideOverlay();
  } }, 'Isolate Corgaroo');
  const photo = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => {
    stopFollowing();
    if (!overlay.hidden) hideOverlay();
    else { applyPreset('source'); overlay.hidden = false; photo.setAttribute('aria-pressed', 'true'); }
  } }, 'Photo overlay');
  const opacity = h('input', { type: 'range', min: 0, max: 100, value: 50, 'aria-label': 'Source photo opacity', oninput: () => { overlay.style.opacity = String(Number(opacity.value) / 100); } });
  const save = h('button', { type: 'button', onclick: () => {
    const pose = getPose(); if (!pose) return;
    download(new Blob([JSON.stringify({ world: config?.world, manifest: manifestUrl, camera: pose }, null, 2)], { type: 'application/json' }), 'darkmatter-camera.json');
    renderer!.render(scene!, camera!);
    renderer!.domElement.toBlob((blob) => { if (blob) download(blob, 'darkmatter-corgaroo-shot.png'); });
  } }, '↓ Save shot + camera');
  const send = h('button.wv-send', { type: 'button', onclick: () => {
    const pose = getPose(); if (!pose) return;
    onCameraBrief({ id: `camera-${Date.now()}`, kind: 'world', title: 'Your camera → Spielberg', url: manifestUrl, viewer: 'splat', camera: pose,
      caption: 'Manual camera brief. Run Spielberg independently with ↗ to pass this exact pose and visible layers to the agent.' });
    saved.textContent = 'Camera added to shared context. Use Spielberg’s ↗ to invoke him.';
  } }, 'Use this angle → Spielberg');
  const fullscreen = h('button', { type: 'button', 'aria-label': 'Expand 3D viewer', onclick: () => {
    void (document.fullscreenElement ? document.exitFullscreen() : element.requestFullscreen()).catch(() => { saved.textContent = 'Fullscreen is unavailable in this browser.'; });
  } }, '⛶');
  const saved = h('p.wv-feedback', { role: 'status' });
  const element = h('div.world-viewer', { dataset: { manifest: manifestUrl } },
    h('div.wv-top', h('div', h('strong', 'Corgaroo’s garden'), poseLabel), follow, fullscreen), toolbar, stage,
    h('div.wv-tools', isolate, photo, h('label.wv-opacity', 'Photo', opacity)),
    h('p.wv-hint', 'Drag to orbit · scroll / pinch to zoom · right-drag to pan · arrow keys to pan'),
    h('div.wv-actions', send, save), saved);
  const buttons = new Map<string, HTMLButtonElement>();
  for (const [id, label] of [['source', 'Original camera'], ['corgi', 'Meet Corgaroo'], ['orbit120', 'Orbit 120°'], ['orbit180', 'Orbit 180°'], ['bicycle', 'Bicycle']]) {
    const button = h('button', { type: 'button', 'aria-pressed': String(id === 'source'), onclick: () => { stopFollowing(); applyPreset(id); } }, label);
    buttons.set(id, button); toolbar.append(button);
  }
  const interactive = [...element.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input')];
  interactive.forEach((button) => { button.disabled = true; });

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob); h('a', { href: url, download: filename }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function paintFollow() { follow.setAttribute('aria-pressed', String(following)); follow.textContent = following ? 'Following agents' : 'Manual camera'; }
  function stopFollowing() { following = false; paintFollow(); }
  function hideOverlay() { overlay.hidden = true; photo.setAttribute('aria-pressed', 'false'); }
  function publishPose() {
    if (!camera || !controls) return;
    stage.dataset.position = camera.position.toArray().join(',');
    stage.dataset.quaternion = camera.quaternion.toArray().join(',');
    stage.dataset.target = controls.target.toArray().join(',');
    stage.dataset.preset = currentPreset;
    stage.dataset.layers = [...loaded].filter(([, mesh]) => mesh.visible).map(([id]) => id).join(',');
  }
  function getPose(): CameraPose | undefined {
    if (!camera || !controls || !config || stage.dataset.ready !== 'true') return;
    return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), target: controls.target.toArray(),
      fovY: camera.fov, up: camera.up.toArray(), aspect: camera.aspect,
      layers: [...loaded].filter(([, mesh]) => mesh.visible).map(([id]) => id) };
  }
  function setIsolated(value: boolean) {
    for (const [id, mesh] of loaded) mesh.visible = !value || id === 'corgi-dog';
    if (scene) scene.background = new THREE.Color(value ? '#d5d8d3' : '#18231b');
    isolate.setAttribute('aria-pressed', String(value)); publishPose();
  }
  function applyCamera(pose: CameraPose) {
    if (!camera || !controls) return;
    hideOverlay();
    setting = true;
    camera.position.fromArray(pose.position); camera.up.fromArray(pose.up);
    camera.fov = pose.fovY; camera.aspect = pose.aspect; stage.style.aspectRatio = String(pose.aspect);
    controls.target.fromArray(pose.target); controls.update();
    camera.position.fromArray(pose.position);
    camera.quaternion.fromArray(pose.quaternion).normalize(); camera.updateProjectionMatrix();
    if (pose.layers) for (const [id, mesh] of loaded) mesh.visible = pose.layers.includes(id);
    isolate.setAttribute('aria-pressed', String(pose.layers?.length === 1 && pose.layers[0] === 'corgi-dog'));
    if (scene) scene.background = new THREE.Color(loaded.get('garden')?.visible ? '#18231b' : '#d5d8d3');
    for (const button of buttons.values()) button.setAttribute('aria-pressed', 'false');
    setting = false; publishPose();
  }
  function applyPreset(id: string) {
    if (!camera || !controls || !config) return;
    hideOverlay(); setIsolated(id === 'orbit120' || id === 'orbit180');
    stage.style.aspectRatio = '3 / 2';
    setting = true; currentPreset = id;
    camera.up.fromArray(config.camera.up); camera.fov = config.camera.fovY;
    if (id === 'source') {
      camera.position.set(0, 0, 0);
      // The saved layers already include the OpenCV-to-world conversion.
      // Retain the provider camera, with its exact identity quaternion.
      controls.target.set(0, 0, -Math.max(1, Math.abs(config.camera.target[2])));
      controls.update(); camera.position.set(0, 0, 0); camera.quaternion.identity();
    } else {
      const object = config.objects.find((layer) => layer.id === (id === 'bicycle' ? 'red-vintage-bicycle' : 'corgi-dog'))!;
      const target = new THREE.Vector3().fromArray(object.position);
      const direction = target.clone().normalize().negate();
      const angle = id === 'orbit120' ? 2 * Math.PI / 3 : id === 'orbit180' ? Math.PI : 0;
      direction.applyAxisAngle(camera.up.clone().normalize(), angle);
      controls.target.copy(target); camera.position.copy(target).addScaledVector(direction, id === 'bicycle' ? 2.4 : angle ? 2.5 : 1.65);
      camera.fov = 45; controls.update();
    }
    camera.updateProjectionMatrix();
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === id));
    poseLabel.textContent = id === 'source' ? 'SOURCE CAMERA' : id === 'bicycle' ? 'BICYCLE INSPECTION' : id === 'corgi' ? 'CORGAROO / FRONT' : `CORGAROO / ${id === 'orbit120' ? '120°' : '180°'}`;
    setting = false; publishPose();
  }
  const resize = new ResizeObserver(() => {
    if (!renderer || !camera || !config || !stage.clientWidth) return;
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    camera.aspect = stage.clientWidth / stage.clientHeight; camera.updateProjectionMatrix();
  });
  resize.observe(stage);
  const visibility = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }); visibility.observe(element);
  const ready = (async () => {
    try {
      const response = await fetch(manifestUrl, { signal: abort.signal });
      if (!response.ok) throw new Error(`World manifest: HTTP ${response.status}`);
      config = await response.json() as Garden;
      const base = new URL(manifestUrl, location.href);
      overlay.src = new URL(config.source.file, base).href;
      renderer = new THREE.WebGLRenderer({ antialias: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', 'Interactive 3D corgi garden. Drag to rotate; scroll to zoom.');
      renderer.domElement.addEventListener('pointerdown', () => renderer?.domElement.focus({ preventScroll: true }));
      renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); status.hidden = false; status.textContent = '3D graphics interrupted. Reload to reopen the garden.'; });
      stage.prepend(renderer.domElement);
      scene = new THREE.Scene(); scene.background = new THREE.Color('#18231b');
      spark = new SparkRenderer({ renderer }); scene.add(spark);
      camera = new THREE.PerspectiveCamera(config.camera.fovY, config.camera.aspect, .02, 1000);
      camera.up.fromArray(config.camera.up);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = false; controls.minDistance = .3; controls.maxDistance = 12; controls.listenToKeyEvents(renderer.domElement);
      controls.addEventListener('start', () => { stopFollowing(); hideOverlay(); });
      controls.addEventListener('change', () => {
        if (!setting) {
          currentPreset = 'manual'; poseLabel.textContent = 'YOUR CAMERA'; stopFollowing(); hideOverlay();
          for (const button of buttons.values()) button.setAttribute('aria-pressed', 'false');
        }
        publishPose();
      });
      renderer.setSize(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight), false);
      camera.aspect = stage.clientHeight ? stage.clientWidth / stage.clientHeight : config.camera.aspect; camera.updateProjectionMatrix();
      let count = 0;
      await Promise.all([{ ...config.background, id: 'garden' }, ...config.objects].map(async (layer) => {
        const mesh = new SplatMesh({ url: new URL(layer.file, base).href });
        loaded.set(layer.id!, mesh);
        mesh.position.fromArray(layer.position); mesh.quaternion.fromArray(layer.quaternion); mesh.scale.setScalar(layer.scale);
        scene!.add(mesh); await mesh.initialized;
        if (disposed) return;
        status.textContent = `Opening Corgaroo’s garden · ${++count}/5 layers`;
      }));
      if (disposed) { for (const mesh of loaded.values()) mesh.dispose(); return; }
      applyPreset('source');
      const render = () => { if (disposed) return; frame = requestAnimationFrame(render); if (active && inView && !document.hidden) renderer!.render(scene!, camera!); };
      render();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      stage.dataset.ready = 'true'; stage.dataset.world = config.world; status.hidden = true;
      interactive.forEach((button) => { button.disabled = false; });
      publishPose();
    } catch (error) {
      if (disposed) return;
      stage.dataset.ready = 'error'; status.hidden = false;
      status.replaceChildren(h('span', 'The 3D garden could not open.'), h('a', { href: '/worlds/corgi/source.jpg', target: '_blank', rel: 'noopener' }, 'View the corgi source photo ↗'));
      console.error('Corgi viewer:', error);
    }
  })();
  return { element, ready,
    setActive(value: boolean) { active = value; },
    async show(artifact: Artifact, force = false) {
      await ready; if (disposed || (!following && !force)) return;
      if (artifact.camera) { currentPreset = 'saved'; applyCamera(artifact.camera); poseLabel.textContent = 'SAVED CAMERA'; }
      else applyPreset(artifact.preset || 'source');
    },
    dispose() { disposed = true; abort.abort(); cancelAnimationFrame(frame); resize.disconnect(); visibility.disconnect(); controls?.dispose();
      for (const mesh of loaded.values()) mesh.dispose(); spark?.dispose(); renderer?.dispose(); }
  };
}
