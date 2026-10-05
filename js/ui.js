// Accessible DOM controls for the sky. External/catalog strings are always textContent.
import { compass16, fmtAlt } from './astro.js';
import { displayName, objectNameRecord } from './names.js';
const $ = (id) => document.getElementById(id);
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text != null) el.textContent = String(text);
  if (className) el.className = className;
  return el;
};
const finite = (v, digits = 0) => Number.isFinite(v) ? v.toFixed(digits) : '—';
const NOTE_KEY = 'skylens.observation-note.v1';

export function createUI(handlers = {}) {
  const dock = $('dock'), card = $('infocard'), toastBox = $('toasts');
  let dockOpen = false, camera = 'off', currentState = null, activeItem = null;
  let returnFocus = null, currentQuery = '', favouriteIds = new Set(), timeDirty = false;
  let returnPanel = null, returnObjectKey = null;
  let orbitModule = null;
  let savedSignature = '', savedById = new Map();
  let locationSignature = '', lastNameMode = 'bilingual', latestTonight = null;
  let detailRequest = 0;
  let toastTimer = null;
  const button = (text, action, className) => {
    const el = node('button', text, className); el.type = 'button';
    el.addEventListener('click', action); return el;
  };
  function toast(message, ms = 4200) {
    clearTimeout(toastTimer);
    const el = node('div', message, 'toast');
    // Keep the polite status region, but replace superseded transient feedback.
    // Rapid input must not stack obsolete notices over the tools and results.
    toastBox.replaceChildren(el);
    toastTimer = setTimeout(() => { el.remove(); toastTimer = null; }, ms);
  }
  function setDock(open) {
    dockOpen = !!open; dock.classList.toggle('open', dockOpen);
    $('dockContent').hidden = !dockOpen;
    $('dockHandle').setAttribute('aria-expanded', String(dockOpen));
    $('dockLabel').textContent = dockOpen ? 'Close tools' : 'Explore & tools';
    if (dockOpen) card.hidden = true;
  }
  $('dockHandle').addEventListener('click', () => setDock(!dockOpen));
  const tabs = [...dock.querySelectorAll('.tabs > [role="tab"]')];
  function setTab(name) {
    const destination = name === 'explore' ? 'tonight' : name === 'traffic' ? 'tools' : name;
    const tab = tabs.find((b) => b.dataset.tab === destination);
    if (!tab) return;
    tabs.forEach((b) => {
      const active = b === tab; b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1;
    });
    dock.querySelectorAll('.panel[data-panel]').forEach((panel) => {
      const active = panel.dataset.panel === tab.dataset.tab;
      panel.classList.toggle('active', active); panel.hidden = !active;
    });
    setDock(true);
    if (name === 'traffic') $('trafficDetails').open = true;
    if (tab.dataset.tab === 'tonight') {
      handlers.explore?.();
      renderOrbit();
    }
  }
  async function renderOrbit() {
    if (!dockOpen || $('panelExplore').hidden || $('solarView').hidden) return;
    try {
      orbitModule ||= await import('./orbits.js');
      orbitModule.renderOrbit($('orbitView'), new Date(currentState?.selectedTime || Date.now()), undefined, currentState?.nameMode || 'bilingual');
    } catch {
      $('orbitView').replaceChildren(node('p', 'The solar-system diagram is unavailable. Try reloading the page.', 'help'));
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next == null) return;
      event.preventDefault(); event.stopPropagation();
      setTab(tabs[next].dataset.tab); tabs[next].focus();
    });
  });
  const exploreTabs = [...dock.querySelectorAll('[data-explore]')];
  function setExploreView(name) {
    exploreTabs.forEach(tab => {
      const active = tab.dataset.explore === name;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      $(tab.getAttribute('aria-controls')).hidden = !active;
    });
    if (name === 'solar') renderOrbit();
  }
  exploreTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setExploreView(tab.dataset.explore));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? exploreTabs.length - 1 : (index + 1) % exploreTabs.length;
      setExploreView(exploreTabs[next].dataset.explore); exploreTabs[next].focus();
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || $('onboard').open) return;
    if (!card.hidden) { closeInfo(); event.stopPropagation(); }
    else if (dockOpen) { setDock(false); $('dockHandle').focus(); }
  });
  $('openSearch').addEventListener('click', () => { setTab('sky'); $('objectSearch').focus(); });
  $('openTools').addEventListener('click', () => { setTab('tools'); $('tabTools').focus(); });
  $('openLocationSettings').addEventListener('click', () => { setTab('settings'); $('savedLocationName').focus(); });
  $('openAlign').addEventListener('click', () => {
    setTab('settings'); $('alignmentDetails').open = true;
    $('alignmentDetails').scrollIntoView({ block: 'nearest' }); $('setHeading').focus();
  });
  $('cameraToggle').addEventListener('click', () => {
    // Do not await or schedule before invoking: iOS motion permission needs this gesture.
    if (camera === 'on' || camera === 'starting') handlers.stopCamera?.();
    else handlers.startCamera?.();
  });
  function cameraState({ status = 'off', message = '' } = {}) {
    camera = status;
    const control = $('cameraToggle');
    control.disabled = false;
    control.textContent = status === 'on' ? 'Stop camera' : status === 'starting' ? 'Cancel camera' : status === 'error' ? 'Retry camera' : status === 'paused' ? 'Resume camera' : 'Enable camera';
    control.setAttribute('aria-busy', String(status === 'starting'));
    $('cameraStatus').textContent = message || ({ on: 'Camera on · calculated sky overlay', off: 'Manual sky · camera is off', starting: 'Starting camera and motion…', paused: 'Camera paused. Resume when ready.', error: 'Camera unavailable. You can still explore manually.' }[status] || status);
    $('viewControls').dataset.camera = status;
  }
  const dots = { tle: $('dotTle'), adsb: $('dotAdsb'), cam: $('dotCam'), motion: $('dotMotion') };
  const statuses = { tle: $('tleStatus'), adsb: $('adsbStatus'), cam: $('camFeedStatus'), motion: $('motionFeedStatus') };
  function statusDot(which, state, title) {
    if (dots[which]) dots[which].className = 'dot st-' + ({ ok:'ok', warn:'warn', err:'err', off:'off' }[state] || 'off');
    if (statuses[which]) statuses[which].textContent = title || `${which}: ${state}`;
    if (which === 'motion') $('sensorStatus').textContent = title || 'Motion unavailable · drag to explore';
  }
  function telemetry({ date = new Date(), isLive = true, loc, az, alt, counts = '' } = {}) {
    const instant = date instanceof Date ? date : new Date(date);
    if (Number.isFinite(instant.getTime())) {
      $('telTime').textContent = `${isLive ? 'Live' : 'Simulated'} · ${instant.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
      if (!timeDirty && document.activeElement !== $('skyTime')) $('skyTime').value = instant.toISOString().slice(0, 16);
      $('simulationText').textContent = `Simulated: ${instant.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
      $('toolsTime').textContent = `${isLive ? 'Live' : 'Simulated'} · ${instant.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
    }
    $('simulationBanner').hidden = isLive;
    const demo = !loc || /default|demo/i.test(loc.source || '');
    const position = demo ? 'Demo: New York · choose your location' : `${loc.source === 'gps' ? 'Device' : 'Selected'}: ${finite(loc.lat, 3)}°, ${finite(loc.lon, 3)}°${Number.isFinite(loc.accuracy) ? ` ±${Math.round(loc.accuracy)} m` : ''}`;
    $('telPos').textContent = position; $('telPos').classList.toggle('demo', demo);
    $('locationStatus').textContent = demo ? 'Demo location: New York. Set a location to see your own sky.' : `${loc?.name ? `${loc.name} · ` : ''}${position}`;
    $('toolsLocation').textContent = demo ? 'Demo: New York · set your own location' : `${loc?.name ? `${loc.name} · ` : ''}${position}`;
    trackingStatus();
    $('telAim').textContent = Number.isFinite(az) && Number.isFinite(alt) ? `${compass16(az)} ${finite(az)}° · altitude ${fmtAlt(alt)}` : 'Manual sky';
    $('telCount').textContent = counts;
  }
  function compassTape(az) {
    if (!Number.isFinite(az)) return;
    $('tapeReadout').textContent = `${compass16(az)} ${az.toFixed(0)}°`;
    $('tapeStrip').style.backgroundPosition = `${-az * 3}px 0`;
  }
  function normalise(item) {
    const data = item?.data || item || {};
    const kind = item?.kind || data.kind || 'object';
    const name = data.name || data.label || data.flight || 'Unnamed object';
    return { ...data, kind, name, id: item?.id || data.id || (kind === 'body' || kind === 'planet' || kind === 'sun' || kind === 'moon' ? `body:${name}` : kind === 'dso' ? `dso:${name}` : null) };
  }
  const nameMode = () => currentState?.nameMode || 'bilingual';
  const named = item => displayName(item, nameMode());
  function utcStamp(value) {
    if (value == null) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC` : null;
  }
  function setName(element, item) {
    const record = objectNameRecord(item);
    element.replaceChildren();
    if (record.hindi && nameMode() !== 'en') {
      const hindi = node('span', record.hindi); hindi.lang = 'hi'; element.append(hindi);
      if (nameMode() === 'hi') return element;
      element.append(document.createTextNode(' · '));
    }
    const english = node('span', record.english || item.name || String(item)); english.lang = 'en'; element.append(english);
    return element;
  }
  function closeInfo() {
    detailRequest++;
    card.hidden = true;
    // The clock may replace an unfocused result while its details are open.
    // Reopen the originating panel before restoring a visible, current control.
    if (returnPanel) setTab(returnPanel);
    const visible = element => element?.isConnected && !element.disabled &&
      !element.closest('[hidden], [inert]') && element.getClientRects().length > 0 && element.tabIndex >= 0;
    const currentTrigger = returnObjectKey && returnPanel
      ? [...dock.querySelectorAll('[data-object-key]')].find(element =>
        element.dataset.objectKey === returnObjectKey && element.closest('[data-panel]')?.dataset.panel === returnPanel)
      : null;
    const target = visible(returnFocus) ? returnFocus : visible(currentTrigger) ? currentTrigger :
      returnPanel === 'sky' ? $('openSearch') : $('dockHandle');
    target.focus();
  }
  function addRows(parent, rows) {
    const grid = node('dl', null, 'grid');
    rows.forEach(([label, value]) => {
      const term = node('dt', null, 'k');
      if (label?.nodeType) term.append(label); else term.textContent = String(label);
      grid.append(term, node('dd', value, 'v'));
    });
    parent.append(grid);
  }
  function showInfo(item, trigger = document.activeElement) {
    if (!item) { detailRequest++; card.hidden = true; return; }
    const d = normalise(item); activeItem = d;
    const detailDate = new Date(currentState?.selectedTime || Date.now());
    const detailLoc = { ...currentState?.loc };
    const context = `${currentState?.selectedTime ? 'Selected' : 'Snapshot'}: ${detailDate.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${finite(detailLoc.lat, 3)}° latitude, ${finite(detailLoc.lon, 3)}° longitude${detailLoc.name ? ` · ${detailLoc.name}` : ''}. Reopen to update.`;
    returnFocus = trigger;
    returnPanel = dockOpen ? returnFocus?.closest('[data-panel]')?.dataset.panel || null : null;
    returnObjectKey = returnFocus?.closest('[data-object-key]')?.dataset.objectKey || null;
    setDock(false); card.replaceChildren();
    const close = button('Close', closeInfo, 'x'); close.setAttribute('aria-label', 'Close object details');
    const heading = setName(node('h2'), d); heading.tabIndex = -1;
    card.append(close, heading);
    card.append(node('p', context, 'detail-context meta'));
    const nameRecord = objectNameRecord(d);
    if (nameRecord.hindi) {
      const method = nameRecord.methodLabel || (nameRecord.method === 'transliteration' ? 'Hindi transliteration' : 'Reviewed Hindi name');
      const naming = node('p', `${nameRecord.transliteration ? `${nameRecord.transliteration} · ` : ''}${method}`, 'name-method meta');
      card.append(naming);
      if (nameRecord.traditionalAliases?.length) {
        const aliases = node('p', 'Traditional aliases: ', 'meta');
        nameRecord.traditionalAliases.forEach((alias, index) => {
          if (index) aliases.append(document.createTextNode(' · '));
          const label = typeof alias === 'string' ? alias : alias.hindi || alias.name || alias.english || '';
          const span = node('span', label); if (/[\u0900-\u097f]/.test(label)) span.lang = 'hi'; aliases.append(span);
        });
        card.append(aliases);
        if (nameRecord.aliasNote) card.append(node('p', nameRecord.aliasNote, 'meta'));
      }
    } else if (['star', 'sun', 'moon', 'planet', 'body', 'dso'].includes(d.kind)) card.append(node('p', 'Catalog name retained; no reviewed Hindi equivalent is included yet.', 'name-method meta'));
    const rows = [['Type', d.kind], [d.kind === 'constellation' ? 'Anchor altitude / azimuth' : 'Altitude / azimuth', `${Number.isFinite(d.alt) ? fmtAlt(d.alt) : '—'} / ${finite(d.az, 1)}°`]];
    if (Number.isFinite(d.mag)) rows.push(['Magnitude', finite(d.mag, 1)]);
    if (Number.isFinite(d.phase)) rows.push(['Illuminated', `${finite(d.phase * 100)}%`]);
    if (Number.isFinite(d.rangeKm)) rows.push(['Range', `${finite(d.rangeKm)} km`]);
    if (Number.isFinite(d.distKm)) rows.push(['Distance', `${finite(d.distKm)} km`]);
    if (d.altFt != null) rows.push(['Aircraft altitude', `${finite(d.altFt)} ft`]);
    if (d.gsKt != null) rows.push(['Ground speed', `${finite(d.gsKt)} kt`]);
    if (d.kind === 'plane' && utcStamp(d.positionAt)) rows.push(['Position timestamp', utcStamp(d.positionAt)]);
    if (d.dim != null) rows.push(['Angular size', `${d.dim} arcmin`]);
    addRows(card, rows);
    if (d.kind === 'constellation') card.append(node('p', d.description || 'Guidance targets the catalog label anchor, not a single star or full boundary. Stick figures are illustrative.', 'help'));
    if (d.alt < 0) card.append(node('p', 'Below the horizon at the selected time and location.', 'help warning'));
    const controls = node('div', null, 'inputrow');
    controls.append(button('Guide to object', () => { handlers.locate?.({ ...d, label:d.name }); card.hidden = true; $('sky').focus(); }, 'primary'));
    if (typeof d.id === 'string' && /^(star|body|dso|const|sat):/.test(d.id)) {
      const save = button(favouriteIds.has(d.id) ? 'Remove saved object' : 'Save object', () => {
        const nowSaved = handlers.toggleFavourite?.(d);
        if (typeof nowSaved === 'boolean') { nowSaved ? favouriteIds.add(d.id) : favouriteIds.delete(d.id); }
        save.textContent = favouriteIds.has(d.id) ? 'Remove saved object' : 'Save object';
        save.setAttribute('aria-pressed', String(favouriteIds.has(d.id)));
      });
      save.dataset.action = 'save'; save.setAttribute('aria-pressed', String(favouriteIds.has(d.id))); controls.append(save);
    }
    card.append(controls);
    const events = node('section', null, 'object-events'); events.id = 'objectEvents';
    events.setAttribute('aria-live', 'polite'); events.setAttribute('aria-busy', 'true');
    events.append(node('h3', 'Rise, set & transit'), node('p', 'Calculating the next 48 hours…', 'meta'));
    card.append(events); card.hidden = false; heading.focus({ preventScroll: true });
    const request = ++detailRequest;
    const eventTime = value => {
      if (!value) return 'No event in next 48h';
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC` : String(value);
    };
    Promise.resolve().then(() => handlers.objectEvents?.(d)).then(result => {
      if (request !== detailRequest || !events.isConnected || card.hidden) return;
      events.replaceChildren(node('h3', 'Rise, set & transit'));
      if (!result || result.error) {
        const message = result?.note || (result?.error && !/^[a-z]+(?:-[a-z]+)*$/.test(result.error) ? result.error : 'Event calculations are unavailable for this object.');
        const reason = result?.note && result.error?.includes(' ') ? `${result.error} ${message}` : message;
        events.append(node('p', reason, 'help'));
      }
      else {
        addRows(events, [['Rise', eventTime(result.rise)], ['Transit', eventTime(result.transit)], ['Set', eventTime(result.set)]]);
        if (result.note) events.append(node('p', result.note, 'meta'));
      }
      events.setAttribute('aria-busy', 'false');
    }).catch(() => {
      if (request !== detailRequest || !events.isConnected || card.hidden) return;
      events.replaceChildren(node('h3', 'Rise, set & transit'), node('p', 'Event calculation failed. Close and reopen this object to retry.', 'help'));
      events.setAttribute('aria-busy', 'false');
    });
  }
  function renderList(el, objects, empty, subtitle) {
    // A focused result is never discarded by the once-per-second refresh.
    if (el.contains(document.activeElement)) return;
    if (!objects.length) { el.replaceChildren(node('li', empty, 'empty')); return; }
    const items = objects.map((item) => {
      const d = normalise(item), li = node('li');
      const open = button('', event => showInfo(item, event.currentTarget), 'object-row');
      open.dataset.objectKey = d.id || `${d.kind}:${d.name}`;
      open.append(setName(node('span', null, 'object-name'), d), node('span', subtitle ? subtitle(d) : `${d.kind} · ${Number.isFinite(d.alt) ? fmtAlt(d.alt) : '—'} · az ${finite(d.az)}°${d.alt < 0 ? ' · below horizon' : ''}`, 'sub'));
      li.append(open); return li;
    });
    el.replaceChildren(...items);
  }
  function skyList(bodies = [], stars = []) {
    renderList($('skyList'), [...bodies.map(b => ({ ...b, kind:b.kind || 'body' })), ...stars.map(s => ({ ...s, kind:'star' }))], 'No bright catalog objects above the horizon. Search includes the full supported catalog.');
  }
  function searchResults(results = []) {
    const items = Array.isArray(results) ? results : results.results || [];
    currentQuery = $('objectSearch').value.trim();
    $('searchList').hidden = !currentQuery; $('skyListGroup').hidden = !!currentQuery;
    if (!currentQuery) { $('searchMeta').textContent = 'Search in Hindi, English or reviewed Romanized names, including objects below the horizon.'; return; }
    $('searchMeta').textContent = `${items.length}${items.length === 50 ? '+' : ''} result${items.length === 1 ? '' : 's'} for “${currentQuery}”`;
    renderList($('searchList'), items, 'No object in this catalog matches. Try a planet, constellation, star name or Messier number.');
  }
  $('objectSearch').addEventListener('input', () => {
    currentQuery = $('objectSearch').value.trim();
    const results = handlers.search?.(currentQuery);
    if (Array.isArray(results)) searchResults(results);
    else if (!currentQuery) searchResults([]);
  });
  $('stopGuidance').addEventListener('click', () => { handlers.locate?.(null); toast('Guidance stopped.'); });
  function satList(sats = [], meta) {
    const age = Number.isFinite(meta?.oldestAgeDays) ? ` · oldest elements ${meta.oldestAgeDays.toFixed(1)} days` : '';
    const updated = meta?.fetchedAt ? new Date(meta.fetchedAt) : null;
    const fetched = updated && Number.isFinite(updated.getTime()) ? ` · retrieved ${updated.toISOString().slice(0, 16).replace('T', ' ')} UTC` : '';
    const off = currentState?.layers?.sats === false;
    const groups = Array.isArray(meta?.groupsLoaded) ? meta.groupsLoaded.length : Number.isFinite(meta?.groupsLoaded) ? meta.groupsLoaded : null;
    const scope = meta?.partial ? ` · partial data${groups != null ? ` (${groups} source groups loaded)` : ''}` : '';
    const cached = meta?.source === 'cache' ? ` · cached data${meta.cacheStale ? ' (retrieved more than two hours ago)' : ''}` : meta?.source === 'snapshot' ? ' · bundled fallback' : '';
    const attempted = utcStamp(meta?.lastAttemptAt);
    const check = orbitalCheckStatus(meta);
    $('satMeta').textContent = meta ? `${off ? 'Layer off · ' : ''}${meta.count ?? sats.length} elements · ${meta.source || 'unknown source'}${cached}${scope}${age}${fetched}${meta.stale ? ' · stale data' : ''}${meta.suppressed ? ` · ${meta.suppressed} older elements omitted` : ''}${attempted ? ` · last online attempt ${attempted}` : ''}${meta.error ? ' · last online check failed; available elements may be incomplete' : ''}${check ? ` · ${check}` : ''}` : off ? 'Satellites are off.' : 'Loading satellite data…';
    renderList($('satList'), sats.slice(0, 12).map(s => ({ ...s, kind:'satellite' })), 'No tracked satellite above the horizon.', d => `${fmtAlt(d.alt)} · az ${finite(d.az)}° · ${finite(d.rangeKm)} km`);
  }
  function orbitalCheckStatus(meta) {
    const next = utcStamp(meta?.nextRefreshAt);
    if (!next) return '';
    return new Date(meta.nextRefreshAt).getTime() > Date.now() ? `Next online check no earlier than ${next}` : 'Online check is available now';
  }
  function trackingStatus() {
    const state = currentState;
    if (!state) return;
    const satellite = !state.layers.sats ? 'Satellites off' : state.tleMeta?.source === 'none' ? 'Satellites: data unavailable' : state.tleMeta?.stale ? 'Satellites: older orbital data' : `Satellites enabled${state.sats ? ` · ${state.sats.length} currently tracked` : ''}`;
    const aircraft = !state.layers.planes ? 'Aircraft off' : state.selectedTime ? 'Aircraft paused for simulated time' : state.planeStatus === 'location-needed' ? 'Aircraft: choose your location' : state.planeStatus === 'limited' ? 'Aircraft paused: API limit' : state.planeStatus === 'ok' ? `Aircraft: ${state.planes?.length || 0} reports` : `Aircraft: ${state.planeStatus || 'waiting for data'}`;
    $('toolsFeedStatus').textContent = `${satellite} · ${aircraft}`;
  }
  $('refreshSatellites').addEventListener('click', async () => {
    const control = $('refreshSatellites');
    control.disabled = true; control.setAttribute('aria-busy', 'true');
    $('satRefreshStatus').textContent = 'Checking orbital data…';
    try {
      const result = await handlers.refreshSatellites?.();
      const check = orbitalCheckStatus(result?.meta);
      const message = result?.message || (result?.ok ? 'Orbital data checked.' : 'Orbital data could not be refreshed. Existing data may be stale.');
      $('satRefreshStatus').textContent = `${message}${result?.meta?.partial ? ' Partial source data is available.' : ''}${check ? ` ${check}.` : ''}`;
      if (result?.meta) satList(currentState?.sats || [], result.meta);
      trackingStatus();
    } catch { $('satRefreshStatus').textContent = 'Orbital data could not be refreshed. Existing data may be stale; try again later.'; }
    finally { control.disabled = false; control.setAttribute('aria-busy', 'false'); }
  });
  function planeList(planes = [], status, timestamp, info = {}) {
    const age = timestamp ? Math.max(0, Math.round((Date.now() - timestamp) / 1000)) : null;
    const remaining = Number.isFinite(info?.remaining) ? ` · API reports ${info.remaining} requests remaining` : '';
    const retry = utcStamp(info?.retryAt), retryPending = retry && new Date(info.retryAt).getTime() > Date.now();
    const provider = utcStamp(info?.providerAt);
    const limited = `Aircraft polling has stopped at the API limit.${remaining ? ` ${remaining.slice(3)}.` : ''} ${retryPending ? `Wait until ${retry}, then turn the aircraft feed off and on to retry.` : retry ? 'The indicated wait has elapsed. Turn the aircraft feed off and on to retry.' : 'Wait for the API allowance to reset, then turn the aircraft feed off and on to retry.'} Other users on your network may share this allowance.`;
    $('planeMeta').textContent = status === 'ok' ? `${planes.length} in 50 nautical miles · response received ${age ?? '—'} s ago${provider ? ` · provider snapshot ${provider}` : ''}${remaining}` : status === 'limited' ? limited : status === 'error' ? 'Aircraft feed unavailable. Last positions may be stale; retrying.' : status === 'paused' ? 'Aircraft feed paused.' : status === 'simulated' ? 'Aircraft feed is paused during simulated time. Return to now to resume.' : status === 'location-needed' ? 'Set your own location in Settings before enabling aircraft requests.' : 'Aircraft feed is off.';
    renderList($('planeList'), planes.slice(0, 12).map(p => ({ ...p, kind:'plane' })), status === 'ok' ? 'No recent aircraft positions returned.' : status === 'limited' ? 'No current aircraft positions while polling is paused.' : 'Enable the optional feed above to request live aircraft.', d => {
      const positionAge = Number.isFinite(d.positionAt) ? Math.max(0, Math.round((Date.now() - d.positionAt) / 1000)) : null;
      return `${d.altFt == null ? 'Altitude unavailable' : `${finite(d.altFt)} ft`} · ${finite(d.distKm)} km ${Number.isFinite(d.az) ? compass16(d.az) : ''} · ${positionAge == null ? 'position age unavailable' : `position age ${positionAge} s`}`;
    });
  }
  function tonight(t) {
    latestTonight = t;
    const parent = $('tonightBody');
    if (!t) { parent.replaceChildren(node('p', 'Astronomical event calculations are unavailable. Check the calculation engine and try again.', 'empty')); return; }
    const cards = [];
    function result(title, rows, note) {
      const section = node('section', null, 'tcard'); section.append(title?.nodeType ? title : node('h3', title)); addRows(section, rows);
      if (note) section.append(node('p', note, 'meta')); cards.push(section);
    }
    const noEvent = v => v ?? 'No event in search window';
    const sunHeading = setName(node('h3'), { name: 'Sun', kind: 'sun' }); sunHeading.append(document.createTextNode(' & darkness'));
    if (t.sun) result(sunHeading, [['Sunrise', noEvent(t.sun.sunrise)], ['Sunset', noEvent(t.sun.sunset)], ['Darkness starts', noEvent(t.sun.darkStart)], ['Darkness ends', noEvent(t.sun.darkEnd)]], t.sun.note);
    if (t.moon) result(setName(node('h3'), { name: 'Moon', kind: 'moon' }), [['Phase', `${t.moon.phaseName || 'Unknown'} · ${finite((t.moon.illum ?? 0) * 100)}% illuminated`], ...(t.moon.quarters || []).map(q => [q.name, q.day])]);
    if (t.planets) result('Planets', t.planets.map(p => {
      const label = setName(node('span'), { ...p, kind: 'planet' });
      if (p.up) label.append(document.createTextNode(' · above horizon'));
      return [label, `Mag ${finite(p.mag, 1)} · ${p.visibility || 'visibility unavailable'} · Rise ${noEvent(p.rise)} · Transit ${noEvent(p.transit)} · Set ${noEvent(p.set)}`];
    }));
    if (t.showers?.length) {
      const active = t.showers.filter(s => s.active);
      result('Meteor showers', (active.length ? active : t.showers).slice(0, 3).map(s => [s.name + (s.peaking ? ' · near peak' : ''), `ZHR ${s.zhr} · peak ${s.peak}${Number.isFinite(s.alt) ? ` · radiant ${fmtAlt(s.alt)}` : ''}`]));
    }
    parent.replaceChildren(...cards);
  }
  function syncSettings(state) {
    const changedNameMode = lastNameMode !== (state.nameMode || 'bilingual');
    currentState = state;
    lastNameMode = state.nameMode || 'bilingual';
    $('nameMode').value = lastNameMode;
    document.querySelectorAll('#chips .chip').forEach(chip => {
      const key = chip.dataset.layer, on = key === 'night' ? !!state.night : state.layers[key] !== false;
      chip.classList.toggle('on', on); chip.setAttribute('aria-pressed', String(on));
    });
    for (const [id, key] of [['setGrid','grid'], ['setLabels','labels'], ['setSats','sats'], ['setPlanes','planes']]) $(id).checked = !!state.layers[key];
    $('setNight').checked = !!state.night;
    trackingStatus();
    if (state.loc && !['locLat', 'locLon'].includes(document.activeElement?.id)) {
      $('locLat').value = finite(state.loc.lat, 5); $('locLon').value = finite(state.loc.lon, 5);
    }
    if (changedNameMode) {
      savedSignature = '';
      if (latestTonight) tonight(latestTonight);
      if (activeItem && !card.hidden) setName(card.querySelector('h2'), activeItem);
      renderOrbit();
    }
    saved(state);
  }
  function bindChips(state, onChange) {
    syncSettings(state);
    document.querySelectorAll('#chips .chip').forEach(chip => chip.addEventListener('click', () => {
      const key = chip.dataset.layer;
      const patch = key === 'night' ? { night: !state.night } : { layers: { ...state.layers, [key]: state.layers[key] === false } };
      onChange(patch); syncSettings(state);
    }));
  }
  function bindSettings(state, onChange) {
    currentState = state; syncSettings(state);
    for (const [id, key, output, fallback] of [['setFov','fov','fovVal',70], ['setMag','magLimit','magVal',4.6], ['setHeading','headingOffset','headingVal',0], ['setPitch','pitchOffset','pitchVal',0]]) {
      const input = $(id); input.value = state[key] ?? fallback;
      const update = () => { $(output).textContent = input.value + (key === 'magLimit' ? '' : '°'); input.setAttribute('aria-valuetext', $(output).textContent); };
      update(); input.addEventListener('input', () => { update(); onChange({ [key]: Number(input.value) }); });
    }
    for (const [id, key] of [['setGrid','grid'], ['setLabels','labels'], ['setSats','sats'], ['setPlanes','planes']]) {
      $(id).addEventListener('change', () => { onChange({ layers:{ ...state.layers, [key]:$(id).checked } }); syncSettings(state); });
    }
    $('setNight').addEventListener('change', () => { onChange({ night:$('setNight').checked }); syncSettings(state); });
    $('nameMode').addEventListener('change', () => { onChange({ nameMode:$('nameMode').value }); syncSettings(state); });
    $('resetAlignment').addEventListener('click', () => {
      onChange({ fov:70, headingOffset:0, pitchOffset:0 });
      for (const [id, value, output] of [['setFov',70,'fovVal'], ['setHeading',0,'headingVal'], ['setPitch',0,'pitchVal']]) { $(id).value = value; $(output).textContent = value + '°'; $(id).setAttribute('aria-valuetext', value + '°'); }
      toast('Calibration reset to estimated 70° diagonal field of view.');
    });
    if (state.loc) { $('locLat').value = finite(state.loc.lat, 5); $('locLon').value = finite(state.loc.lon, 5); }
    $('locationForm').addEventListener('submit', event => {
      event.preventDefault(); const lat = Number($('locLat').value), lon = Number($('locLon').value);
      if (!$('locationForm').reportValidity() || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
      onChange({ loc:{ lat, lon, source:'manual' } }); toast('Location updated.');
    });
    $('locGps').addEventListener('click', () => handlers.relocate?.());
    $('saveLocationForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (!$('saveLocationForm').reportValidity()) return;
      const input = $('savedLocationName'), control = $('saveLocation');
      control.disabled = true;
      try {
        const result = await handlers.saveLocation?.(input.value.trim());
        $('savedLocationStatus').textContent = result?.message || (result?.ok ? 'Location saved in this browser.' : 'Could not save this location. Check the name and selected coordinates.');
        input.setAttribute('aria-invalid', String(!result?.ok));
        if (result?.ok) input.value = '';
      } catch { $('savedLocationStatus').textContent = 'Could not save this location. Your inputs are unchanged.'; }
      finally { control.disabled = false; }
    });
    $('skyTime').addEventListener('input', () => { timeDirty = true; });
    $('timeForm').addEventListener('submit', event => {
      event.preventDefault(); if (!$('timeForm').reportValidity()) return;
      timeDirty = false;
      const value = $('skyTime').value;
      handlers.setTime?.(value + (value.length === 16 ? ':00Z' : 'Z'));
      renderOrbit();
    });
    for (const id of ['timeNow', 'returnLive']) $(id).addEventListener('click', () => { timeDirty = false; handlers.setTime?.(null); renderOrbit(); });
    saved(state);
  }
  function saved(state = {}) {
    renderSavedLocations(state);
    favouriteIds = new Set(state.favourites || []);
    const items = state.savedObjects || [];
    savedById = new Map(items.map(item => [item.id, item]));
    const list = $('savedList');
    const signature = nameMode() + [...favouriteIds].map(id => [id, savedById.get(id) ? named(savedById.get(id)) : id]).flat().join('|');
    if (signature === savedSignature) return;
    savedSignature = signature;
    const restoreFocus = list.contains(document.activeElement);
    if (!favouriteIds.size) {
      list.replaceChildren(node('li', 'Select an object, then choose Save object.', 'empty'));
      if (restoreFocus) $('tabSaved').focus();
      return;
    }
    list.replaceChildren(...[...favouriteIds].map(id => {
      const object = savedById.get(id), li = node('li', null, 'saved-row');
      const open = button(object ? named(object) : id, event => {
        const current = savedById.get(id);
        if (current) showInfo(current, event.currentTarget); else { $('objectSearch').value = id.replace(/^[^:]*:/, ''); setTab('sky'); const results = handlers.search?.($('objectSearch').value); if (Array.isArray(results)) searchResults(results); }
      }, 'saved-name');
      if (object) setName(open, object);
      open.dataset.objectKey = id;
      const remove = button('Remove', () => { handlers.toggleFavourite?.(id); }, 'subtle'); remove.setAttribute('aria-label', `Remove ${object ? named(object) : id} from saved objects`);
      li.append(open, remove); return li;
    }));
    if (restoreFocus) list.querySelector('button')?.focus();
    if (activeItem && !card.hidden) {
      const save = card.querySelector('[data-action="save"]');
      if (save) { save.textContent = favouriteIds.has(activeItem.id) ? 'Remove saved object' : 'Save object'; save.setAttribute('aria-pressed', String(favouriteIds.has(activeItem.id))); }
    }
  }
  function renderSavedLocations(state) {
    const places = state.savedLocations || [], list = $('savedLocationList');
    const signature = JSON.stringify(places.map(({ id, name, lat, lon }) => [id, name, lat, lon]));
    if (signature === locationSignature) return;
    locationSignature = signature;
    const restore = list.contains(document.activeElement);
    const previousId = document.activeElement?.dataset.locationId;
    if (!places.length) list.replaceChildren(node('li', 'Save a named location in Settings to return to its sky.', 'empty'));
    else list.replaceChildren(...places.map(place => {
      const li = node('li', null, 'saved-location-row');
      const use = button('', async () => {
        try {
          const result = await handlers.useLocation?.(place.id);
          if (result?.message) toast(result.message);
          if (result?.ok) { setTab('sky'); $('tabSky').focus(); }
        } catch { toast('Could not use this saved location. Try again.'); }
      }, 'saved-location-use');
      use.dataset.locationId = place.id;
      use.append(node('span', `Use ${place.name}`, 'saved-location-name'), node('span', `${finite(Math.abs(place.lat), 3)}° ${place.lat < 0 ? 'S' : 'N'} · ${finite(Math.abs(place.lon), 3)}° ${place.lon < 0 ? 'W' : 'E'}`, 'meta'));
      const remove = button('Remove', async () => {
        try { const result = await handlers.removeLocation?.(place.id); if (result?.message) toast(result.message); }
        catch { toast('Could not remove this location. Try again.'); }
      }, 'subtle');
      remove.dataset.locationId = place.id; remove.setAttribute('aria-label', `Remove ${place.name} from saved locations`);
      li.append(use, remove); return li;
    }));
    if (restore) {
      const replacement = [...list.querySelectorAll('button[data-location-id]')].find(el => el.dataset.locationId === previousId);
      (replacement || list.querySelector('button') || $('tabSaved')).focus();
    }
  }
  try { $('observationNote').value = localStorage.getItem(NOTE_KEY) || ''; }
  catch { $('noteStatus').textContent = 'Browser storage is unavailable. Notes last only for this session.'; }
  $('notesForm').addEventListener('submit', event => {
    event.preventDefault();
    try { localStorage.setItem(NOTE_KEY, $('observationNote').value); $('noteStatus').textContent = 'Note saved in this browser.'; }
    catch { $('noteStatus').textContent = 'Could not save to browser storage. Copy your note to keep it.'; }
  });
  $('clearNote').addEventListener('click', () => {
    $('observationNote').value = '';
    try { localStorage.removeItem(NOTE_KEY); $('noteStatus').textContent = 'Note cleared.'; }
    catch { $('noteStatus').textContent = 'Note cleared for this session; browser storage is unavailable.'; }
  });
  function onboarding() {
    return new Promise(resolve => {
      const dialog = $('onboard'); let finished = false;
      const finish = choice => {
        if (finished) return; finished = true; dialog.close(); resolve(choice); $('cameraToggle').focus();
      };
      $('btnAR').addEventListener('click', () => { handlers.startCamera?.(); finish('started'); }, { once:true });
      $('btnManual').addEventListener('click', () => finish('manual'), { once:true });
      dialog.addEventListener('cancel', event => { event.preventDefault(); finish('manual'); }, { once:true });
      if (!window.isSecureContext) { $('httpsWarn').hidden = false; $('btnAR').disabled = true; }
      dialog.showModal();
    });
  }
  setDock(false);
  return { toast, statusDot, telemetry, compassTape, cameraState, showInfo, skyList, searchResults, satList, planeList, tonight, bindChips, bindSettings, syncSettings, onboarding, saved, setDock, setTab, orbit:renderOrbit };
}
