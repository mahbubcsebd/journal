'use client';

import { useEffect, useState, type RefObject } from 'react';
import { wsUrl } from './format';
import type {
  Analysis,
  Bias,
  Candle,
  PriceAlert,
  ReactionBrief,
  ServerMessage,
  TF,
} from './types';

export interface FeedHandlers {
  onSnapshot(candles: Candle[], digits: number): void;
  onTick(candle: Candle): void;
  onAlert?(alert: PriceAlert, message: string): void;
}

export interface FeedState {
  /** `stale`: socket is open but no price has arrived for STALE_MS (MT5 or the bridge stopped). */
  status: 'connecting' | 'live' | 'stale' | 'offline' | 'error';
  error: string | null;
  source: 'mock' | 'mt5' | null;
  digits: number;
  analysis: Analysis | null;
  bias: Bias | null;
  reaction: ReactionBrief | null;
  price: number | null;
}

const INITIAL: FeedState = {
  status: 'connecting',
  error: null,
  source: null,
  digits: 2,
  analysis: null,
  bias: null,
  reaction: null,
  price: null,
};

/** The server sends a tick about once a second, even when the market is closed. */
const STALE_MS = 15_000;
const STALE_CHECK_MS = 5_000;

/** Live candles go straight to the chart through `handlers`; everything else is React state. */
export function useFeed(
  symbol: string,
  tf: TF,
  handlers: RefObject<FeedHandlers | null>,
  enabled = true,
) {
  const [state, setState] = useState<FeedState>(INITIAL);

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastDataAt = Date.now();
    const staleCheck = setInterval(() => {
      if (Date.now() - lastDataAt < STALE_MS) return;
      setState((s) => (s.status === 'live' ? { ...s, status: 'stale' } : s));
    }, STALE_CHECK_MS);

    const scheduleRetry = () => {
      timer = setTimeout(connect, Math.min(8000, 1000 * 2 ** retry++));
    };

    const connect = async () => {
      setState((s) => ({
        ...s,
        status: s.status === 'live' ? 'connecting' : s.status,
        analysis: null,
        reaction: null,
      }));
      let url: string;
      try {
        url = await wsUrl();
      } catch (err) {
        if (closed) return;
        const message = err instanceof Error ? err.message : 'Live feed unavailable';
        setState((s) => ({ ...s, status: 'offline', error: message }));
        scheduleRetry();
        return;
      }
      if (closed) return;
      ws = new WebSocket(url);
      ws.onopen = () =>
        ws?.send(JSON.stringify({ type: 'subscribe', symbol, tf }));
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as ServerMessage;
        if (msg.type === 'error') {
          setState((s) => ({ ...s, status: 'error', error: msg.message }));
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (!closed && ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'subscribe', symbol, tf }));
            }
          }, 4000);
          return;
        }
        if (msg.type === 'alert') {
          handlers.current?.onAlert?.(msg.alert, msg.message);
          return;
        }
        if (msg.symbol !== symbol || msg.tf !== tf) return;
        if (msg.type !== 'analysis') lastDataAt = Date.now();
        if (msg.type === 'snapshot') {
          retry = 0;
          handlers.current?.onSnapshot(msg.candles, msg.digits);
          setState({
            status: 'live',
            error: null,
            source: msg.source,
            digits: msg.digits,
            analysis: msg.analysis,
            bias: msg.bias,
            reaction: msg.reaction ?? null,
            price: msg.candles[msg.candles.length - 1]?.close ?? null,
          });
        } else if (msg.type === 'tick') {
          handlers.current?.onTick(msg.candle);
          setState((s) => {
            if (s.price === msg.candle.close && s.status !== 'stale') return s;
            return {
              ...s,
              price: msg.candle.close,
              status: s.status === 'stale' ? 'live' : s.status,
            };
          });
        } else {
          setState((s) => ({
            ...s,
            analysis: msg.analysis,
            bias: msg.bias,
            reaction: msg.reaction ?? null,
          }));
        }
      };
      ws.onclose = () => {
        if (closed) return;
        setState((s) =>
          s.status === 'error' ? s : { ...s, status: 'offline' },
        );
        scheduleRetry();
      };
    };

    void connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(staleCheck);
      ws?.close();
    };
  }, [symbol, tf, handlers, enabled]);

  return enabled ? state : INITIAL;
}
