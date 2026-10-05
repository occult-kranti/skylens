// Hindi labels are presentation metadata: catalogue IDs and calculation names never change.
// Source scope, editorial transliterations and alias limits: ../docs/hindi-names.md.
export const NAME_DATA_DATE = '2026-10-05';
export const NAME_MODES = Object.freeze(['bilingual', 'hi', 'en']);
export const NAME_SOURCES = Object.freeze({
  'ncert-curiosity-12': Object.freeze({ title: 'NCERT Curiosity, Class 6, Beyond Earth (2026–27)',
    url: 'https://ncert.nic.in/textbook/pdf/fecu112.pdf', reviewed: NAME_DATA_DATE }),
  'editorial-transliteration': Object.freeze({ title: 'SkyLens editorial Devanagari transliterations',
    url: './docs/hindi-names.md', reviewed: NAME_DATA_DATE }),
  'editorial-hindi': Object.freeze({ title: 'Common Hindi vocabulary; see naming-method notes',
    url: './docs/hindi-names.md', reviewed: NAME_DATA_DATE }),
});

// Remove Latin pronunciation marks, not Devanagari vowel signs/virama.
// Joiners, nukta spelling variants, punctuation and Devanagari digits are search-equivalent.
export function normalizeNameQuery(text) {
  return String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200c\u200d\u093c]/g, '').replace(/[०-९]/g, c => String(c.charCodeAt(0) - 0x0966))
    .replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
}

const METHOD_LABELS = Object.freeze({
  'hindi-name': 'Hindi name', 'traditional-alias': 'Established traditional name',
  transliteration: 'Hindi transliteration', catalogue: 'Catalogue name; Hindi spelling not reviewed',
});
const namedRecords = new Map();
function add(english, hindi, transliteration, kind, method, synonyms = [], traditionalAliases = [], aliasNote = '', sources = null) {
  const sourceIds = sources ? [...sources] : method === 'transliteration' ? ['editorial-transliteration'] : ['ncert-curiosity-12'];
  if (traditionalAliases.length && !sourceIds.includes('ncert-curiosity-12')) sourceIds.push('ncert-curiosity-12');
  const record = Object.freeze({ english, hindi, transliteration, kind, method, methodLabel: METHOD_LABELS[method],
    synonyms: Object.freeze([...synonyms]), traditionalAliases: Object.freeze([...traditionalAliases]),
    aliasNote, sourceIds: Object.freeze(sourceIds) });
  namedRecords.set(normalizeNameQuery(english), record);
}

add('Sun', 'सूर्य', 'Surya', 'sun', 'hindi-name', ['Sūrya', 'Suraj', 'सूरज']);
add('Moon', 'चंद्रमा', 'Chandrama', 'moon', 'hindi-name', ['Chandra', 'चन्द्रमा', 'चंद्र', 'चन्द्र', 'चाँद', 'चांद'], [], '', ['editorial-hindi']);
add('Mercury', 'बुध', 'Budh', 'planet', 'hindi-name', ['Budha']);
add('Venus', 'शुक्र', 'Shukra', 'planet', 'hindi-name', ['Śhukra', 'Sukra']);
add('Earth', 'पृथ्वी', 'Prithvi', 'planet', 'hindi-name', ['Pṛithvī', 'Prithivi']);
add('Mars', 'मंगल', 'Mangal', 'planet', 'hindi-name', ['Mangala']);
add('Jupiter', 'बृहस्पति', 'Brihaspati', 'planet', 'hindi-name', ['Bṛihaspati', 'Brahaspati', 'Guru', 'गुरु', 'वृहस्पति']);
add('Saturn', 'शनि', 'Shani', 'planet', 'hindi-name', ['Śhani', 'Sani']);
// Modern names transliterated; no claim that these are ancient navagraha names.
add('Uranus', 'यूरेनस', 'Uranus', 'planet', 'transliteration', ['युरेनस']);
add('Neptune', 'नेप्ट्यून', 'Neptune', 'planet', 'transliteration', ['नेपच्यून']);
add('Pluto', 'प्लूटो', 'Pluto', 'dwarf-planet', 'transliteration');

