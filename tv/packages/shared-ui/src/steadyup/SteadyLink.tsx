// Live link to the phone sensor through the SteadyUp server.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RECONNECT_MS, SERVER_URL } from './config';

export type LiveState = {
  mode: 'idle' | 'reps' | 'hold';
  reps: number;
  standing: boolean;
  angle: number;
  steadiness: number;
};

export type PhoneEvent =
  | { type: 'rep'; reps: number }
  | { type: 'hold_end'; steadiness: number; durationMs: number; meanRms: number; perSecond: number[] }
  | { type: 'possible_fall' };

// Progress the phone keeps (server/public/history.js); null until a phone sends it.
export type Progress = {
  sessions: number;
  streak: number;
  thisWeek: number;
  steadinessFrom: number | null;
  steadinessTo: number | null;
  recent: { date: string; reps: number; best: number | null; exercises: number }[];
};
export type SessionSummary = { reps: number; best: number | null; exercises: number };

type Status = 'creating' | 'ready' | 'error';

export type SteadyLink = {
  status: Status;
  code: string | null;
  qrUri: string | null;
  phoneConnected: boolean;
  live: LiveState;
  progress: Progress | null;
  // Tell the phone a session finished, so it can add it to the user's history.
  recordSession: (session: SessionSummary) => void;
  setMode: (mode: LiveState['mode']) => void;
  calibrate: () => void;
  // Spoken coaching: the phone speaks it; without a phone, the TV speaks it if it can.
  say: (text: string) => void;
  onEvent: (listener: (ev: PhoneEvent) => void) => () => void;
  newSession: () => void;
};

const IDLE: LiveState = { mode: 'idle', reps: 0, standing: false, angle: 0, steadiness: 100 };
const SteadyLinkContext = createContext<SteadyLink | null>(null);

export function SteadyLinkProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('creating');
  const [code, setCode] = useState<string | null>(null);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [live, setLive] = useState<LiveState>(IDLE);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [attempt, setAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const listeners = useRef(new Set<(ev: PhoneEvent) => void>());
  const phoneRef = useRef(false);
  phoneRef.current = phoneConnected;

  // Create a pairing session (again when asked, or when the server forgot ours).
  useEffect(() => {
    let cancelled = false;
    setStatus('creating');
    fetch(`${SERVER_URL}/api/sessions`, { method: 'POST' })
      .then((res) => res.json())
      .then((body: { code: string }) => {
        if (cancelled) return;
        setCode(body.code);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Keep a WebSocket open for the current code.
  useEffect(() => {
    if (!code) return;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      const ws = new WebSocket(`${SERVER_URL.replace(/^http/, 'ws')}/ws?code=${code}&role=tv`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        const msg = JSON.parse(String(e.data));
        if (msg.type === 'peer' && msg.role === 'phone') setPhoneConnected(Boolean(msg.connected));
        if (msg.type === 'state') {
          setLive({ mode: msg.mode, reps: msg.reps, standing: msg.standing, angle: msg.angle, steadiness: msg.steadiness });
        }
        if (msg.type === 'event') listeners.current.forEach((l) => l(msg.event));
        if (msg.type === 'history' && msg.stats) setProgress(msg.stats);
      };
      ws.onclose = (e) => {
        setPhoneConnected(false);
        if (closed) return;
        if (e.code === 4404) {
          setAttempt((a) => a + 1); // server restarted: start over with a new code
          return;
        }
        retry = setTimeout(open, RECONNECT_MS);
      };
    };
    open();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [code]);

  const send = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const say = useCallback(
    (text: string) => {
      if (phoneRef.current) return send({ type: 'say', text });
      // Browser builds (the /play demo) can speak on the TV itself.
      const synth = (globalThis as any).speechSynthesis;
      const Utterance = (globalThis as any).SpeechSynthesisUtterance;
      if (!synth || !Utterance) return;
      synth.cancel();
      synth.speak(new Utterance(text));
    },
    [send],
  );

  const value = useMemo<SteadyLink>(
    () => ({
      status,
      code,
      qrUri: code ? `${SERVER_URL}/api/sessions/${code}/qr.png` : null,
      phoneConnected,
      live,
      progress,
      recordSession: (session) => send({ type: 'session_done', session }),
      setMode: (mode) => send({ type: 'mode', mode }),
      calibrate: () => send({ type: 'calibrate' }),
      say,
      onEvent: (listener) => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
      newSession: () => setAttempt((a) => a + 1),
    }),
    [status, code, phoneConnected, live, progress, send, say],
  );

  return <SteadyLinkContext.Provider value={value}>{children}</SteadyLinkContext.Provider>;
}

export function useSteadyLink(): SteadyLink {
  const link = useContext(SteadyLinkContext);
  if (!link) throw new Error('useSteadyLink must be used inside SteadyLinkProvider');
  return link;
}
