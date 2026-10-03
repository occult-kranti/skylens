import assert from 'node:assert/strict';
import * as AE from '../vendor/astronomy.js';
import {sunEvents, planetEvents, moonEvents} from '../js/events.js';
import {heliocentricSnapshot} from '../js/orbits.js';
import {tleEpoch,elementAgeDays,loadRecsFromList,propagateNow} from '../js/satellites.js';
import * as satellite from '../vendor/satellite.esm.js';
import {readFileSync} from 'node:fs';

// Independent Astrodienst 2026 tropical ephemeris, 00:00 UT, degrees of date.
// https://www.astro.com/swisseph/ae/2000/ae_2026d.pdf (researched 2026-10-03).
const date=new Date('2026-01-01T00:00:00Z');
for(const [name,expected] of Object.entries({Sun:280+34/60+7/3600,Moon:66+43/60,Mercury:268+39/60,Venus:279+12/60,Mars:282+41/60,Saturn:356+10/60})){
  const actual=AE.Ecliptic(AE.GeoVector(name,date,true)).elon;
  assert.ok(Math.abs(actual-expected)<0.05,`${name}: ${actual} vs ${expected}`);
}
// Published 2024 total solar eclipse / new Moon near April8 18:21UTC; NASA eclipse catalogue.
const quarters=moonEvents(AE,new Date('2024-04-01T00:00:00Z')).quarters;
const newMoon=quarters.find(q=>q.name==='New moon');
assert.ok(Math.abs(newMoon.date-new Date('2024-04-08T18:21:00Z'))<5*60000);
const polar=sunEvents(AE,new Date('2026-06-21T12:00:00Z'),89,0);
assert.equal(polar.sunrise,null);assert.equal(polar.sunset,null);assert.equal(polar.darkStart,null);
// Venus is a morning star on 2025-06-01 (western elongation); prevents all-evening regression.
const planets=planetEvents(AE,new Date('2025-06-01T00:00:00Z'),51.5,0);
assert.equal(planets.find(p=>p.name==='Venus').visibility,'morning');
assert.ok(planets.every(p=>p.transit?.endsWith('UTC')));
const h=heliocentricSnapshot(date);assert.equal(h.length,8);
assert.ok(h.find(b=>b.name==='Earth').distanceAU>0.98&&h.find(b=>b.name==='Earth').distanceAU<0.99);
assert.ok(h.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.distanceAU>0));
assert.throws(()=>heliocentricSnapshot(new Date(NaN)),RangeError);

const snapshot=JSON.parse(readFileSync(new URL('../data/tle-snapshot.json',import.meta.url)));
const first=snapshot.satellites[0];const epoch=tleEpoch(first.l1);
assert.equal(new Date(epoch).toISOString().slice(0,10),'2026-10-02');
assert.ok(elementAgeDays(epoch,new Date('2026-10-03'))<1.1);
assert.equal(tleEpoch('bad'),null);
globalThis.window={satellite};loadRecsFromList([first]);
assert.deepEqual(propagateNow(new Date(epoch+8*86400000),0,0,-90),[]);
assert.ok(propagateNow(new Date(epoch),0,0,-90).length===1);
console.log('Independent ephemeris, new Moon, polar, visibility, orbit and satellite-age tests passed.');
