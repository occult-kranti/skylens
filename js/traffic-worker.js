// A single bounded CPU task. Fetching, credentials, quotas and lifecycle belong
// to the caller; importing the pure module starts no feed or network request.
import { normalizeTrafficPayload, TRAFFIC_LIMITS } from './traffic-feed.js';

globalThis.addEventListener('message', event => {
  const { id, text, options } = event.data || {};
  if (id !== 1) return;
  try {
    if (typeof text !== 'string' || text.length > TRAFFIC_LIMITS.responseBytes) throw new RangeError('Bounded text required.');
    const result = normalizeTrafficPayload(JSON.parse(text), options);
    globalThis.postMessage({ id, ok: true, result });
  } catch {
    // Never echo arbitrary response text or a URL in the worker error message.
    globalThis.postMessage({ id, ok: false });
  }
});
