import assert from 'node:assert/strict';
import { takeGlobeTarget } from '../js/main.js';
const now = Date.parse('2026-10-05T23:00:00Z');
const valid = { id: 'plane:abcdef', kind: 'plane', name: 'TEST123', at: now };
function read(value) {
  const items = new Map([['skylens.globe-target.v1', JSON.stringify(value)]]);
  const result = takeGlobeTarget({ getItem: k => items.get(k), removeItem: k => items.delete(k) }, now);
  assert.equal(items.size, 0, 'target is consumed once, including invalid input'); return result;
}
assert.deepEqual(read(valid), valid);
assert.equal(read({ ...valid, id: 'sat:123456789', kind: 'satellite' }).id, 'sat:123456789');
for (const patch of [{ at: now + 1 }, { at: now - 300001 }, { id: '../script' }, { kind: 'satellite' }, { name: 'bad\nname' }]) assert.equal(read({ ...valid, ...patch }), null);
assert.equal(read({ ...valid, coordinates: [1, 2], permission: true }).permission, undefined, 'no location/feed permission transfers');
assert.equal(takeGlobeTarget({ getItem() { throw Error('storage denied'); } }, now), null);
console.log('Globe identity handoff: one-use, age/schema boundaries and permission isolation passed.');