// These spellings aid reading; they are not claimed as IAU-approved Hindi translations.
const starSpellings = [
  ['Sirius', 'सीरियस', ['सिरियस']],
  ['Canopus', 'कैनोपस', ['कनोपस']],
  ['Arcturus', 'आर्कटुरस', ['आर्कटूरस']],
  ['Rigil Kentaurus', 'रिजिल केंटॉरस', []],
  ['Vega', 'वेगा', ['वीगा']],
  ['Capella', 'कैपेला', []],
  ['Rigel', 'राइजल', ['रीगेल', 'रिजेल']],
  ['Procyon', 'प्रोसियॉन', ['प्रोसीऑन']],
  ['Achernar', 'अकेर्नार', []],
  ['Betelgeuse', 'बीटलजूस', ['बेटेलजूस']],
  ['Hadar', 'हदार', []],
  ['Altair', 'अल्टेयर', ['अल्तैर']],
  ['Acrux', 'एक्रक्स', []],
  ['Aldebaran', 'एल्डेबारन', ['अल्डेबरान', 'अल्देबारन']],
  ['Spica', 'स्पाइका', ['स्पिका']],
  ['Antares', 'एंटेरेस', ['ऐंटेरेस']],
  ['Pollux', 'पोलक्स', []],
  ['Fomalhaut', 'फ़ोमलहॉट', ['फोमलहौत']],
  ['Mimosa', 'मिमोसा', []],
  ['Deneb', 'डेनेब', []],
  ['Toliman', 'टोलिमन', []],
  ['Regulus', 'रेगुलस', []],
  ['Adhara', 'अधारा', []],
  ['Castor', 'कैस्टर', []],
  ['Gacrux', 'गैक्रक्स', []],
  ['Shaula', 'शौला', []],
  ['Bellatrix', 'बेलाट्रिक्स', []],
  ['Elnath', 'एलनाथ', []],
  ['Alnilam', 'अलनिलम', []],
  ['Alnitak', 'अलनिताक', []],
  ['Alioth', 'एलिओथ', []],
  ['Mirfak', 'मिरफ़ाक', []],
  ['Dubhe', 'डुभे', ['दुभे']],
  ['Alkaid', 'अल्काइड', []],
  ['Mizar', 'मिज़ार', ['मिजार']],
  ['Alcor', 'एल्कोर', []],
  ['Merak', 'मेरक', []],
  ['Phecda', 'फेक्डा', []],
  ['Megrez', 'मेग्रेज़', []],
  ['Algol', 'अल्गोल', []],
  ['Albireo', 'अल्बिरियो', []],
];
const nakshatraNote = 'Traditional name associated with this star; it does not identify the whole nakshatra asterism or zodiac sector.';
for (const [english, hindi, synonyms] of starSpellings) {
  const aliases = english === 'Aldebaran' ? ['रोहिणी', 'Rohini', 'Rohiṇī'] :
    english === 'Betelgeuse' ? ['आर्द्रा', 'Ardra', 'Ārdrā'] : [];
  add(english, hindi, english, 'star', 'transliteration', synonyms, aliases, aliases.length ? nakshatraNote : '');
}
add('Polaris', 'ध्रुव तारा', 'Dhruv Tara', 'star', 'traditional-alias',
  ['Dhruva Tara', 'Dhruva tārā', 'Dhruv', 'ध्रुव', 'ध्रुवतारा', 'पोलारिस', 'Pole Star', 'North Star'],
  ['ध्रुव तारा', 'Dhruva Tara'], 'The present-day Pole Star; not every historical pole star is Polaris.');

export const NAME_COVERAGE = Object.freeze({ bodies: 11, stars: starSpellings.length + 1 });
function inputFields(object) {
  if (typeof object === 'string') return { name: object };
  const data = object?.data && typeof object.data === 'object' ? object.data : object;
  return { name: String(data?.name || data?.label || data?.flight || data?.id || ''),
    kind: object?.kind || data?.kind || '', altName: data?.altName || '', id: data?.id || object?.id || '' };
}
export function objectNameRecord(object) {
  const { name, kind } = inputFields(object);
  const eligible = !kind || ['star', 'sun', 'moon', 'planet', 'body', 'dwarf-planet'].includes(kind);
  const key = normalizeNameQuery(name.replace(/^body:/, ''));
  const known = eligible ? namedRecords.get(key) : null;
  if (known) return known;
  return Object.freeze({ english: name, hindi: null, transliteration: null, kind: kind || 'object',
    method: 'catalogue', methodLabel: METHOD_LABELS.catalogue, synonyms: Object.freeze([]),
    traditionalAliases: Object.freeze([]), aliasNote: '', sourceIds: Object.freeze([]) });
}
export function displayName(object, mode = 'bilingual') {
  const record = objectNameRecord(object);
  if (mode === 'en' || !record.hindi) return record.english;
  if (mode === 'hi') return record.hindi;
  return `${record.hindi} · ${record.english}`;
}
export function searchNames(object, query) {
  const q = normalizeNameQuery(query);
  if (!q) return true;
  const record = objectNameRecord(object), fields = inputFields(object);
  const haystack = [record.english, record.hindi, record.transliteration,
    ...record.synonyms, ...record.traditionalAliases, fields.name, fields.altName, fields.id]
    .filter(Boolean).map(normalizeNameQuery).join(' ');
  return q.split(' ').every(word => haystack.includes(word)) || haystack.replace(/\s/g, '').includes(q.replace(/\s/g, ''));
}
