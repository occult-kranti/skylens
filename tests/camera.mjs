// Independent frame fixtures from W3C Device Orientation appendix; lifecycle mocks
// verify ownership, not physical camera alignment. Run: node tests/camera.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as X from '../js/astro.js';
import * as S from '../js/sensors.js';
import { layoutLabels } from '../js/render.js';
const near = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) <= epsilon, `${a} vs ${b}`);
const vectorNear = (a, b) => a.forEach((v, i) => near(v, b[i]));
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

// Independently expand the normative intrinsic Z-X-Y matrix in ENU; app is EUS.
function w3cFrame(alpha, beta, gamma, orientation) {
  const r = Math.PI / 180;
  const ca = Math.cos(alpha*r), sa = Math.sin(alpha*r), cb = Math.cos(beta*r), sb = Math.sin(beta*r);
  const cg = Math.cos(gamma*r), sg = Math.sin(gamma*r), co = Math.cos(orientation*r), so = Math.sin(orientation*r);
  const fwd = [-ca*sg-sa*sb*cg, -cb*cg, sa*sg-ca*sb*cg];
  const right = [ca*cg-sa*sb*sg, -cb*sg, -sa*cg-ca*sb*sg];
  const up = [-sa*cb, sb, -ca*cb];
  return { fwd, right: right.map((v,i) => v*co-up[i]*so), up: right.map((v,i) => v*so+up[i]*co) };
}
for (const angles of [[0,90,0,0],[90,90,0,0],[270,90,0,0],[0,0,0,0],[35,62,-17,90],[123,-45,27,270],[0,180,0,180]]) {
  test(`W3C independent matrix ${angles.join('/')}`, () => {
    const actual = X.attitudeFromSensors(...angles), reference = w3cFrame(...angles);
    for (const key of ['fwd','right','up']) vectorNear(actual[key], reference[key]);
  });
}

test('screen rotation preserves boresight and changes right/up', () => {
  const portrait = X.attitudeFromSensors(0,90,0,0), landscape = X.attitudeFromSensors(0,90,0,90);
  vectorNear(portrait.fwd, landscape.fwd);
  vectorNear(landscape.right, [0,-1,0]);
  vectorNear(landscape.up, [1,0,0]);
});
const northSample = { alpha: 0, beta: 90, gamma: 0, orient: 0 };
test('heading and pitch calibration correct the projected camera basis', () => {
  const basis = X.correctedAttitude(northSample, { headingOffset: 90, pitchOffset: 20 });
  near(basis.az,90); near(basis.alt,20);
  const p = X.projectVec(X.vecFromAltAz(20,90), basis,0.5,0.5,400,400);
  near(p.x,200); near(p.y,200);
});
test('WebKit heading affects overlay basis, not only telemetry', () => {
  const b = X.correctedAttitude({ ...northSample, alpha: 123, compassHeading: 90 });
  near(b.az,90); vectorNear(b.fwd,[1,0,0]);
});
test('front camera unmirrored basis looks opposite rear lens', () => {
  const b = X.correctedAttitude(northSample, { frontCamera: true });
  near(b.az,180); vectorNear(b.right,[-1,0,0]); vectorNear(b.up,[0,1,0]);
});
test('smoothing traverses north wrap rather than south', () => {
  const prior = X.makeBasis(359,10), target = X.makeBasis(1,10);
  const b = X.smoothAttitude(prior,target,70*Math.log(2));
  assert.ok(b.az < 0.01 || b.az > 359.99);
  near(dot(b.fwd,b.right),0); near(dot(b.fwd,b.up),0); near(dot(b.right,b.up),0);
  near(Math.hypot(...b.fwd),1); near(Math.hypot(...b.right),1);
});
test('smoothing handles sensor restart and opposite-frame jump without NaN', () => {
  const target = X.makeBasis(180,0);
  assert.equal(X.smoothAttitude(X.makeBasis(0,0),target,16), target);
  assert.equal(X.smoothAttitude(X.makeBasis(170,0),target,501), target);
});
test('diagonal FOV and CSS cover crop match independent pixel geometry', () => {
  const fov = X.cameraFov(60,400,800,1920,1080);
  const sourceFocal = Math.sqrt(1920**2+1080**2)/(2*Math.tan(Math.PI/6));
  near(fov.tanH,400/(2*sourceFocal*(800/1080)));
  near(fov.tanV,800/(2*sourceFocal*(800/1080)));
  near(fov.tanH / fov.tanV,0.5);
});
test('camera FOV rotates dimensions consistently', () => {
  const a = X.cameraFov(70,400,800,1080,1920), b = X.cameraFov(70,800,400,1920,1080);
  near(a.tanH,b.tanV); near(a.tanV,b.tanH);
  assert.ok(Number.isFinite(X.cameraFov(60,0,0,0,0).tanH));
});
test('labels honor selected priority, rectangle collisions, bounds and budget', () => {
  const mk = (key,x,priority) => ({ key,x,y:60,width:80,height:12,priority });
  const laid = layoutLabels([mk('star',70,5),mk('selected',75,100),mk('far',210,10),mk('clipped',0,101)],300,200,2);
  assert.deepEqual(laid.map(v => v.key),['selected','far']);
});

