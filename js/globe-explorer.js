// Independently authored exploration helpers. Navigation is local: none of these
// functions reads storage, changes observer/feed consent, or contacts a provider.
export const GLOBE_PLACES = Object.freeze([
  ['New York',40.7128,-74.006], ['London',51.5074,-0.1278], ['Tokyo',35.6762,139.6503],
  ['Delhi',28.6139,77.209], ['Mumbai',19.076,72.8777], ['Sydney',-33.8688,151.2093],
  ['Singapore',1.3521,103.8198], ['Dubai',25.2048,55.2708], ['Paris',48.8566,2.3522],
  ['Los Angeles',34.0522,-118.2437], ['São Paulo',-23.5505,-46.6333], ['Cape Town',-33.9249,18.4241],
].map(([name,lat,lon]) => Object.freeze({name,lat,lon})));
const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const validPoint = (lat,lon) => Number.isFinite(lat) && Math.abs(lat)<=90 && Number.isFinite(lon) && Math.abs(lon)<=180;
export function resolveGlobePlace(text) {
  const query=normalize(text), place=GLOBE_PLACES.find(place => normalize(place.name)===query);
  if (place) return {...place};
  const match=query.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
  if (!match) return null;
  const lat=Number(match[1]),lon=Number(match[2]);
  return validPoint(lat,lon) ? {name:`${lat}, ${lon}`,lat,lon} : null;
}
export function readGlobeView(hash) {
  const params=new URLSearchParams(String(hash || '').replace(/^#/,''));
  const value=params.get('view');
  if (!value || params.getAll('view').length!==1 || params.getAll('style').length>1) return null;
  const parts=value.split(',');
  if (parts.length!==3 || parts.some(v => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v))) return null;
  const [centerLat,centerLon,zoom]=parts.map(Number);
  const style=params.get('style') || 'normal';
  if (!validPoint(centerLat,centerLon) || zoom<1 || zoom>32 || !['normal','night'].includes(style)) return null;
  return {centerLat,centerLon,zoom,night:style==='night'};
}
export function shareGlobeView(base,view,night=false) {
  const url=new URL(base);
  if (!['http:','https:'].includes(url.protocol) || !validPoint(view.centerLat,view.centerLon) || !Number.isFinite(view.zoom) || view.zoom<1 || view.zoom>32) throw new Error('This view cannot be shared.');
  // A fresh allowlisted fragment prevents receiver URLs, tokens, search text,
  // observer preferences, or unrelated query parameters entering shared links.
  url.username=''; url.password=''; url.search=''; url.hash='';
  url.hash=`view=${view.centerLat.toFixed(4)},${view.centerLon.toFixed(4)},${view.zoom.toFixed(3)}&style=${night?'night':'normal'}`;
  return url.href;
}
export function globeObjectMatches(object,{kind='all',query=''}={}) {
  const needle=String(query).trim().toLocaleLowerCase();
  return (kind==='all' || object.kind===kind) && (!needle || [object.name,object.id,object.flight,object.registration,object.hex].some(value=>String(value || '').toLocaleLowerCase().includes(needle)));
}
export function filterGlobeObjects(objects,filter,selectedId) {
  if (!filter?.enabled) return objects;
  return objects.filter(object=>object.id===selectedId || globeObjectMatches(object,filter));
}
