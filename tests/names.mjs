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