function installHardware(getUserMedia) {
  const handlers = new Map();
  globalThis.window = {
    isSecureContext: true, orientation: 0,
    addEventListener(type, cb) { if (!handlers.has(type)) handlers.set(type,new Set()); handlers.get(type).add(cb); },
    removeEventListener(type,cb) { handlers.get(type)?.delete(cb); },
  };
  Object.defineProperty(globalThis,'screen',{ configurable:true,value:{ orientation:{angle:90} } });
  Object.defineProperty(globalThis,'navigator',{ configurable:true,value:{ mediaDevices:{getUserMedia} } });
  return { handlers, emit(type,event) { for (const cb of handlers.get(type)||[]) cb(event); } };
}
function fakeStream({ facingMode = 'environment' } = {}) {
  const listeners = new Map();
  const track = { readyState:'live', stopped:0, stop() { this.stopped++; this.readyState='ended'; },
    getSettings:()=>({ facingMode,width:1920,height:1080 }),
    addEventListener:(t,cb)=>listeners.set(t,cb), removeEventListener:(t)=>listeners.delete(t) };
  return { getTracks:()=>[track],getVideoTracks:()=>[track],track,listeners };
}
const fakeVideo = () => ({ srcObject:null, paused:0, play:async()=>{}, pause(){ this.paused++; } });

test('first absolute event is absolute and null sensors are ignored', () => {
  const h = installHardware(), samples=[]; const handle = S.startOrientation(v=>samples.push(v));
  h.emit('deviceorientationabsolute',{alpha:0,beta:90,gamma:0});
  assert.equal(samples[0].absolute,true); assert.equal(samples[0].headingSource,'absolute-sensor'); assert.equal(samples[0].orient,90);
  h.emit('deviceorientation',{alpha:null,beta:90,gamma:0}); assert.equal(samples.length,1);
  handle.stop(); assert.equal(handle.latest(),null);
  assert.ok([...h.handlers.values()].every(s=>s.size===0));
});
test('relative and magnetic compass provenance are explicit', () => {
  const h = installHardware(), samples=[]; const handle = S.startOrientation(v=>samples.push(v));
  h.emit('deviceorientation',{alpha:10,beta:90,gamma:0,absolute:false});
  assert.equal(samples[0].headingSource,'relative'); assert.equal(samples[0].absolute,false);
  h.emit('deviceorientation',{alpha:10,beta:90,gamma:0,webkitCompassHeading:120,webkitCompassAccuracy:25});
  assert.equal(samples[1].headingSource,'magnetic-compass'); assert.equal(samples[1].compassAcc,25);
  handle.stop();
});
test('motion permission invoked synchronously with absolute request', async () => {
  let called=false;
  globalThis.DeviceOrientationEvent={ requestPermission(absolute) { called=true; assert.equal(absolute,true); return Promise.resolve('granted'); } };
  const p=S.requestMotionPermission(); assert.equal(called,true); assert.equal(await p,'granted');
  delete globalThis.DeviceOrientationEvent;
});
test('camera requests rear preference and audio disabled; stop is idempotent', async () => {
  const stream=fakeStream(); installHardware(async (constraints)=> { assert.equal(constraints.audio,false); assert.equal(constraints.video.facingMode.ideal,'environment'); return stream; });
  const video=fakeVideo(), session=await S.startCamera(video);
  assert.equal(session.ok,true); assert.equal(session.facingMode,'environment');
  session.stop(); session.stop(); assert.equal(stream.track.stopped,1); assert.equal(video.srcObject,null); assert.equal(stream.listeners.size,0);
});
test('video play failure releases acquired camera track', async () => {
  const stream=fakeStream(); installHardware(async()=>stream); const video=fakeVideo();
  video.play=async()=>{ throw {name:'NotAllowedError'}; };
  const result=await S.startCamera(video);
  assert.equal(result.ok,false); assert.equal(result.reason,'NotAllowedError'); assert.equal(stream.track.stopped,1); assert.equal(video.srcObject,null);
});
test('permission denial reports reason without fabricating a stream', async () => {
  installHardware(async()=>{ throw {name:'NotAllowedError'}; });
  const video=fakeVideo(), result=await S.startCamera(video);
  assert.equal(result.reason,'NotAllowedError'); assert.equal(video.srcObject,null);
});
test('camera revocation clears video and notifies owner', async () => {
  const stream=fakeStream(); installHardware(async()=>stream); const video=fakeVideo(); let ended=0;
  await S.startCamera(video,{onEnded:()=>ended++}); stream.listeners.get('ended')();
  assert.equal(video.srcObject,null); assert.equal(ended,1); assert.equal(stream.listeners.size,0);
});
test('front fallback reported explicitly from actual track settings', async () => {
  installHardware(async()=>fakeStream({facingMode:'user'}));
  const session=await S.startCamera(fakeVideo()); assert.equal(session.facingMode,'user'); session.stop();
});
test('stop while permission prompt is pending releases late grant', async () => {
  let grant; installHardware(()=>new Promise(resolve=>{grant=resolve;}));
  const video=fakeVideo(), pending=S.startCamera(video); S.stopCamera(video); const stream=fakeStream(); grant(stream);
  const result=await pending;
  assert.equal(result.reason,'cancelled'); assert.equal(stream.track.stopped,1); assert.equal(video.srcObject,null);
});
test('overlapping starts never attach the older stream', async () => {
  const grants=[]; installHardware(()=>new Promise(resolve=>grants.push(resolve)));
  const video=fakeVideo(), older=S.startCamera(video), newer=S.startCamera(video), stream2=fakeStream();
  grants[1](stream2); const session=await newer;
  const stream1=fakeStream(); grants[0](stream1); const result=await older;
  assert.equal(result.reason,'cancelled'); assert.equal(stream1.track.stopped,1); assert.equal(video.srcObject,stream2); session.stop();
});
