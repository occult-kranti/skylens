import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAME_MODES, NAME_COVERAGE, NAME_SOURCES, displayName, objectNameRecord, normalizeNameQuery, searchNames } from '../js/names.js';

const bodies = {
  Sun: 'सूर्य', Moon: 'चंद्रमा', Mercury: 'बुध', Venus: 'शुक्र', Earth: 'पृथ्वी',
  Mars: 'मंगल', Jupiter: 'बृहस्पति', Saturn: 'शनि', Uranus: 'यूरेनस', Neptune: 'नेप्ट्यून', Pluto: 'प्लूटो',
};
test('every supported body has deterministic English, Hindi and default bilingual labels', () => {
  assert.deepEqual(NAME_MODES, ['bilingual', 'hi', 'en']);
  for (const [english, hindi] of Object.entries(bodies)) {
    assert.equal(displayName(english), `${hindi} · ${english}`);
    assert.equal(displayName(english, 'hi'), hindi);
    assert.equal(displayName(english, 'en'), english);
    assert.equal(displayName(english, 'invalid-preference'), `${hindi} · ${english}`);
  }
  assert.equal(objectNameRecord('Sun').kind, 'sun');
  assert.equal(objectNameRecord('Moon').kind, 'moon');
  assert.equal(objectNameRecord('Pluto').kind, 'dwarf-planet');
});

test('Hindi names and romanized search work independently of the displayed language', () => {
  const cases = [['Sun', 'sūrya'], ['Moon', 'चन्द्रमा'], ['Moon', 'चाँद'], ['Mercury', 'Budha'],
    ['Jupiter', 'Bṛihaspati'], ['Jupiter', 'गुरु'], ['Saturn', 'shani'], ['Venus', 'शुक्र']];
  for (const [name, query] of cases) assert.equal(searchNames({ id: `body:${name}`, name, kind: objectNameRecord(name).kind }, query), true, query);
  assert.equal(searchNames('Mars', 'शुक्र'), false);
});

test('normalization preserves Hindi vowel signs and accepts joiners, accents and digit variants', () => {
  assert.equal(normalizeNameQuery('  ŚhUKRA  '), 'shukra');
  assert.equal(normalizeNameQuery('ध्रुव\u200d—तारा'), 'ध्रुव तारा');
  assert.equal(normalizeNameQuery('सीरियस'), 'सीरियस');
  assert.notEqual(normalizeNameQuery('बुध'), normalizeNameQuery('बध'));
  assert.equal(normalizeNameQuery('M३१'), 'm31');
  assert.equal(searchNames({ name: 'M31', kind: 'dso' }, 'M३१'), true);
  assert.equal(searchNames('Fomalhaut', 'फोमलहॉट'), true);
});

test('Polaris is Dhruva Tara and its present-day scope is explicit', () => {
  assert.equal(displayName('Polaris'), 'ध्रुव तारा · Polaris');
  const record = objectNameRecord('Polaris');
  assert.equal(record.method, 'traditional-alias'); assert.match(record.aliasNote, /present-day/);
  for (const query of ['ध्रुव', 'ध्रुवतारा', 'Dhruv Tara', 'Dhruva tārā', 'Pole Star']) assert.equal(searchNames('Polaris', query), true, query);
  assert.equal(searchNames('Thuban', 'ध्रुव'), false, 'a former pole star is not renamed Polaris');
});

test('Rohini and Ardra are contextual aliases, not replacements for whole nakshatras', () => {
  for (const [star, alias] of [['Aldebaran', 'रोहिणी'], ['Betelgeuse', 'आर्द्रा']]) {
    const record = objectNameRecord(star);
    assert.equal(record.method, 'transliteration'); assert.notEqual(record.hindi, alias);
    assert.ok(record.traditionalAliases.includes(alias)); assert.equal(searchNames(star, alias), true);
    assert.match(record.aliasNote, /not identify the whole nakshatra/);
    assert.ok(record.sourceIds.includes('ncert-curiosity-12'));
  }
  assert.equal(searchNames('Alcyone', 'Krittika'), false, 'a Pleiades group name is not assigned to one member');
  assert.equal(searchNames('Dubhe', 'Saptarshi'), false, 'a seven-star pattern is not one star');
});

