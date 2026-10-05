// Selected-object event correctness and integration contract. No browser or hardware needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as AE from '../vendor/astronomy.js';
import { calculateObjectEvents, EVENT_WINDOW_DAYS } from '../js/observing.js';

const date = new Date('2026-10-05T00:00:00Z');
const london = { lat: 51.5, lon: 0 };
const body = name => ({ id: `body:${name}`, name, kind: name === 'Sun' ? 'sun' : name === 'Moon' ? 'moon' : 'planet' });
const sirius = { id: 'star:1', name: 'Sirius', kind: 'star', raH: 6.75248, dec: -16.71612 };
const polaris = { id: 'star:48', name: 'Polaris', kind: 'star', raH: 2.52975, dec: 89.26411 };
const minutesNear = (actual, expected, tolerance = 2) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(new Date(actual) - new Date(expected)) <= tolerance * 60000, `${actual} vs ${expected}`);
};

// US Naval Observatory API 4.0.1, fetched 2026-10-05. Coordinates51.5N/0E,
// date2026-10-05, tz0, no DST. Primary published values rounded to one minute.
// https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-05&coords=51.5,0&tz=0
for (const [name, events] of [
  ['Sun', { rise:'06:07', transit:'11:48', set:'17:29' }],
  ['Moon', { transit:'07:36', set:'15:38' }],
]) {
  test(`USNO independent ${name} rise/set/meridian reference within 2 minutes`, () => {
    const result = calculateObjectEvents(AE, body(name), date, london);
    assert.equal(result.error, undefined);
    for (const [key,time] of Object.entries(events)) minutesNear(result[key], `2026-10-05T${time}:00Z`);
  });
}

test('48-hour window finds the Moon rise on the following UTC date', () => {
  const result = calculateObjectEvents(AE, body('Moon'), date, london);
  assert.ok(result.rise.startsWith('2026-10-06T'));
  assert.ok(new Date(result.rise) - date < EVENT_WINDOW_DAYS * 86400000);
});

test('USNO Delhi local-day fixture maps to the selected UTC search instant', () => {
  // Independently retrieved by skeptical reviewer on 2026-10-05:
  // https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-05&coords=28.6139,77.209&tz=5.5
  // Local IST Sun06:16/12:10/18:03; Moon00:36/07:45/14:48.
  const start = new Date('2026-10-04T18:30:00Z');
  const loc = { lat:28.6139, lon:77.209 };
  for (const [name, reference] of [
    ['Sun', { rise:'2026-10-05T00:46Z', transit:'2026-10-05T06:40Z', set:'2026-10-05T12:33Z' }],
    ['Moon', { rise:'2026-10-04T19:06Z', transit:'2026-10-05T02:15Z', set:'2026-10-05T09:18Z' }],
  ]) {
    const result = calculateObjectEvents(AE, body(name), start, loc);
    for (const key of ['rise','transit','set']) minutesNear(result[key],reference[key]);
  }
});

