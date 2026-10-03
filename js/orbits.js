// Heliocentric ecliptic positions from the same Astronomy Engine as the sky.
// Diagram distances are linear AU within each chosen range. Marker sizes are symbolic.
import * as AE from '../vendor/astronomy.js';

const BODIES = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
const rangeByHost = new WeakMap();
export function heliocentricSnapshot(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new RangeError('Choose a valid UTC instant.');
  return BODIES.map(name => {
    const v = AE.HelioVector(name, date), e = AE.Ecliptic(v);
    return { name, x: e.vec.x, y: e.vec.y, z: e.vec.z, distanceAU: v.Length(), longitude: e.elon };
  });
}

export function renderOrbit(host, date, outer = rangeByHost.get(host) || false) {
  const restoreRangeFocus = host.contains(document.activeElement) && document.activeElement?.dataset.orbitRange === 'true';
  rangeByHost.set(host, outer);
  const bodies = heliocentricSnapshot(date).filter((_, i) => outer || i < 4);
  const maxAU = outer ? 32 : 1.8, scale = 150 / maxAU;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 420 370'); svg.setAttribute('role', 'img');
  const title = document.createElementNS(ns, 'title'); title.textContent = `Solar system on ${date.toISOString()}. Top view north of the ecliptic; linear distance scale.`;
  svg.append(title);
  const el = (tag, attrs, text) => { const node = document.createElementNS(ns, tag); for (const [k,v] of Object.entries(attrs)) node.setAttribute(k,String(v)); if(text)node.textContent=text; svg.append(node); return node; };
  el('line',{x1:30,y1:185,x2:390,y2:185,stroke:'#465363','stroke-width':0.5});
  el('line',{x1:210,y1:25,x2:210,y2:345,stroke:'#465363','stroke-width':0.5});
  el('circle',{cx:210,cy:185,r:6,fill:'#ffd27e'}); el('text',{x:220,y:201,fill:'#ffd27e','font-size':12},'Sun');
  // Reference distance rings, explicitly not orbital trajectories.
  for(const au of (outer ? [10,20,30] : [0.5,1,1.5])) {
    el('circle',{cx:210,cy:185,r:au*scale,fill:'none',stroke:'#465363','stroke-dasharray':'2 5'});
    el('text',{x:212,y:185-au*scale-4,fill:'#aab7c7','font-size':11},`${au} AU`);
  }
  const positions=[];
  for(const b of bodies){
    const x=210+b.x*scale,y=185-b.y*scale;
    el('circle',{cx:x,cy:y,r:b.name==='Earth'?5:3.5,fill:b.name==='Earth'?'#71d3ff':'#e5d9c8'});
    // Stable label displacement; matching numerical table remains authoritative.
    let ly=y-9; for(let i=0;i<12&&positions.some(p=>Math.abs(p.x-x)<62&&Math.abs(p.y-ly)<14);i++)ly+=15;
    positions.push({x,y:ly});
    el('text',{x:Math.min(352,Math.max(8,x+7)),y:Math.max(14,Math.min(357,ly)),fill:'#e7edf5','font-size':12},b.name);
  }
  const table=document.createElement('table'); table.className='orbit-table';
  const cap=table.createCaption();cap.textContent='Heliocentric distances (AU) and ecliptic longitude (degrees of date)';
  const head=table.createTHead().insertRow(); for(const v of ['Planet','Distance / AU','Longitude / °']){const th=document.createElement('th');th.textContent=v;th.scope='col';head.append(th);}
  const body=table.createTBody();for(const b of bodies){const row=body.insertRow();for(const v of [b.name,b.distanceAU.toFixed(3),b.longitude.toFixed(2)])row.insertCell().textContent=v;}
  const note=document.createElement('p');note.className='meta';note.textContent=`${date.toISOString().slice(0,16).replace('T',' ')} UTC. Distances to scale within this view; planet sizes are enlarged symbols. Dashed circles are distance guides, not orbital paths. Out-of-plane distance is omitted. 1 AU ≈ 149.6 million km. Educational view, Astronomy Engine.`;
  const toggle=document.createElement('button');toggle.type='button';toggle.className='pill';toggle.dataset.orbitRange='true';toggle.textContent=outer?'Show inner planets':'Show all planets';toggle.addEventListener('click',()=>renderOrbit(host,date,!outer));
  host.replaceChildren(toggle,svg,note,table);
  if (restoreRangeFocus) toggle.focus({ preventScroll: true });
}
