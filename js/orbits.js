// Heliocentric ecliptic positions from the same Astronomy Engine as the sky.
// Diagram distances are linear AU within each chosen range. Marker sizes are symbolic.
import * as AE from '../vendor/astronomy.js';
import { objectNameRecord, displayName } from './names.js';

const BODIES = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
const rangeByHost = new WeakMap();
export function heliocentricSnapshot(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new RangeError('Choose a valid UTC instant.');
  return BODIES.map(name => {
    const v = AE.HelioVector(name, date), e = AE.Ecliptic(v);
    return { name, x: e.vec.x, y: e.vec.y, z: e.vec.z, distanceAU: v.Length(), longitude: e.elon };
  });
}

export function renderOrbit(host, date, outer = rangeByHost.get(host) || false, nameMode = 'bilingual') {
  const restoreRangeFocus = host.contains(document.activeElement) && document.activeElement?.dataset.orbitRange === 'true';
  rangeByHost.set(host, outer);
  const bodies = heliocentricSnapshot(date).filter((_, i) => outer || i < 4);
  const maxAU = outer ? 32 : 1.8, scale = 150 / maxAU;
  const ns = 'http://www.w3.org/2000/svg';
  const setName = (element, object) => {
    const record = objectNameRecord(object), svgText = element.namespaceURI === ns;
    const append = (text, lang) => {
      const part = svgText ? document.createElementNS(ns, 'tspan') : document.createElement('span');
      part.setAttribute('lang', lang); part.textContent = text; element.append(part);
    };
    if (record.hindi && nameMode !== 'en') {
      append(record.hindi, 'hi');
      if (nameMode === 'hi') return element;
      element.append(document.createTextNode(' · '));
    }
    append(record.english, 'en');
    return element;
  };
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 420 370'); svg.setAttribute('role', 'img');
  const title = document.createElementNS(ns, 'title'); title.textContent = `Solar system on ${date.toISOString()}. Top view north of the ecliptic; linear distance scale.`;
  svg.append(title);
  const el = (tag, attrs, text) => { const node = document.createElementNS(ns, tag); for (const [k,v] of Object.entries(attrs)) node.setAttribute(k,String(v)); if(text)node.textContent=text; svg.append(node); return node; };
  el('line',{x1:30,y1:185,x2:390,y2:185,stroke:'#465363','stroke-width':0.5});
  el('line',{x1:210,y1:25,x2:210,y2:345,stroke:'#465363','stroke-width':0.5});
  el('circle',{cx:210,cy:185,r:6,fill:'#ffd27e'});
  const occupied = [];
  const overlaps = (a, b) => a.x < b.x + b.w + 4 && a.x + a.w + 4 > b.x && a.y < b.y + b.h + 3 && a.y + a.h + 3 > b.y;
  // Reference distance rings, explicitly not orbital trajectories.
  for(const au of (outer ? [10,20,30] : [0.5,1,1.5])) {
    el('circle',{cx:210,cy:185,r:au*scale,fill:'none',stroke:'#465363','stroke-dasharray':'2 5'});
    const baseline = 185-au*scale-4;
    el('text',{x:212,y:baseline,fill:'#aab7c7','font-size':11},`${au} AU`);
    occupied.push({x:210,y:baseline-13,w:48,h:16});
  }
  const points = [{ name:'Sun', x:210, y:185, color:'#ffd27e' }, ...bodies.map(b => ({...b, x:210+b.x*scale, y:185-b.y*scale, color:'#e7edf5'}))];
  for (const b of points) {
    if (b.name !== 'Sun') el('circle',{cx:b.x,cy:b.y,r:b.name==='Earth'?5:3.5,fill:b.name==='Earth'?'#71d3ff':'#e5d9c8'});
    occupied.push({x:b.x-6,y:b.y-6,w:12,h:12});
  }
  for (const b of points) {
    // Conservative mixed-script width estimate; reserve reference labels and
    // every marker before placing names. Leaders keep displaced labels attached
    // to the true projected point rather than changing scientific coordinates.
    const width = Math.min(174, Math.max(45, Array.from(displayName(b, nameMode)).length * 8));
    const left = Math.min(412-width, Math.max(8, b.x+10));
    const candidates = [];
    for (let shift=0; shift<=180; shift+=22) for (const sign of [-1,1]) {
      const baseline = Math.max(18, Math.min(354, b.y-10+sign*shift));
      for (const x of [left, Math.max(8,b.x-width-10)]) candidates.push({x,y:baseline-15,w:width,h:19});
    }
    const rect = candidates.find(a => !occupied.some(o => overlaps(a,o))) || {x:8,y:335,w:width,h:19};
    occupied.push(rect);
    const baseline=rect.y+15;
    const endX=Math.min(rect.x+rect.w,Math.max(rect.x,b.x));
    el('line',{x1:b.x,y1:b.y,x2:endX,y2:baseline-5,stroke:b.color,'stroke-opacity':.45,'stroke-width':.7});
    setName(el('text',{x:rect.x,y:baseline,fill:b.color,'font-size':12}),b);
  }
  const table=document.createElement('table'); table.className='orbit-table';
  const cap=table.createCaption();cap.textContent='Heliocentric distances (AU) and ecliptic longitude (degrees of date)';
  const head=table.createTHead().insertRow(); for(const v of ['Planet','Distance / AU','Longitude / °']){const th=document.createElement('th');th.textContent=v;th.scope='col';head.append(th);}
  const body=table.createTBody();for(const b of bodies){const row=body.insertRow();setName(row.insertCell(),b);for(const v of [b.distanceAU.toFixed(3),b.longitude.toFixed(2)])row.insertCell().textContent=v;}
  const note=document.createElement('p');note.className='meta';note.textContent=`${date.toISOString().slice(0,16).replace('T',' ')} UTC. Distances to scale within this view; planet sizes are enlarged symbols. Dashed circles are distance guides, not orbital paths. Out-of-plane distance is omitted. 1 AU ≈ 149.6 million km. Educational view, Astronomy Engine.`;
  const toggle=document.createElement('button');toggle.type='button';toggle.className='pill';toggle.dataset.orbitRange='true';toggle.textContent=outer?'Show inner planets':'Show all planets';toggle.addEventListener('click',()=>renderOrbit(host,date,!outer,nameMode));
  host.replaceChildren(toggle,svg,note,table);
  if (restoreRangeFocus) toggle.focus({ preventScroll: true });
}