// Independent limiting calculation: J2000 GMST at noon =18.697374558h,
// sidereal/solar rate1.00273790935. Constant J2000 RA/dec gives meridian and
// horizon times through spherical trigonometry, without the engine's searches.
// Reference: USNO approximate sidereal time and the spherical horizon equation.
// https://aa.usno.navy.mil/faq/GAST and AE SearchRiseSet's documented34' threshold.
function analyticJ2000StarEvents(item, loc) {
  const origin = new Date('2000-01-01T12:00:00Z').getTime();
  const rad = Math.PI/180, threshold = -34/60*rad;
  const latitude = loc.lat*rad, declination = item.dec*rad;
  const cosH = (Math.sin(threshold)-Math.sin(latitude)*Math.sin(declination)) / (Math.cos(latitude)*Math.cos(declination));
  const h = Math.acos(cosH)/rad/15;
  const mod24 = x => ((x%24)+24)%24;
  const at = hourAngle => new Date(origin + mod24(item.raH-loc.lon/15+hourAngle-18.697374558)/1.00273790935*3600000).toISOString();
  return { rise:at(-h), transit:at(0), set:at(h) };
}
test('Sirius J2000 events match independent spherical horizon and sidereal limit', () => {
  const instant = new Date('2000-01-01T12:00:00Z');
  const result = calculateObjectEvents(AE, sirius, instant, london);
  const reference = analyticJ2000StarEvents(sirius, london);
  for (const key of ['rise','set','transit']) minutesNear(result[key], reference[key], 1);
});
test('Polaris is circumpolar in London; null horizon events are not invented', () => {
  // 51.5+89.26411>90: minimum geometric altitude is roughly50.76°.
  const result = calculateObjectEvents(AE, polaris, date, london);
  assert.equal(result.rise,null); assert.equal(result.set,null); assert.notEqual(result.transit,null);
  assert.match(result.note,/No rise or set in this 48-hour window/);
});
test('Polaris stays below the horizon in Sydney but can have a meridian crossing', () => {
  const result = calculateObjectEvents(AE, polaris, date, {lat:-33.9,lon:151.2});
  assert.equal(result.rise,null); assert.equal(result.set,null); assert.notEqual(result.transit,null);
  assert.match(result.note,/even when the object is below the horizon/);
});
test('polar Sun no-event and exact-pole transit are explicit', () => {
  const summer = new Date('2026-06-21T12:00:00Z');
  for (const latitude of [89,90,-90]) {
    const result = calculateObjectEvents(AE,body('Sun'),summer,{lat:latitude,lon:0});
    assert.equal(result.error,undefined); assert.equal(result.rise,null); assert.equal(result.set,null);
    if (Math.abs(latitude)===90) { assert.equal(result.transit,null); assert.match(result.note,/geographic pole/); }
  }
});
test('all supported planets have bounded future events without stale coordinates', () => {
  for (const name of ['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune']) {
    const result=calculateObjectEvents(AE,body(name),date,london);
    assert.equal(result.error,undefined,name);
    for (const key of ['rise','set','transit']) {
      assert.ok(Number.isFinite(Date.parse(result[key])),`${name} ${key}`);
      assert.ok(new Date(result[key])>=date && new Date(result[key])-date<=48*3600000);
    }
  }
});
test('simulated date and changed longitude recalculate events', () => {
  const first=calculateObjectEvents(AE,sirius,date,london);
  const later=calculateObjectEvents(AE,sirius,new Date('2026-12-05T00:00Z'),london);
  const east=calculateObjectEvents(AE,sirius,date,{lat:51.5,lon:30});
  assert.notEqual(first.transit,later.transit);
  assert.ok(Math.abs((new Date(first.transit)-new Date(east.transit))/3600000-2)<0.02);
});
test('fixed-star reservation does not mutate another engine slot; repeated objects are independent', () => {
  AE.DefineStar('Star1',12.5,-20,1000);
  const prior=AE.Equator('Star1',date,new AE.Observer(0,0,0),true,true);
  const first=calculateObjectEvents(AE,sirius,date,london);
  calculateObjectEvents(AE,polaris,date,london);
  assert.deepEqual(calculateObjectEvents(AE,sirius,date,london),first);
  const after=AE.Equator('Star1',date,new AE.Observer(0,0,0),true,true);
  assert.equal(prior.ra,after.ra); assert.equal(prior.dec,after.dec);
});
test('unavailable or invalid inputs return explicit errors and no fabricated event', () => {
  const cases=[
    [null,body('Sun'),date,london,'engine-unavailable'],
    [AE,body('Sun'),new Date(NaN),london,'invalid-time'],
    [AE,body('Sun'),new Date('1899-12-31T23:59Z'),london,'invalid-time'],
    [AE,body('Sun'),new Date('2101-01-01T00:00Z'),london,'invalid-time'],
    [AE,body('Sun'),date,{lat:NaN,lon:0},'invalid-location'],
    [AE,body('Sun'),date,{lat:91,lon:0},'invalid-location'],
    [AE,{kind:'dso',name:'M31'},date,london,'unsupported-object'],
    [AE,{...sirius,name:'Sol',raH:0,dec:0},date,london,'unsupported-object'],
    [AE,{...sirius,raH:24},date,london,'unsupported-object'],
    [AE,{...sirius,dec:91},date,london,'unsupported-object'],
  ];
  for(const [engine,item,instant,location,error]of cases){
    const result=calculateObjectEvents(engine,item,instant,location);
    assert.equal(result.error,error); for(const key of ['rise','set','transit'])assert.equal(result[key],null);
  }
});
test('engine failures and out-of-window responses never become apparently valid times', () => {
  const broken={...AE,SearchRiseSet(){throw new Error('offline engine failure');}};
  const result=calculateObjectEvents(broken,body('Sun'),date,london);
  assert.equal(result.error,'calculation-failed'); assert.equal(result.rise,null);
  const outside={...AE,SearchRiseSet:()=>({date:new Date('2026-10-08T00:00Z')}),SearchHourAngle:()=>({time:{date:new Date('2026-10-04T00:00Z')}})};
  const empty=calculateObjectEvents(outside,body('Sun'),date,london);
  assert.equal(empty.rise,null);assert.equal(empty.set,null);assert.equal(empty.transit,null);
});
test('input dates and observer objects are not changed by a search', () => {
  const input=new Date(date), location=Object.freeze({...london});
  calculateObjectEvents(AE,sirius,input,location); assert.equal(input.toISOString(),date.toISOString());
});