test('unverified culturally loaded aliases are not silently invented', () => {
  assert.deepEqual(objectNameRecord('Canopus').traditionalAliases, []);
  assert.equal(searchNames('Canopus', 'Agastya'), false);
  assert.equal(searchNames('Mizar', 'Arundhati'), false);
  assert.equal(searchNames('Alcor', 'Arundhati'), false);
  assert.equal(searchNames('Arcturus', 'Swati'), false);
  assert.equal(searchNames('Spica', 'Chitra'), false);
  assert.equal(objectNameRecord('Uranus').method, 'transliteration');
  assert.equal(objectNameRecord('Neptune').method, 'transliteration');
});

test('unknown names and non-astronomical labels retain their catalogue identity', () => {
  assert.equal(displayName({ name: '79Zet UMa', kind: 'star' }, 'hi'), '79Zet UMa');
  assert.equal(displayName({ name: 'M31', altName: 'Andromeda Galaxy', kind: 'dso' }), 'M31');
  assert.equal(searchNames({ name: 'M31', altName: 'Andromeda Galaxy', kind: 'dso' }, 'andromeda'), true);
  assert.equal(displayName({ flight: 'Sirius', kind: 'plane' }, 'hi'), 'Sirius');
  assert.equal(objectNameRecord('79Zet UMa').method, 'catalogue');
  assert.equal(objectNameRecord('79Zet UMa').hindi, null);
  assert.equal(displayName(null), '');
});

test('wrappers, calculation names and stable IDs are never mutated', () => {
  const data = Object.freeze({ id: 'star:46', name: 'Polaris', alt: 32, az: 2 });
  const wrapper = Object.freeze({ kind: 'star', data });
  assert.equal(displayName(wrapper), 'ध्रुव तारा · Polaris');
  assert.equal(data.id, 'star:46'); assert.equal(data.name, 'Polaris');
  assert.equal(objectNameRecord('body:Moon').english, 'Moon');
  assert.equal(displayName(Object.freeze({ id: 'body:Jupiter', name: 'Jupiter', kind: 'planet' })), 'बृहस्पति · Jupiter');
});

test('curated coverage matches real catalogue names and all provenance IDs resolve', () => {
  const catalogue = JSON.parse(readFileSync(new URL('../data/stars.json', import.meta.url), 'utf8'));
  const mapped = catalogue.stars.map(s => objectNameRecord({ name: s[3], kind: 'star' })).filter(r => r.hindi);
  assert.equal(mapped.length, NAME_COVERAGE.stars);
  assert.equal(NAME_COVERAGE.bodies, Object.keys(bodies).length);
  for (const record of [...mapped, ...Object.keys(bodies).map(objectNameRecord)]) {
    assert.ok(record.sourceIds.length);
    for (const id of record.sourceIds) assert.ok(NAME_SOURCES[id], id);
    assert.ok(Object.isFrozen(record)); assert.ok(Object.isFrozen(record.traditionalAliases));
  }
});

test('all 89 plotted constellation entries have Hindi labels for exactly 88 IAU identities', () => {
  const catalogue = JSON.parse(readFileSync(new URL('../data/constellations.json', import.meta.url), 'utf8'));
  // IAU table reviewed 2026-10-05; Serpens is one entry there, two parts in our data.
  const iauIds = 'And Ant Aps Aqr Aql Ara Ari Aur Boo Cae Cam Cnc CVn CMa CMi Cap Car Cas Cen Cep Cet Cha Cir Col Com CrA CrB Crv Crt Cru Cyg Del Dor Dra Equ Eri For Gem Gru Her Hor Hya Hyi Ind Lac Leo LMi Lep Lib Lup Lyn Lyr Men Mic Mon Mus Nor Oct Oph Ori Pav Peg Per Phe Pic Psc PsA Pup Pyx Ret Sge Sgr Sco Scl Sct Ser Sex Tau Tel Tri TrA Tuc UMa UMi Vel Vir Vol Vul'.split(' ');
  assert.equal(NAME_COVERAGE.constellations, 88);
  assert.equal(NAME_COVERAGE.constellationEntries, 89);
  assert.equal(catalogue.length, NAME_COVERAGE.constellationEntries);
  assert.deepEqual([...new Set(catalogue.map(c => c.id))].sort(), iauIds.sort());
  for (const c of catalogue) {
    const object = Object.freeze({ name: c.name, id: c.id, kind: 'constellation' });
    const record = objectNameRecord(object);
    assert.equal(record.kind, 'constellation', c.name);
    assert.equal(record.method, 'transliteration', c.name);
    assert.match(record.hindi, /[\u0900-\u097f]/u, c.name);
    assert.equal(displayName(object), `${record.hindi} · ${c.name}`);
    assert.equal(displayName(object, 'en'), c.name);
    assert.equal(displayName(object, 'hi'), record.hindi);
    assert.equal(searchNames(object, record.hindi), true);
    assert.equal(searchNames(object, c.name), true);
    assert.equal(searchNames(object, c.id), true);
    assert.ok(record.sourceIds.includes('editorial-transliteration'));
    assert.ok(record.sourceIds.includes('iau-constellations'));
    assert.deepEqual(record.traditionalAliases, []);
    for (const id of record.sourceIds) assert.ok(NAME_SOURCES[id], id);
    assert.equal(object.name, c.name); assert.equal(object.id, c.id);
  }
});

