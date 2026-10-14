// In-memory pairing sessions: one TV and one or more phones share a 4-digit code.

export const SESSION_TTL_MS = 3 * 60 * 60 * 1000;

export function createSessionStore({ now = () => Date.now(), random = Math.random } = {}) {
  const sessions = new Map(); // code -> { code, createdAt, lastSeen, peers: { tv: Set, phone: Set } }

  function newCode() {
    for (let i = 0; i < 50; i++) {
      const code = String(Math.floor(random() * 10000)).padStart(4, '0');
      if (!sessions.has(code)) return code;
    }
    throw new Error('No free session codes');
  }

  return {
    create() {
      const code = newCode();
      const s = { code, createdAt: now(), lastSeen: now(), peers: { tv: new Set(), phone: new Set() } };
      sessions.set(code, s);
      return s;
    },
    get(code) {
      return sessions.get(code) ?? null;
    },
    touch(code) {
      const s = sessions.get(code);
      if (s) s.lastSeen = now();
    },
    join(code, role, peer) {
      const s = sessions.get(code);
      if (!s || !(role in s.peers)) return null;
      s.peers[role].add(peer);
      s.lastSeen = now();
      return s;
    },
    leave(code, role, peer) {
      sessions.get(code)?.peers[role]?.delete(peer);
    },
    // Peers on the other side of the link.
    others(code, role) {
      const s = sessions.get(code);
      if (!s) return [];
      return [...s.peers[role === 'tv' ? 'phone' : 'tv']];
    },
    sweep() {
      const cutoff = now() - SESSION_TTL_MS;
      for (const [code, s] of sessions) {
        const empty = s.peers.tv.size === 0 && s.peers.phone.size === 0;
        if (empty && s.lastSeen < cutoff) sessions.delete(code);
      }
    },
    size() {
      return sessions.size;
    },
  };
}
