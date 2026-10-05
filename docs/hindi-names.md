# Hindi and bilingual object names

Research and implementation date: **2026-10-05 UTC**. This feature changes display/search metadata only. English calculation names, stable object IDs, coordinates, ephemerides and stored favourites remain unchanged.

## Coverage and default

The default is **bilingual** (`सूर्य · Sun`), with Hindi and English alternatives. The curated set covers **11 solar-system objects** (Sun, Moon, eight planets and Pluto), **42 existing catalogue stars**, and **all 88 IAU constellations** represented by 89 local drawing entries. Serpens has separate Caput and Cauda entries. Earth/Pluto naming support does not add them to the sky renderer or change their classification. Sun remains a star, Moon a natural satellite, and Pluto a dwarf planet.

This is **not a Hindi translation of all 1,022 non-Solar catalogue entries**. Unreviewed names and technical identifiers such as `79Zet UMa` and `M31` remain in their original form in every mode. Their detail metadata says the Hindi spelling has not been reviewed. A partial, disclosed name catalogue is preferable to inventing traditional identities or algorithmically mistransliterating hundreds of proper names.

## Primary evidence actually read

**NCERT, _Curiosity_, Class 6, chapter 12 “Beyond Earth”, reprint 2026–27:**
https://ncert.nic.in/textbook/pdf/fecu112.pdf

The official English PDF was fetched and read through Exa on 2026-10-05. It supplies Indian names in Roman transliteration and identifies the following relationships:

| Printed section/pages | Evidence used | Application decision |
|---|---|---|
| Stars and Constellations, pp. 234–236, figures 12.3–12.4 | Polaris/Pole Star is Dhruva tāra; Aldebaran is Rohiṇī; Betelgeuse is Ārdrā. Nakshatra can mean a star or group; Kṛittikā is the Pleiades group. | Dhruv Tara is the displayed Hindi Polaris name. Rohini and Ardra are **separate contextual search aliases**, while the main labels remain transliterations of Aldebaran and Betelgeuse. |
| Our Solar System, Sun, pp. 239–240 | Identifies Sun as Sūrya in India. | `सूर्य · Sun`. Common `सूरज` / Suraj spelling/search variants are editorial vocabulary, not a quoted textbook spelling. |
| Planets, pp. 241–242 | Budha/Mercury, Śhukra/Venus, Pṛithvī/Earth, Mangala/Mars, Bṛihaspati or Guru/Jupiter, Śhani/Saturn. | Standard Hindi labels below. The Devanagari forms and convenient spelling variants are an editorial rendering of the supported names, **not copied from a verified official Hindi PDF**. |
| Solar-system/Moon discussion | Distinguishes Moon, planets and dwarf planet Pluto. | Classifications preserved. `चंद्रमा`, Chandra and Chandrama are common Hindi vocabulary supplied editorially; their naming provenance is explicitly `editorial-hindi`, not a claim that the English PDF prints those Hindi labels. |

Official Hindi PDF fetch attempts did not yield readable content through the research tool. They are **not counted as verified Hindi editions**. Secondary Hindi NCERT-solution results were useful for discovery, but some contained clear science errors or inconsistent spelling; they were not accepted as authoritative star-alias sources.

Five search calls requested 28 candidate results (8 + 5 + 5 + 5 + 5), followed by targeted primary fetches. This is a bounded source check, not an exhaustive survey of Indian sky-name traditions. URLs/identities were verified against the actual catalogue; no protected textbook artwork or substantive text was copied.

### Constellation extension: primary references

The additional constellation request prompted one further search (five candidate results) and targeted primary fetches on **2026-10-05**:

- **IAU, “The Constellations”**: https://www.iau.org/IAU/IAU/Astronomy-FAQs/Constellations.aspx — full page read, including its 88-name table. It defines constellations as sky regions, distinguishes asterisms from constellations, lists Serpens with Caput and Cauda charts, and spells CrA **Corona Australis**. It explicitly notes that there is no single correct pronunciation. The earlier `/public/themes/constellations/` URL failed to fetch; the current URL above was verified. The IAU source supports international names and identities, **not these editorial Hindi spellings**.
- **NCERT chapter 12, pp. 234–236**, same official English PDF above, re-read: the Big Dipper/Saptarshi is **within** Ursa Major, Little Dipper within Ursa Minor, and Pleiades/Krittika is a star group in Taurus. These relationships are contextual notes, not whole-constellation search aliases.

The local catalogue contains **89 entries and 88 distinct IAU abbreviations**. `Serpens Caput` and `Serpens Cauda` share `Ser`; they are not counted as two official constellations. `Corona Austrina` is the retained source-catalogue spelling; `Corona Australis` and its Hindi rendering are accepted search alternatives. Canonical `Serpens` and `Corona Australis` inputs also have labels, without adding duplicate sky objects.