test('constellation search accepts Hindi and official Latin variants without changing catalogue spelling', () => {
  assert.equal(displayName({ name: 'Orion', kind: 'constellation' }), 'ओरायन · Orion');
  assert.equal(searchNames({ name: 'Orion', kind: 'constellation' }, 'ओरियन'), true);
  assert.equal(searchNames({ name: 'Boötes', kind: 'constellation' }, 'Bootes'), true);
  assert.equal(searchNames({ name: 'Corona Austrina', kind: 'constellation' }, 'Corona Australis'), true);
  assert.equal(searchNames({ name: 'Corona Austrina', kind: 'constellation' }, 'कोरोना ऑस्ट्रालिस'), true);
  assert.equal(displayName({ name: 'Corona Austrina', kind: 'constellation' }, 'en'), 'Corona Austrina');
  assert.equal(displayName('Corona Australis'), 'कोरोना ऑस्ट्रालिस · Corona Australis');
  assert.equal(displayName({ kind: 'constellation', data: { name: 'Ursa Major', id: 'UMa' } }), 'अर्सा मेजर · Ursa Major');
});

test('Serpens remains one constellation with distinct head and tail labels', () => {
  const head = objectNameRecord({ name: 'Serpens Caput', kind: 'constellation' });
  const tail = objectNameRecord({ name: 'Serpens Cauda', kind: 'constellation' });
  assert.notEqual(head.hindi, tail.hindi);
  assert.match(head.aliasNote, /head part/); assert.match(tail.aliasNote, /tail part/);
  for (const part of [head, tail]) {
    assert.match(part.aliasNote, /one IAU constellation/);
    assert.equal(searchNames({ name: part.english, kind: 'constellation' }, 'सर्पेन्स'), true);
  }
  assert.equal(displayName('Serpens', 'hi'), 'सर्पेन्स');
});

test('asterisms, clusters and zodiac signs are not renamed as whole IAU constellations', () => {
  const major = { name: 'Ursa Major', kind: 'constellation' };
  const taurus = { name: 'Taurus', kind: 'constellation' };
  assert.match(objectNameRecord(major).aliasNote, /Saptarshi.*within.*not the whole/);
  assert.equal(searchNames(major, 'Saptarshi'), false);
  assert.equal(searchNames(major, 'सप्तर्षि'), false);
  assert.equal(searchNames(major, 'Big Dipper'), false);
  assert.match(objectNameRecord(taurus).aliasNote, /Pleiades.*star cluster.*not a separate IAU constellation/);
  assert.equal(searchNames(taurus, 'Pleiades'), false);
  assert.equal(searchNames(taurus, 'Krittika'), false);
  assert.equal(searchNames({ name: 'Aries', kind: 'constellation' }, 'मेष'), false);
  assert.equal(objectNameRecord({ name: 'Pleiades', kind: 'dso' }).kind, 'dso');
  assert.equal(displayName({ name: 'Andromeda', kind: 'dso' }), 'Andromeda');
  assert.equal(displayName({ name: 'Orion', kind: 'satellite' }), 'Orion');
  assert.equal(displayName({ name: 'Orion', kind: 'star' }), 'Orion');
  assert.equal(displayName({ name: 'Sirius', kind: 'constellation' }), 'Sirius');
});
