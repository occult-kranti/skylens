// Recording-canvas checks protect geometry and high-risk overlay interactions.
// They do not substitute for browser screenshots or physical camera alignment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBasis } from '../js/astro.js';
import { createRenderer, PALETTES } from '../js/render.js';

function fixture(t, width = 390, height = 844) {
  const previousWindow = globalThis.window;
  const listeners = new Map(), calls = [];
  globalThis.window = { devicePixelRatio: 3,
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type, handler) => { if (listeners.get(type) === handler) listeners.delete(type); } };
  const ctx = { measureText: text => ({ width: Array.from(text).length * 6 }), globalAlpha: 1 };
  for (const op of ['setTransform', 'clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'arc', 'ellipse',
    'fill', 'stroke', 'fillText', 'strokeText', 'save', 'restore', 'translate', 'rotate', 'closePath', 'setLineDash']) {
    ctx[op] = (...args) => {
      for (const value of args.flat()) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${op}: ${value}`);
      calls.push({ op, args, ...(op === 'fillText' ? { color: ctx.fillStyle } : {}) });
    };
  }
  const canvas = { clientWidth: width, clientHeight: height, getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 10, top: 20 }) };
  const renderer = createRenderer(canvas);
  t.after(() => { renderer.dispose(); globalThis.window = previousWindow; });
  const scene = { basis: makeBasis(0, 0), centerAz: 0, tanH: .7, tanV: .7 * height / width,
    palette: PALETTES.normal, nameMode: 'bilingual', horizonOnly: false, cameraActive: false,
    layers: { grid: false, stars: true, bodies: true, labels: true, constellations: true, dsos: true, sats: true, planes: true },
    stars: [], bodies: [], constellations: [], dsos: [], sats: [], planes: [], highlight: null };
  calls.length = 0;
  return { renderer, scene, calls, canvas, listeners };
}

for (const [width, height] of [[390, 844], [844, 390]]) test(`camera and night markers preserve the exact projected hit position at ${width}×${height}`, t => {
  const { renderer, scene, calls, canvas, listeners } = fixture(t, width, height);
  const moon = Object.freeze({ id: 'body:Moon', kind: 'moon', name: 'Moon', alt: 0, az: 0, phase: .5 });
  scene.bodies = [moon]; scene.cameraActive = true; scene.palette = PALETTES.night;
  renderer.draw(scene);
  const marker = calls.find(c => c.op === 'arc' && c.args[2] === 6);
  assert.ok(marker); assert.equal(marker.args[0], width / 2); assert.equal(marker.args[1], height / 2);
  assert.equal(renderer.hitTest(width / 2 + 10, height / 2 + 20).data, moon);
  assert.equal(canvas.width, width * 2, 'DPR cap remains two');
  assert.equal(canvas.height, height * 2);
  assert.ok(calls.some(c => c.op === 'fillText' && c.args[0].includes('चंद्रमा') && c.color === PALETTES.night.moon));
  renderer.dispose(); assert.equal(listeners.size, 0);
});

test('selected Hindi label wins collisions and only camera guidance receives a scrim', t => {
  const { renderer, scene, calls } = fixture(t);
  const moon = { id: 'body:Moon', kind: 'moon', name: 'Moon', alt: 0, az: 0, phase: .5 };
  scene.bodies = [moon]; scene.highlight = moon;
  scene.stars = [{ id: 'star:Polaris', kind: 'star', name: 'Polaris', alt: 0, az: .1, mag: 1 }];
  renderer.draw(scene);
  assert.equal(calls.filter(c => c.op === 'fillText' && c.args[0] === 'चंद्रमा · Moon').length, 1);
  assert.equal(calls.filter(c => c.op === 'fillText' && c.args[0].includes('ध्रुव')).length, 0);
  assert.equal(calls.filter(c => c.op === 'fillRect').length, 0, 'no label panels in manual sky');
  calls.length = 0; scene.cameraActive = true; renderer.draw(scene);
  assert.equal(calls.filter(c => c.op === 'fillRect').length, 1, 'selected label receives one compact surface');
  assert.equal(renderer.hitTest(205, 442).data, moon, 'graphics do not add a separate hit target');
});

test('grid control owns cardinal guides and the zero-altitude horizon', t => {
  const { renderer, scene, calls } = fixture(t);
  renderer.draw(scene);
  assert.equal(calls.filter(c => c.op === 'fillText').length, 0);
  calls.length = 0; scene.layers.grid = true; scene.cameraActive = true; renderer.draw(scene);
  assert.ok(calls.some(c => c.op === 'fillText' && c.args[0] === 'N'));
  assert.ok(calls.some(c => c.op === 'setLineDash' && c.args[0].length), 'below-horizon grid has a distinct line pattern');
  assert.ok(calls.some(c => c.op === 'fillRect'), 'camera cardinal label has contrast backing');
});

test('selection and aim graphics are static for both motion preferences', t => {
  const { renderer, scene, calls } = fixture(t);
  scene.highlight = { name: 'Mars', kind: 'planet', alt: 0, az: 0 };
  scene.reducedMotion = false; renderer.draw(scene); const first = structuredClone(calls);
  calls.length = 0; scene.reducedMotion = true; renderer.draw(scene);
  assert.deepEqual(calls, first);
  const finalCrosshair = calls.slice(-11).filter(c => c.op === 'moveTo' || c.op === 'lineTo');
  assert.equal(finalCrosshair.length, 8);
  assert.ok(finalCrosshair.every(c => Math.hypot(c.args[0] - 195, c.args[1] - 422) >= 6), 'aim centre stays clear');
});

test('invalid coordinates cannot issue nonfinite canvas operations or become hittable', t => {
  const { renderer, scene, calls } = fixture(t);
  scene.stars = [
    { name: 'invalid', kind: 'star', alt: NaN, az: 0, mag: 1 },
    { name: 'below horizon', kind: 'star', alt: -1, az: 0, mag: 1 },
  ];
  scene.bodies = [{ name: 'invalid', kind: 'planet', alt: 0, az: Infinity }];
  scene.highlight = { name: 'invalid', alt: NaN, az: 0 }; scene.horizonOnly = true;
  renderer.draw(scene);
  assert.equal(calls.filter(c => c.op === 'arc').length, 0);
  assert.equal(renderer.hitTest(205, 442), null);
  calls.length = 0; scene.horizonOnly = false; renderer.draw(scene);
  assert.ok(calls.some(c => c.op === 'arc'));
  assert.equal(renderer.hitTest(205, 447).data.name, 'below horizon');
});