All constellation Hindi labels are **editorial transliterations of retained international names**, not translations of mythological figures, official Hindi nomenclature, traditional Indian sky divisions, or equal-width astrological signs. Ursa Major is not renamed Saptarshi; Taurus is not renamed Krittika; Aries is not renamed Mesha. IAU regions and cultural asterisms can coexist without implying that their extents are identical. The app's existing stick figures are identification guides, not official constellation boundaries. No IAU chart art was copied.

## Naming methods

`js/names.js` attaches a method to every result:

- **Hindi name** (`hindi-name`): the common Hindi solar-system vocabulary. The source supports the object's Indic name/identity; Devanagari rendering and ordinary search spellings are editorial choices.
- **Established traditional name** (`traditional-alias`): presently Polaris → ध्रुव तारा. Its note restricts this to the present-day Pole Star; historical pole stars are not automatically renamed Polaris.
- **Hindi transliteration** (`transliteration`): a readable Devanagari rendering of the retained English/international proper name. These spellings are **editorial**, may have regional alternatives, and are not claimed to be IAU-approved Hindi names or ancient traditional identities.
- **Catalogue name** (`catalogue`): no reviewed Hindi mapping; retain the exact identifier/name rather than invent a translation.

The display name is not an astrological interpretation. In particular, Rohini and Ardra in this module identify traditional associations with individual stars; they do not identify the whole asterism or a 13°20′ zodiac sector, calculate a lunar mansion, or describe the user's birth chart. Krittika is not assigned to Alcyone or another single Pleiades member. Saptarshi is not assigned to one Big Dipper component.

This bounded release does not add Agastya/Canopus, Arundhati/Alcor, Vasistha/Mizar, Swati/Arcturus or Chitra/Spica aliases. Some have well-known traditional associations, but the required primary-source identity/context was not established in this work. Absence from the search aliases means **unreviewed here**, not historically false. Mizar and Alcor retain distinct IDs and display transliterations.

## Solar-system labels

| English identifier | Hindi display | Romanized search examples | Method |
|---|---|---|---|
| Sun | सूर्य | Surya, Sūrya, Suraj | Hindi name |
| Moon | चंद्रमा | Chandrama, Chandra | Common Hindi vocabulary |
| Mercury | बुध | Budh, Budha | Hindi name |
| Venus | शुक्र | Shukra, Śhukra | Hindi name |
| Earth | पृथ्वी | Prithvi, Pṛithvī | Hindi name |
| Mars | मंगल | Mangal, Mangala | Hindi name |
| Jupiter | बृहस्पति | Brihaspati, Bṛihaspati, Guru | Hindi name |
| Saturn | शनि | Shani, Śhani | Hindi name |
| Uranus | यूरेनस | Uranus | Transliteration |
| Neptune | नेप्ट्यून | Neptune | Transliteration |
| Pluto | प्लूटो | Pluto | Transliteration; dwarf planet |

Uranus and Neptune deliberately use transliterations in this release. No claim is made that these are ancient navagraha members. Alternate Hindi regional/conventional names can be added after an appropriate source review.

## API and integration contract

All helpers are deterministic ES-module functions without DOM, network, storage, time or geolocation side effects.

```js
displayName({ id: 'body:Jupiter', name: 'Jupiter', kind: 'planet' });
// 'बृहस्पति · Jupiter'
displayName({ name: 'Sirius', kind: 'star' }, 'hi');
// 'सीरियस'
searchNames({ name: 'Polaris', kind: 'star' }, 'dhruv tara');
// true
displayName({ name: 'Orion', kind: 'constellation' });
// 'ओरायन · Orion'
searchNames({ name: 'Ursa Major', kind: 'constellation' }, 'अर्सा मेजर');
// true
objectNameRecord({ name: 'Aldebaran', kind: 'star' });
// method, methodLabel, traditionalAliases, aliasNote, sourceIds, etc.
```

- `NAME_MODES`: `bilingual`, `hi`, `en`; absent/invalid display mode falls back to bilingual.
- `objectNameRecord(object|string)`: name metadata; also accepts renderer `{kind,data}` wrappers. Known metadata is immutable. No caller object or ID is modified.
- `displayName(object,mode)`: display-only text. Use `textContent` or canvas text methods, never HTML interpolation.
- `searchNames(object,query)`: partial matches across English, Hindi, romanized names, reviewed traditional aliases and existing alternate catalogue names. Empty query matches all; callers retain their own list limits/category filters.
- `normalizeNameQuery(text)`: Latin diacritics, punctuation, repeated spaces, Hindi joiners/nukta spelling variants and Devanagari digits normalize for search. Hindi vowel signs and virama are preserved.
- `NAME_SOURCES` / `NAME_DATA_DATE`: provenance metadata. `NAME_COVERAGE` declares the bounded mapped counts.

