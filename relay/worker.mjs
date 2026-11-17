// HTTPS-only message relay. The host still owns game state and scoring.
const TTL = 2 * 60 * 60 * 1000;
const MAX_PLAYERS = 24;
const MAX_BODY = 65536;
const MAX_MESSAGES = 12000;
const encoder = new TextEncoder();
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
const hash = async token => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))), b => b.toString(16).padStart(2, '0')).join('');
class HttpError extends Error {constructor(status, code) {super(code);this.status = status;}}
const requireValue = (value, status, code) => {if (!value) throw new HttpError(status, code);};
function allowedOrigin(origin) {
  return origin === 'https://filigor123.github.io' || origin === 'null' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
}
function json(body, status = 200, origin = null) {
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
  if (allowedOrigin(origin)) Object.assign(headers, {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'});
  return new Response(JSON.stringify(body), {status, headers});
}
async function readBody(request) {
  requireValue(Number(request.headers.get('content-length') || 0) <= MAX_BODY, 413, 'message-too-large');
  const reader = request.body?.getReader();let bytes = 0, text = '';
  if (!reader) return {};
  const decoder = new TextDecoder();
  for (;;) {
    const {done, value} = await reader.read();if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY) {await reader.cancel();throw new HttpError(413, 'message-too-large');}
    text += decoder.decode(value, {stream:true});
  }
  text += decoder.decode();
  try {return JSON.parse(text || '{}');} catch {throw new HttpError(400, 'invalid-json');}
}
async function authenticate(request, db, room) {
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{48})$/)?.[1];
  requireValue(token, 401, 'unauthorized');
  const digest = await hash(token);
  if (room.host_token === digest) return 'host';
  const player = await db.prepare('SELECT id FROM players WHERE room_id = ? AND token = ?').bind(room.id, digest).first();
  requireValue(player, 401, 'unauthorized');return player.id;
}
function eventStatement(db, room, sender, recipient, kind, nonce, data, now) {
  return db.prepare('INSERT OR IGNORE INTO messages(room_id, sender, recipient, kind, nonce, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(room, sender, recipient, kind, nonce, JSON.stringify(data), now);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin');
    try {
      if (request.method === 'OPTIONS') return json({}, allowedOrigin(origin) ? 200 : 403, origin);
      if (origin && !allowedOrigin(origin)) throw new HttpError(403, 'origin-not-allowed');
      const url = new URL(request.url), path = url.pathname;
      if (path === '/health' && request.method === 'GET') return json({service:'tv-quiz-rooms',version:1,transport:'https'}, 200, origin);
      const db = env.DB, now = Date.now();
      requireValue(db, 503, 'storage-unavailable');
      if (path === '/api/rooms' && request.method === 'POST') {
        // Bounded lifetime, including abandoned rooms; cleanup runs on new activity.
        await db.prepare('DELETE FROM rooms WHERE expires_at <= ?').bind(now).run();
        const count = await db.prepare('SELECT COUNT(*) AS n FROM rooms').first();
        requireValue(count.n < 200, 503, 'room-limit');
        const id = 'r1-' + randomId(), token = randomId();
        await db.prepare('INSERT INTO rooms(id, host_token, expires_at) VALUES (?, ?, ?)').bind(id, await hash(token), now + TTL).run();
        return json({id,token,expiresAt:now + TTL}, 201, origin);
      }
      const match = path.match(/^\/api\/rooms\/(r1-[a-f0-9]{48})(?:\/(players|events|messages)(?:\/([a-f0-9]{48}))?)?$/);
      requireValue(match, 404, 'not-found');
      const [, roomId, action, target] = match;
      const room = await db.prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId).first();
      requireValue(room, 404, 'peer-unavailable');
      if (room.expires_at <= now) {await db.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId).run();throw new HttpError(410, 'room-expired');}
      if (action === 'players' && !target && request.method === 'POST') {
        const id = randomId(), token = randomId();
        // A single conditional INSERT enforces the player cap even during simultaneous joins.
        const inserted = await db.prepare('INSERT INTO players(id, room_id, token, joined_at) SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM players WHERE room_id = ?) < ?')
          .bind(id, roomId, await hash(token), now, roomId, MAX_PLAYERS).run();
        requireValue(inserted.meta.changes === 1, 409, 'room-full');
        await eventStatement(db, roomId, id, 'host', 'connect', 'connect-' + id, {}, now).run();
        return json({id,token}, 201, origin);
      }
      const identity = await authenticate(request, db, room);
      if (!action && request.method === 'DELETE') {
        requireValue(identity === 'host', 403, 'host-only');
        await db.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId).run();return json({ok:true}, 200, origin);
      }
      if (action === 'players' && target && request.method === 'DELETE') {
        requireValue(identity === 'host' || identity === target, 403, 'forbidden');
        const player = await db.prepare('SELECT id FROM players WHERE room_id = ? AND id = ?').bind(roomId, target).first();
        if (player) await db.batch([
          eventStatement(db, roomId, target, 'host', 'close', 'close-' + target, {}, now),
          db.prepare('DELETE FROM players WHERE room_id = ? AND id = ?').bind(roomId, target)
        ]);
        return json({ok:true}, 200, origin);
      }
      if (action === 'events' && !target && request.method === 'GET') {
        const after = Number(url.searchParams.get('after') || 0);
        requireValue(Number.isSafeInteger(after) && after >= 0, 400, 'invalid-cursor');
        const result = await db.prepare('SELECT id, sender, kind, payload FROM messages WHERE room_id = ? AND recipient = ? AND id > ? ORDER BY id LIMIT 100').bind(roomId, identity, after).all();
        return json({events:result.results.map(row => ({id:row.id,sender:row.sender,kind:row.kind,data:JSON.parse(row.payload)}))}, 200, origin);
      }
      if (action === 'messages' && !target && request.method === 'POST') {
        const {messages} = await readBody(request);
        requireValue(Array.isArray(messages) && messages.length > 0 && messages.length <= MAX_PLAYERS, 400, 'invalid-batch');
        const count = await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE room_id = ?').bind(roomId).first();
        requireValue(count.n + messages.length <= MAX_MESSAGES, 429, 'message-limit');
        let destinations = new Set(['host']);
        if (identity === 'host') {
          const result = await db.prepare('SELECT id FROM players WHERE room_id = ?').bind(roomId).all();
          destinations = new Set(result.results.map(row => row.id));
        }
        const statements = messages.map(message => {
          requireValue(message && typeof message === 'object' && typeof message.nonce === 'string' && /^[a-z0-9-]{1,80}$/.test(message.nonce), 400, 'invalid-message');
          // A player may leave while a broadcast is in flight. Discard that
          // destination, but never let a player address another player.
          if(identity === 'host' && !destinations.has(message.to))return null;
          requireValue(destinations.has(message.to), 403, 'invalid-recipient');
          requireValue(message.data && typeof message.data === 'object' && !Array.isArray(message.data), 400, 'invalid-data');
          return eventStatement(db, roomId, identity, message.to, 'data', message.nonce, message.data, now);
        }).filter(Boolean);
        if(statements.length)await db.batch(statements);return json({ok:true}, 200, origin);
      }
      throw new HttpError(404, 'not-found');
    } catch (error) {
      return json({error:error instanceof HttpError ? error.message : 'server-error'}, error instanceof HttpError ? error.status : 500, origin);
    }
  }
};
