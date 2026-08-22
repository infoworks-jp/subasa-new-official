import WebGLFluidEnhanced from './vendor/webgl-fluid-enhanced-0.8.0.es.js';

const stage = document.querySelector('#stage');
const simulationHost = document.querySelector('#simulation');
const canvas = document.querySelector('#fluid');
const gesture = document.querySelector('#gesture');
const marker = document.querySelector('#root');
const status = document.querySelector('#status');

const IMAGE = { width: 1440, height: 960, rootX: 930, rootY: 590, positionX: 0.66, positionY: 0.5 };
const PARAMETERS = {
  densityDissipation: 3.2,
  velocityDissipation: 0.62,
  simResolution: 96,
  dyeResolution: 384,
  pressureIterations: 14,
  curl: 18,
  splatRadius: 0.028,
  splatForce: 3200,
  bloom: false,
  sunrays: false,
  shading: false,
  transparent: true,
  colorful: false,
  brightness: 0.02,
  colorPalette: ['#010101'],
  hover: false,
};

const simulation = new WebGLFluidEnhanced(simulationHost);
simulation.setConfig(PARAMETERS);
simulation.start();

const state = window.__steamEnhanced = {
  library: 'webgl-fluid-enhanced@0.8.0', parameters: PARAMETERS, root: null,
  pointerDown: 0, pointerMove: 0, pointerUp: 0, splats: 0, errors: 0,
  bloom: false, sunrays: false, scrollSafe: true,
};
stage.dataset.library = state.library;
stage.dataset.densityDissipation = String(PARAMETERS.densityDissipation);
stage.dataset.velocityDissipation = String(PARAMETERS.velocityDissipation);
stage.dataset.errors = '0';
stage.dataset.splats = '0';
function noteError() { state.errors++; stage.dataset.errors = String(state.errors); }
addEventListener('error', noteError);
addEventListener('unhandledrejection', noteError);

function coverPoint() {
  const box = stage.getBoundingClientRect();
  const scale = Math.max(box.width / IMAGE.width, box.height / IMAGE.height);
  const drawnW = IMAGE.width * scale;
  const drawnH = IMAGE.height * scale;
  const left = (box.width - drawnW) * IMAGE.positionX;
  const top = (box.height - drawnH) * IMAGE.positionY;
  return { x: left + IMAGE.rootX * scale, y: top + IMAGE.rootY * scale, scale, width: box.width, height: box.height };
}

function updateRoot() {
  const p = coverPoint();
  state.root = p;
  stage.dataset.root = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  marker.style.left = `${p.x}px`;
  marker.style.top = `${p.y}px`;
}

function splat(x, y, dx, dy, color = '#010101') {
  const dpr = canvas.width / Math.max(1, canvas.clientWidth);
  simulation.splatAtLocation(x * dpr, y, dx, dy, color);
  state.splats++;
  stage.dataset.splats = String(state.splats);
}

let plumeTick = 0;
function emit() {
  const p = coverPoint();
  plumeTick++;
  const drift = Math.sin(plumeTick * 0.47) * 12 + Math.sin(plumeTick * 0.19) * 7;
  splat(p.x + Math.sin(plumeTick * 0.71) * 5, p.y, drift, 58 + Math.cos(plumeTick * 0.33) * 8, '#010101');
}

let active = null;
gesture.addEventListener('pointerdown', (event) => {
  active = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, axis: null, t: performance.now() };
  gesture.setPointerCapture?.(event.pointerId);
  state.pointerDown++;
  event.preventDefault();
}, { passive: false });
gesture.addEventListener('pointermove', (event) => {
  if (!active || active.id !== event.pointerId) return;
  const now = performance.now();
  const dt = Math.max(8, now - active.t);
  const dx = event.clientX - active.x;
  const dy = event.clientY - active.y;
  if (!active.axis && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 7) {
    active.axis = Math.abs(event.clientX - active.startX) >= Math.abs(event.clientY - active.startY) ? 'steam' : 'scroll';
  }
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    if (active.axis === 'scroll' && parent !== window) {
      parent.scrollBy(0, -dy);
    } else if (active.axis === 'steam' || parent === window) {
      splat(event.clientX, event.clientY, dx / dt * 1250, -dy / dt * 1250, '#010101');
      state.pointerMove++;
      stage.dataset.pointerMoves = String(state.pointerMove);
    }
  }
  active.x = event.clientX; active.y = event.clientY; active.t = now;
  event.preventDefault();
}, { passive: false });
function end(event) { if (active?.id === event.pointerId) { try { gesture.releasePointerCapture?.(event.pointerId); } catch {} active = null; state.pointerUp++; } }
gesture.addEventListener('pointerup', end, { passive: false });
gesture.addEventListener('pointercancel', end, { passive: false });
gesture.addEventListener('wheel', (event) => { if (parent !== window) { parent.scrollBy(0, event.deltaY); event.preventDefault(); } }, { passive: false });

const viewport = window.visualViewport;
addEventListener('resize', updateRoot, { passive: true });
viewport?.addEventListener('resize', updateRoot, { passive: true });
viewport?.addEventListener('scroll', updateRoot, { passive: true });
new ResizeObserver(updateRoot).observe(stage);
updateRoot();
setInterval(emit, 280);
setTimeout(() => { status.textContent = 'Enhanced / drag steam'; }, 900);
if (new URLSearchParams(location.search).has('debug')) stage.classList.add('debug');
addEventListener('beforeunload', () => simulation.stop());