Names on aircraft, satellites and other unrelated object kinds are not translated merely because their call sign happens to match a star or planet. A DSO called Andromeda does not inherit the Andromeda constellation label; a star called Orion does not inherit the constellation identity. Unreviewed DSO/catalogue names are preserved.

## Validation and remaining language work

`node tests/names.mjs` runs **13 grouped tests**, all passing on 2026-10-05, covering every body mapping, bilingual default, Hindi/romanized search, Devanagari normalization, contextual aliases, excluded ambiguous group mappings, stable IDs, wrappers, fallback behavior and exact coverage against the checked-in star/constellation catalogues. The constellation tests compare the 88 unique abbreviations against the reviewed IAU list, exercise every one of the 89 Hindi labels, and check Serpens parts, Corona Australis/Austrina, Boötes/Bootes, cross-kind name collisions and asterism/sign exclusions. These validate implementation and declared mappings; they do not certify a universal Indian naming standard or native-speaker consensus on every editorial transliteration.

Future additions should record the source, whether a name denotes one star or a group/sector, alternative Hindi spelling, reviewer and date. Preserve the original catalogue ID and add aliases rather than changing scientific identity. This feature does not claim that the entire interface, all catalogue names, or all source material is translated into Hindi.

## Curated star spellings

The following table is generated from the implemented catalogue metadata. Except Polaris, the main Hindi labels are editorial transliterations; only the separate aliases listed above carry the reviewed traditional associations.

| Catalogue name | Hindi display | Method |
|---|---|---|
| Sirius | सीरियस | Hindi transliteration |
| Canopus | कैनोपस | Hindi transliteration |
| Arcturus | आर्कटुरस | Hindi transliteration |
| Rigil Kentaurus | रिजिल केंटॉरस | Hindi transliteration |
| Vega | वेगा | Hindi transliteration |
| Capella | कैपेला | Hindi transliteration |
| Rigel | राइजल | Hindi transliteration |
| Procyon | प्रोसियॉन | Hindi transliteration |
| Achernar | अकेर्नार | Hindi transliteration |
| Betelgeuse | बीटलजूस | Hindi transliteration |
| Hadar | हदार | Hindi transliteration |
| Altair | अल्टेयर | Hindi transliteration |
| Acrux | एक्रक्स | Hindi transliteration |
| Aldebaran | एल्डेबारन | Hindi transliteration |
| Spica | स्पाइका | Hindi transliteration |
| Antares | एंटेरेस | Hindi transliteration |
| Pollux | पोलक्स | Hindi transliteration |
| Fomalhaut | फ़ोमलहॉट | Hindi transliteration |
| Mimosa | मिमोसा | Hindi transliteration |
| Deneb | डेनेब | Hindi transliteration |
| Toliman | टोलिमन | Hindi transliteration |
| Regulus | रेगुलस | Hindi transliteration |
| Adhara | अधारा | Hindi transliteration |
| Castor | कैस्टर | Hindi transliteration |
| Gacrux | गैक्रक्स | Hindi transliteration |
| Shaula | शौला | Hindi transliteration |
| Bellatrix | बेलाट्रिक्स | Hindi transliteration |
| Elnath | एलनाथ | Hindi transliteration |
| Alnilam | अलनिलम | Hindi transliteration |
| Alnitak | अलनिताक | Hindi transliteration |
| Alioth | एलिओथ | Hindi transliteration |
| Mirfak | मिरफ़ाक | Hindi transliteration |
| Dubhe | डुभे | Hindi transliteration |
| Alkaid | अल्काइड | Hindi transliteration |
| Polaris | ध्रुव तारा | Established traditional name |
| Algol | अल्गोल | Hindi transliteration |
| Mizar | मिज़ार | Hindi transliteration |
| Merak | मेरक | Hindi transliteration |
| Phecda | फेक्डा | Hindi transliteration |
| Albireo | अल्बिरियो | Hindi transliteration |
| Megrez | मेग्रेज़ | Hindi transliteration |
| Alcor | एल्कोर | Hindi transliteration |

## Constellation spellings

All labels below use the **Hindi transliteration** method. This table lists the 89 source-catalogue entries; the two Serpens rows count as one of the 88 IAU constellations. Traditional aliases are intentionally empty.

