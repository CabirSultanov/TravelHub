import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { getToken } from '@/services/auth';

type FeedState<T> = { data: T; hasLoaded: boolean; isLoading: boolean; isRefreshing: boolean; isUpdating: boolean; canAct: boolean; accessDenied: boolean; error: string };
type Perform = <R>(action: (token: string, signal: AbortSignal) => Promise<R>, onSuccess?: (result: R) => void) => Promise<boolean>;
export type FeedOptions<T> = {
  poll?: boolean;
  enabled?: boolean;
  resourceKey?: string;
  delayMs?: number;
  stopPolling?: (data: T) => boolean;
  refreshAfterAction?: boolean;
};

export function useAuthenticatedFeed<T>(
  loader: (token: string, signal: AbortSignal) => Promise<T>,
  initialData: T,
  { poll = true, enabled = true, resourceKey = '', delayMs = 0, stopPolling, refreshAfterAction = false }: FeedOptions<T>,
  errorMessage: (error: unknown) => string,
) {
  const { user, signOut } = useAuth();
  const userId = user?.id ?? null;
  const key = `${userId}:${user?.role}:${resourceKey}`;
  const initial = useRef(initialData);
  const [snapshot, setSnapshot] = useState<FeedState<T> & { key: string }>({
    key, data: initial.current, hasLoaded: false, isLoading: enabled, isRefreshing: false, isUpdating: false, canAct: false, accessDenied: false, error: '',
  });
  const latest = useRef({ loader, signOut, key, enabled, snapshot, stopPolling, errorMessage, refreshAfterAction });
  latest.current = { loader, signOut, key, enabled, snapshot, stopPolling, errorMessage, refreshAfterAction };
  const operations = useRef<{ refresh: () => void; perform: Perform; setData: (data: T) => void } | null>(null);

  useFocusEffect(useCallback(() => {
    if (userId === null || !enabled) return;
    let alive = true;
    let busy = false;
    let ready = false;
    let accessDenied = false;
    let version = 0;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let loaded = latest.current.snapshot.key === key && latest.current.snapshot.hasLoaded;
    let lastData = loaded ? latest.current.snapshot.data : initial.current;
    const valid = () => alive && latest.current.key === key && latest.current.enabled;
    const visible = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const update = (patch: Partial<FeedState<T>>) => {
      if (valid()) setSnapshot((state) => ({
        ...(state.key === key ? state : { data: initial.current, hasLoaded: false, error: '', isLoading: true, isRefreshing: false, isUpdating: false, canAct: false, accessDenied: false }),
        key, ...patch,
      }));
    };
    const stopRead = () => { version++; controller?.abort(); controller = null; clearTimeout(timer); };
    const schedule = () => {
      clearTimeout(timer);
      if (valid() && poll && visible() && !busy && !accessDenied && !latest.current.stopPolling?.(lastData)) timer = setTimeout(() => void load(), 10_000);
    };
    const report = async (error: unknown) => {
      if (!valid()) return;
      ready = false;
      const status = (error as { status?: number })?.status;
      accessDenied = status === 401 || status === 403;
      if (accessDenied) { loaded = false; lastData = initial.current; }
      update({ canAct: false, accessDenied, error: latest.current.errorMessage(error), ...(accessDenied ? { data: initial.current, hasLoaded: false } : {}) });
      if (status === 401) {
        try { await latest.current.signOut(); } catch { /* AuthContext still clears its local user in finally. */ }
      }
    };
    async function token() {
      const stored = await getToken();
      if (!stored) throw Object.assign(new Error('Session expired'), { status: 401 });
      return stored;
    }
    async function load(preserveError = false, reconcile = false) {
      if (!valid() || (!visible() && !reconcile) || (busy && !reconcile) || controller) return false;
      clearTimeout(timer);
      const request = new AbortController();
      controller = request;
      const revision = ++version;
      update({ isLoading: !loaded, isRefreshing: loaded, isUpdating: busy, canAct: ready && !busy });
      try {
        const accessToken = await token();
        if (!valid() || request.signal.aborted) return false;
        const data = await latest.current.loader(accessToken, request.signal);
        if (!valid() || revision !== version) return false;
        loaded = true;
        lastData = data;
        ready = true;
        accessDenied = false;
        update({ data, hasLoaded: true, canAct: !busy, accessDenied: false, ...(preserveError ? {} : { error: '' }) });
        return true;
      } catch (error) {
        if (valid() && revision === version) await report(error);
      } finally {
        if (valid() && revision === version) {
          controller = null;
          update({ isLoading: false, isRefreshing: false });
          schedule();
        }
      }
    }
    const perform: Perform = async (action, onSuccess) => {
      if (!valid() || !visible() || busy || !ready) return false;
      busy = true; // Synchronous guard: even two taps before React renders cannot send two actions.
      stopRead();
      const request = new AbortController();
      controller = request;
      const revision = version;
      let failed = false;
      let saved = false;
      let uncertain = false;
      update({ isUpdating: true, canAct: false, isRefreshing: false, isLoading: false, error: '' });
      try {
        const accessToken = await token();
        if (!valid() || request.signal.aborted) return false;
        const result = await action(accessToken, request.signal);
        if (valid() && revision === version) { saved = true; onSuccess?.(result); }
      } catch (error) {
        if (valid() && revision === version) {
          failed = true;
          const status = (error as { status?: number })?.status;
          uncertain = !status || status >= 500;
          await report(error);
        }
      } finally {
        if (valid() && revision === version) {
          controller = null;
          // A timeout may still have committed server-side. Read before offering another action.
          if (failed && !accessDenied) {
            await load(true, true);
            if (uncertain && latest.current.refreshAfterAction && !accessDenied) update({ error: 'The response was lost. The change may have been saved. Check the refreshed details before trying again.' });
          } else if (saved && latest.current.refreshAfterAction) {
            const refreshed = await load(false, true);
            if (!refreshed && !accessDenied) update({ error: 'Change saved, but the latest details could not be loaded. Tap Retry to refresh; do not submit the change again.' });
          }
          busy = false;
          update({ isUpdating: false, canAct: ready });
          schedule();
        }
      }
      return saved && valid();
    };
    const actions = { refresh: () => { void load(); }, perform, setData: (data: T) => { lastData = data; update({ data }); } };
    operations.current = actions;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
      else {
        clearTimeout(timer);
        if (!busy) { stopRead(); update({ isLoading: false, isRefreshing: false }); }
      }
    });
    if (delayMs) timer = setTimeout(() => void load(), delayMs);
    else void load();
    return () => {
      alive = false;
      stopRead();
      subscription.remove();
      if (operations.current === actions) operations.current = null;
    };
  }, [key, enabled, poll, delayMs, userId]));

  const state = snapshot.key === key && enabled ? snapshot
    : { data: initial.current, hasLoaded: false, isLoading: enabled && userId !== null, isRefreshing: false, isUpdating: false, canAct: false, accessDenied: false, error: '' };
  return {
    ...state,
    refresh: () => operations.current?.refresh(),
    setData: (data: T) => operations.current?.setData(data),
    perform: (async (action, onSuccess) => await operations.current?.perform(action, onSuccess) ?? false) as Perform,
  };
}
