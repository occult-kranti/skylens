// SkyLens Globe controls. All remote values are text, never markup.
const $ = id => document.getElementById(id);
const finite = (v, digits = 1) => Number.isFinite(v) ? v.toFixed(digits) : '—';
const utc = value => { const d = new Date(value); return value != null && Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 19).replace('T', ' ') + ' UTC' : 'Unavailable'; };
const node = (tag, text, className) => { const el = document.createElement(tag); if (text != null) el.textContent = String(text); if (className) el.className = className; return el; };
const coordinate = (value, axis) => `${finite(Math.abs(value), 2)}° ${axis === 'lat' ? value < 0 ? 'S' : 'N' : value < 0 ? 'W' : 'E'}`;

export function createGlobeUI(handlers = {}) {
  let state = { view:{ centerLat:0, centerLon:0, zoom:1 }, layers:{ planes:false, sats:false }, objects:[], feed:{} };
  let panelOpen = false, panelName = 'objects', areaInitialized = false, lastSelected = null;
  let destroyed = false, noticeTimer = null, lastError = '', resizeObserver = null;
  let currentObjects = new Map(), listSignature = '', selectionRecord = null;
  const listeners = [], pointers = new Map();
  let drag = null, pinch = null;
  const canvas = $('globeCanvas');
  const on = (target, event, handler, options) => { target.addEventListener(event, handler, options); listeners.push(() => target.removeEventListener(event, handler, options)); };
  function invoke(name, ...args) {
    try {
      const result = handlers[name]?.(...args);
      if (result?.then) result.catch(error => { if (!destroyed) announce(error?.message || 'This action could not be completed.', true); });
      return result;
    } catch (error) { announce(error?.message || 'This action could not be completed.', true); }
  }
  function announce(message, error = false) {
    if (destroyed) return;
    clearTimeout(noticeTimer);
    const status = $('globeStatus'); status.textContent = String(message || ''); status.hidden = !message; status.dataset.error = String(error);
    noticeTimer = setTimeout(() => { status.hidden = true; noticeTimer = null; }, error ? 9000 : 5000);
  }
  function measure() {
    document.documentElement.style.setProperty('--header-bottom', `${Math.ceil(document.querySelector('.globe-header').getBoundingClientRect().bottom)}px`);
  }
  function setPanel(name = panelName, open = true, focus = false) {
    panelOpen = open; panelName = name;
    $('globePanel').classList.toggle('open', open); document.body.classList.toggle('panel-open', open);
    $('globePanelBody').hidden = !open; $('globePanelToggle').setAttribute('aria-expanded', String(open));
    $('globePanelTitle').textContent = !open ? 'Objects & data' : name === 'details' ? 'Selected object' : name === 'data' ? 'Data & coverage' : 'Loaded objects';
    $('globeObjectsPanel').hidden = name !== 'objects'; $('globeDataPanel').hidden = name !== 'data'; $('globeDetails').hidden = name !== 'details';
    for (const [id, key] of [['globeObjectsTab','objects'],['globeDataTab','data']]) {
      const active = name === key || (name === 'details' && key === 'objects'); $(id).setAttribute('aria-selected', String(active)); $(id).tabIndex = active ? 0 : -1;
    }
    $('globeStopFollow').hidden = !state.following || (open && name === 'details');
    if (open && name === 'objects') renderList();
    if (open && name === 'data' && !areaInitialized) copyMapCentre();
    if (focus) (open ? $(name === 'objects' ? 'globeSearch' : name === 'data' ? 'globeDataTab' : 'globeObjectName') : $('globePanelToggle')).focus({ preventScroll:true });
    measure();
  }
  function copyMapCentre() {
    $('globeAreaLat').value = finite(state.view?.centerLat ?? 0, 4);
    $('globeAreaLon').value = finite(state.view?.centerLon ?? 0, 4);
    areaInitialized = true;
  }
  function providerHelp() {
    $('globeProviderHelp').textContent = $('globeProvider').value === 'avioadsb'
      ? 'AvioADSB: anonymous access, 100 requests/day shared per network, at least 10 seconds between requests. This app polls about every 12 seconds; a full allowance lasts about 20 active minutes. Regional coverage only; not for navigation.'
      : 'adsb.fi: experimental; browser delivery is unverified. Personal, noncommercial use only. This app polls about every 5 seconds. No automatic fallback to another recipient.';
  }
  function scopeLabel(feed = {}) {
    if (feed.coverage?.kind === 'regional') return `${feed.coverage.rangeNm ?? '—'} nm region`;
    if (feed.coverage?.kind) return feed.coverage.label || 'Connected source · coverage unverified';
    return 'No area loaded';
  }
  function feedLabel() {
    const feed = state.feed || {};
    const labels = { loading:'Loading aircraft', error:'Aircraft unavailable', unavailable:'Provider unavailable', limited:'API limit · paused', paused:'Aircraft paused', connecting:'Connecting receiver', 'location-needed':'Choose an area', off:'Choose an aircraft area' };
    if (['error','unavailable','limited'].includes(feed.status)) return labels[feed.status];
    if (!state.layers?.planes) return 'Aircraft off';
    return labels[feed.status] || `${scopeLabel(feed)} · ${state.objects.filter(o => o.kind === 'plane').length} reports`;
  }
  function renderFeed() {
    const feed = state.feed || {}, coverage = feed.coverage || {};
    $('globeFeedStatus').textContent = feedLabel(); $('globeCoverage').dataset.state = feed.status || 'off';
    const receiptAge = Number.isFinite(feed.receivedAt) ? Math.max(0, Math.round((Date.now() - feed.receivedAt) / 1000)) : null;
    const parts = [feed.sourceName || 'No aircraft source connected', scopeLabel(feed)];
    if (coverage.kind === 'regional' && coverage.center) parts.push(`Query centre ${coordinate(coverage.center.lat,'lat')}, ${coordinate(coverage.center.lon,'lon')}. Panning does not move this query.`);
    if (coverage.kind && coverage.kind !== 'regional') parts.push('Coverage is supplied by this source and is not independently verified.');
    if (receiptAge !== null) parts.push(`Response received ${receiptAge} s ago`);
    if (feed.providerAt) parts.push(`Provider snapshot ${utc(feed.providerAt)}`);
    if (Number.isFinite(feed.remaining)) parts.push(`${feed.remaining} provider requests remaining`);
    if (feed.retryAt) parts.push(`Next retry no earlier than ${utc(feed.retryAt)}`);
    if (feed.error) parts.push(String(feed.error));
    parts.push('A full Earth view does not establish complete worldwide aircraft coverage.');
    $('globeFeedDetails').textContent = parts.join(' · ');
    $('globeStopAircraft').disabled = !state.layers?.planes && !['loading','connecting'].includes(feed.status);
    const meta = state.satelliteMeta;
    $('globeSatelliteDetails').textContent = !state.layers?.sats ? 'Satellite layer off.' : !meta ? 'Loading orbital data…' : `${meta.count ?? 0} orbital records · ${meta.source || 'source unavailable'}${meta.fetchedAt ? ` · retrieved ${utc(meta.fetchedAt)}` : ''}${Number.isFinite(meta.oldestAgeDays) ? ` · oldest elements ${finite(meta.oldestAgeDays)} days` : ''}${meta.stale ? ' · older or partial data' : ''}${meta.suppressed ? ` · ${meta.suppressed} expired elements omitted` : ''}${meta.nextRefreshAt ? ` · next online check ${utc(meta.nextRefreshAt)}` : ''}. Elements older than seven days are omitted.`;
  }
  function renderList() {
    if (!panelOpen || panelName !== 'objects') return;
    const query = $('globeSearch').value.trim().toLocaleLowerCase();
    const matches = state.objects.filter(object => !query || [object.name,object.id,object.flight,object.registration,object.hex].some(value => String(value || '').toLocaleLowerCase().includes(query)));
    const items = matches.slice(0, 80);
    $('globeObjectsSummary').textContent = `${matches.length} ${query ? 'matching' : 'loaded'} object${matches.length === 1 ? '' : 's'}${matches.length > 80 ? ' · first 80 listed; narrow the search' : ''}. ${scopeLabel(state.feed)}. Counts reflect received data, not every object in the world.`;
    const signature = items.map(o => `${o.id}|${o.name}`).join('\n') + query;
    const list = $('globeList');
    if (signature !== listSignature) {
      listSignature = signature;
      const focusedId = list.contains(document.activeElement) ? document.activeElement?.dataset.objectId : null;
      list.replaceChildren();
      for (const object of items) {
        const li = node('li'), button = node('button'); button.type = 'button'; button.dataset.objectId = object.id;
        button.append(node('span', object.name || object.id), node('small'));
        button.addEventListener('click', () => invoke('select', object.id)); li.append(button); list.append(li);
      }
      if (!items.length) list.append(node('li', query ? 'No loaded object matches. Search cannot find objects outside the received catalogue or area.' : 'No objects loaded. Enable satellites or choose Data & coverage to load aircraft reports.', 'empty'));
      if (focusedId) ([...list.querySelectorAll('button')].find(button => button.dataset.objectId === focusedId) || $('globeSearch')).focus({ preventScroll:true });
    }
    for (const button of list.querySelectorAll('[data-object-id]')) {
      const object = currentObjects.get(button.dataset.objectId); if (!object) continue;
      const age = object.positionAt ? Math.max(0, Math.round((Date.now() - object.positionAt) / 1000)) : null;
      button.querySelector('small').textContent = `${object.kind === 'plane' ? 'Aircraft report' : 'Satellite subpoint'} · ${coordinate(object.lat,'lat')}, ${coordinate(object.lon,'lon')}${age !== null ? ` · position age ${age} s` : ''}`;
      button.setAttribute('aria-current', String(object.id === state.selectedId));
    }
  }
  function renderDetails() {
    const object = currentObjects.get(state.selectedId);
    if (object) selectionRecord = object;
    if (!selectionRecord) return;
    $('globeObjectName').textContent = selectionRecord.name || selectionRecord.id;
    const mapEligible = object && (object.markerEligible ?? object.overlayEligible) !== false;
    $('globeFollow').disabled = !mapEligible; $('globeFollow').setAttribute('aria-pressed', String(!!state.following));
    $('globeFollow').textContent = state.following ? 'Stop following' : 'Follow object';
    $('globeStopFollow').hidden = !state.following || (panelOpen && panelName === 'details');
    const link = $('globeSkyLink'); link.href = state.skyURL || 'index.html'; link.setAttribute('aria-disabled', String(!object));
    const facts = $('globeObjectFacts');
    if (!object) { $('globeObjectStatus').textContent = 'This object is no longer in the current received data. Its old position is not shown as current.'; facts.replaceChildren(); return; }
    $('globeObjectStatus').textContent = `${state.following ? 'Following this object. Drag or zoom to stop. ' : ''}${object.kind === 'plane' ? !mapEligible ? 'This report remains in the list but is too old for a current marker or follow action.' : 'Reported geographic position; no motion extrapolation on this map. Receiver coverage and accuracy vary.' : 'Calculated satellite geographic subpoint; altitude is not drawn to scale.'}`;
    const rows = [['Latitude / longitude', `${coordinate(object.lat,'lat')} / ${coordinate(object.lon,'lon')}`],['Source',object.sourceName || (object.kind === 'satellite' ? 'CelesTrak / SGP4' : state.feed?.sourceName || 'Unavailable')]];
    if (object.kind === 'plane') {
      rows.push(['Position time',utc(object.positionAt)],['Position age',Number.isFinite(object.positionAt) ? `${Math.max(0,Math.round((Date.now()-object.positionAt)/1000))} s` : 'Unavailable'],['Report state',object.ground ? 'Reported on ground' : 'Ground state not reported'],['Aircraft altitude',Number.isFinite(object.altFt) ? `${finite(object.altFt,0)} ft · ${object.altitudeKind === 'geometric-wgs84' ? 'WGS84 geometric' : 'pressure altitude'}` : 'Not reported · no sky elevation estimate']);
      if (Number.isFinite(object.gsKt)) rows.push(['Ground speed',`${finite(object.gsKt,0)} kt`]);
      rows.push(['Map position','Reported latitude / longitude']);
    } else {
      rows.push(['Orbital epoch',utc(object.epochISO || object.epoch)],['Illumination estimate',object.illumination || 'Unavailable']);
      if (Number.isFinite(object.rangeKm)) rows.push(['Observer line-of-sight range',`${finite(object.rangeKm,0)} km`]);
    }
    facts.replaceChildren(...rows.flatMap(([term,value]) => [node('dt',term),node('dd',value)]));
  }
  function update(next) {
    if (destroyed) return;
    state = { ...state, ...next, objects:Array.isArray(next.objects) ? next.objects : state.objects };
    document.body.classList.toggle('night', state.night === true);
    currentObjects = new Map(state.objects.map(object => [object.id,object]));
    $('globeViewCoordinates').textContent = `${coordinate(state.view.centerLat,'lat')} · ${coordinate(state.view.centerLon,'lon')}`;
    $('globeZoomValue').textContent = `${finite(state.view.zoom)}×`;
    $('globeDensity').hidden = !(state.renderStats?.suppressedCount > 0);
    $('globeDensity').textContent = state.renderStats?.suppressedCount > 0 ? `Grouped view · zoom in or search all ${state.objects.length} loaded records` : '';
    for (const [id,key] of [['globePlanes','planes'],['globeSatellites','sats']]) $(id).setAttribute('aria-pressed',String(!!state.layers[key]));
    $('globePlanesState').textContent = !state.layers.planes ? 'Off' : ['limited','paused'].includes(state.feed?.status) ? 'Paused' : ['error','unavailable'].includes(state.feed?.status) ? 'Unavailable' : 'On';
    $('globeSatellitesState').textContent = !state.layers.sats ? 'Off' : state.satelliteStatus === 'loading' ? 'Loading' : ['error','unavailable'].includes(state.satelliteStatus) ? 'Unavailable' : state.satelliteStatus === 'older data' ? 'Older data' : 'On';
    renderFeed();
    if (state.selectedId !== lastSelected) {
      lastSelected = state.selectedId;
      if (state.selectedId) { selectionRecord = currentObjects.get(state.selectedId) || null; renderDetails(); setPanel('details',true,true); }
    }
    renderDetails(); renderList();
    if (state.error && String(state.error) !== lastError) announce(state.error,true);
    lastError = String(state.error || '');
    measure();
  }
  on($('globePanelToggle'),'click',() => setPanel(panelName,!panelOpen,!panelOpen));
  on($('globePanelClose'),'click',() => setPanel(panelName,false,true));
  on($('globeCoverage'),'click',() => setPanel('data',true,true));
  on($('globeObjectsTab'),'click',() => setPanel('objects',true));
  on($('globeDataTab'),'click',() => setPanel('data',true));
  on($('globeDetailsBack'),'click',() => setPanel('objects',true,true));
  for (const [id,other,name] of [['globeObjectsTab','globeDataTab','data'],['globeDataTab','globeObjectsTab','objects']]) on($(id),'keydown',event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const target = event.key === 'Home' ? 'objects' : event.key === 'End' ? 'data' : name;
    setPanel(target,true); $(target === 'objects' ? 'globeObjectsTab' : 'globeDataTab').focus();
  });
  on($('globeSearch'),'input',renderList);
  on($('globeZoomIn'),'click',() => invoke('zoom',1.4)); on($('globeZoomOut'),'click',() => invoke('zoom',1/1.4));
  on($('globeReset'),'click',() => invoke('resetView'));
  on($('globeLocation'),'click',() => invoke('useLocation'));
  on($('globeFollow'),'click',() => invoke('follow',!state.following)); on($('globeStopFollow'),'click',() => invoke('follow',false));
  on($('globeSkyLink'),'click',event => { event.preventDefault(); if (currentObjects.has(state.selectedId)) invoke('openSky',state.selectedId); });
  on($('globePlanes'),'click',() => { if (!state.layers.planes && !state.aircraftConfigured) setPanel('data',true,true); invoke('setLayer','planes',!state.layers.planes); });
  on($('globeSatellites'),'click',() => invoke('setLayer','sats',!state.layers.sats));
  on($('globeStopAircraft'),'click',() => invoke('stopAircraft'));
  on($('globeUseCenter'),'click',() => { copyMapCentre(); announce('Map centre copied. Load this area to request aircraft reports.'); });
  on($('globeProvider'),'change',() => { invoke('stopAircraft'); providerHelp(); announce('Provider selected. Load this area to contact it.'); });
  on($('globeAreaForm'),'submit',event => {
    event.preventDefault(); if (!$('globeAreaForm').reportValidity()) return;
    invoke('queryArea',{ lat:Number($('globeAreaLat').value),lon:Number($('globeAreaLon').value),rangeNm:Number($('globeRange').value),provider:$('globeProvider').value });
  });
  on($('globeReceiverForm'),'submit',event => {
    event.preventDefault(); if (!$('globeReceiverForm').reportValidity()) return;
    const input = $('globeReceiverURL'); let url;
    try { url = new URL(input.value.trim()); if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error(); }
    catch { input.setCustomValidity('Enter an HTTPS endpoint without credentials or a fragment.'); input.reportValidity(); return; }
    invoke('connectReceiver',{ url:url.href,schema:$('globeReceiverSchema').value,coverageLabel:$('globeReceiverCoverage').value.trim() });
  });
  on($('globeReceiverURL'),'input',() => $('globeReceiverURL').setCustomValidity(''));
  function pair() { const points=[...pointers.values()]; return points.length>=2 ? { distance:Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2 } : null; }
  function rotatePixels(dx,dy) { const rect=canvas.getBoundingClientRect(),scale=180/Math.max(180,Math.min(rect.width,rect.height))/Math.max(1,state.view.zoom); invoke('rotate',-dx*scale,dy*scale); }
  on(canvas,'pointerdown',event => {
    if (event.pointerType==='mouse' && event.button!==0) return;
    canvas.focus({preventScroll:true}); canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (pointers.size===1) drag={x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false};
    else { if (drag) drag.moved=true; pinch=pair(); }
    event.preventDefault();
  });
  on(canvas,'pointermove',event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (pointers.size>=2) {
      const next=pair(); if (pinch && pinch.distance>0) { invoke('zoom',Math.max(.6,Math.min(1.6,next.distance/pinch.distance))); rotatePixels(next.x-pinch.x,next.y-pinch.y); } pinch=next;
    } else if (drag) {
      if (Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>4) drag.moved=true;
      if (drag.moved) rotatePixels(event.clientX-drag.x,event.clientY-drag.y);
      drag.x=event.clientX; drag.y=event.clientY;
    }
    event.preventDefault();
  });
  function pointerEnd(event) {
    if (!pointers.has(event.pointerId)) return;
    const pick = event.type==='pointerup' && pointers.size===1 && drag && !drag.moved;
    pointers.delete(event.pointerId); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (pick) { const rect=canvas.getBoundingClientRect(); invoke('pick',event.clientX-rect.left,event.clientY-rect.top); }
    pinch=null;
    if (!pointers.size) drag=null;
    else { const point=[...pointers.values()][0]; drag={...point,startX:point.x,startY:point.y,moved:true}; }
  }
  on(canvas,'pointerup',pointerEnd); on(canvas,'pointercancel',pointerEnd);
  on(canvas,'wheel',event => { event.preventDefault(); invoke('zoom',Math.exp(-Math.max(-200,Math.min(200,event.deltaY))*.003)); },{passive:false});
  on(canvas,'keydown',event => {
    const step=10/Math.max(1,state.view.zoom);
    if (event.key==='ArrowLeft') invoke('rotate',-step,0); else if (event.key==='ArrowRight') invoke('rotate',step,0);
    else if (event.key==='ArrowUp') invoke('rotate',0,step); else if (event.key==='ArrowDown') invoke('rotate',0,-step);
    else if (['+','='].includes(event.key)) invoke('zoom',1.4); else if (event.key==='-') invoke('zoom',1/1.4);
    else if (['Home','0'].includes(event.key)) invoke('resetView'); else if (event.key==='Escape') { invoke('follow',false); setPanel(panelName,false); }
    else return; event.preventDefault();
  });
  on(window,'resize',measure);
  if (typeof ResizeObserver==='function') { resizeObserver=new ResizeObserver(measure); resizeObserver.observe(document.querySelector('.globe-header')); }
  providerHelp(); measure(); update(state);
  return { update,announce,openPanel:(name='objects')=>setPanel(name,true,true),
    getInsets() { const panel=$('globePanel').getBoundingClientRect(),wide=matchMedia('(min-width:960px), (min-width:560px) and (max-height:540px)').matches; return {top:document.querySelector('.globe-header').getBoundingClientRect().bottom+12,left:74,right:wide&&panelOpen?innerWidth-panel.left+12:12,bottom:!wide&&panelOpen?innerHeight-panel.top+12:70}; },
    dispose() { destroyed=true; clearTimeout(noticeTimer); resizeObserver?.disconnect(); listeners.splice(0).forEach(remove=>remove()); pointers.clear(); }
  };
}