| IAU abbreviation | Catalogue label | Editorial Hindi display |
|---|---|---|
| And | Andromeda | एंड्रोमेडा |
| Ant | Antlia | एंट्लिया |
| Aps | Apus | एपस |
| Aqr | Aquarius | अक्वेरियस |
| Aql | Aquila | अक्विला |
| Ara | Ara | आरा |
| Ari | Aries | एरीज़ |
| Aur | Auriga | ऑराइगा |
| Boo | Boötes | बोओटीज़ |
| Cae | Caelum | सीलम |
| Cam | Camelopardalis | कैमेलोपार्डालिस |
| Cnc | Cancer | कैंसर |
| CVn | Canes Venatici | केनीज़ वेनैटिसाई |
| CMa | Canis Major | केनिस मेजर |
| CMi | Canis Minor | केनिस माइनर |
| Cap | Capricornus | कैप्रिकॉर्नस |
| Car | Carina | करीना |
| Cas | Cassiopeia | कैसिओपिया |
| Cen | Centaurus | सेंटॉरस |
| Cep | Cepheus | सीफियस |
| Cet | Cetus | सीटस |
| Cha | Chamaeleon | कैमीलियन |
| Cir | Circinus | सर्सिनस |
| Col | Columba | कोलंबा |
| Com | Coma Berenices | कोमा बेरेनाइसीज़ |
| CrA | Corona Austrina | कोरोना ऑस्ट्रिना |
| CrB | Corona Borealis | कोरोना बोरिऐलिस |
| Crv | Corvus | कॉर्वस |
| Crt | Crater | क्रेटर |
| Cru | Crux | क्रक्स |
| Cyg | Cygnus | सिग्नस |
| Del | Delphinus | डेल्फिनस |
| Dor | Dorado | डोराडो |
| Dra | Draco | ड्रेको |
| Equ | Equuleus | इक्वूलियस |
| Eri | Eridanus | इरिडेनस |
| For | Fornax | फ़ॉर्नैक्स |
| Gem | Gemini | जेमिनी |
| Gru | Grus | ग्रस |
| Her | Hercules | हर्क्युलीज़ |
| Hor | Horologium | होरोलोजियम |
| Hya | Hydra | हाइड्रा |
| Hyi | Hydrus | हाइड्रस |
| Ind | Indus | इंडस |
| Lac | Lacerta | लसर्टा |
| Leo | Leo | लियो |
| LMi | Leo Minor | लियो माइनर |
| Lep | Lepus | लेपस |
| Lib | Libra | लीब्रा |
| Lup | Lupus | लूपस |
| Lyn | Lynx | लिंक्स |
| Lyr | Lyra | लाइरा |
| Men | Mensa | मेंसा |
| Mic | Microscopium | माइक्रोस्कोपियम |
| Mon | Monoceros | मोनोसेरस |
| Mus | Musca | मस्का |
| Nor | Norma | नॉर्मा |
| Oct | Octans | ऑक्टैन्स |
| Oph | Ophiuchus | ओफ़ियूकस |
| Ori | Orion | ओरायन |
| Pav | Pavo | पावो |
| Peg | Pegasus | पेगसस |
| Per | Perseus | पर्सियस |
| Phe | Phoenix | फ़ीनिक्स |
| Pic | Pictor | पिक्टर |
| Psc | Pisces | पाइसीज़ |
| PsA | Piscis Austrinus | पाइसिस ऑस्ट्राइनस |
| Pup | Puppis | पपिस |
| Pyx | Pyxis | पिक्सिस |
| Ret | Reticulum | रेटिक्युलम |
| Sge | Sagitta | सजिटा |
| Sgr | Sagittarius | सैजिटेरियस |
| Sco | Scorpius | स्कॉर्पियस |
| Scl | Sculptor | स्कल्प्टर |
| Sct | Scutum | स्क्यूटम |
| Ser | Serpens Caput | सर्पेन्स कैपुट |
| Ser | Serpens Cauda | सर्पेन्स कॉडा |
| Sex | Sextans | सेक्स्टैन्स |
| Tau | Taurus | टॉरस |
| Tel | Telescopium | टेलिस्कोपियम |
| Tri | Triangulum | ट्राइऐंग्युलम |
| TrA | Triangulum Australe | ट्राइऐंग्युलम ऑस्ट्राली |
| Tuc | Tucana | टुकाना |
| UMa | Ursa Major | अर्सा मेजर |
| UMi | Ursa Minor | अर्सा माइनर |
| Vel | Vela | वीला |
| Vir | Virgo | वर्गो |
| Vol | Volans | वोलैन्स |
| Vul | Vulpecula | वल्पेक्युला |
