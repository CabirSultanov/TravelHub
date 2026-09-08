import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { getToken } from '@/services/auth';
import { getDriverErrorMessage } from '@/utils/driverRides';

type FeedState<T> = { data: T; isLoading: boolean; isRefreshing: boolean; isUpdating: boolean; canAct: boolean; accessDenied: boolean; error: string };
type Perform = <R>(action: (token: string, signal: AbortSignal) => Promise<R>, onSuccess: (result: R) => void) => Promise<void>;

export function useDriverFeed<T>(
  loader: (token: string, signal: AbortSignal) => Promise<T>,
  initialData: T,
  { poll = true, enabled = true }: { poll?: boolean; enabled?: boolean } = {},
) {
  const { user, signOut } = useAuth();
  const userId = user?.id ?? null;
  const initial = useRef(initialData);
  const [snapshot, setSnapshot] = useState<FeedState<T> & { userId: number | null }>({
    userId, data: initial.current, isLoading: enabled, isRefreshing: false, isUpdating: false, canAct: false, accessDenied: false, error: '',
  });
  const latest = useRef({ loader, signOut, userId, enabled, snapshot });
  latest.current = { loader, signOut, userId, enabled, snapshot };
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
    let loaded = latest.current.snapshot.userId === userId && !latest.current.snapshot.isLoading;
    const valid = () => alive && latest.current.userId === userId && latest.current.enabled;
    const visible = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const update = (patch: Partial<FeedState<T>>) => {
      if (valid()) setSnapshot((state) => ({
        ...(state.userId === userId ? state : { data: initial.current, error: '', isLoading: true, isRefreshing: false, isUpdating: false, canAct: false, accessDenied: false }),
        userId, ...patch,
      }));
    };
    const stopRead = () => { version++; controller?.abort(); controller = null; clearTimeout(timer); };
    const schedule = () => {
      clearTimeout(timer);
      if (valid() && poll && visible() && !busy && !accessDenied) timer = setTimeout(() => void load(), 10_000);
    };
    const report = async (error: unknown) => {
      if (!valid()) return;
      ready = false;
      const status = (error as { status?: number })?.status;
      accessDenied = status === 401 || status === 403;
      update({ canAct: false, accessDenied, error: getDriverErrorMessage(error), ...(accessDenied ? { data: initial.current } : {}) });
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
      if (!valid() || !visible() || (busy && !reconcile) || controller) return;
      clearTimeout(timer);
      const request = new AbortController();
      controller = request;
      const revision = ++version;
      update({ isLoading: !loaded, isRefreshing: loaded, isUpdating: busy, canAct: ready && !busy });
      try {
        const accessToken = await token();
        if (!valid() || request.signal.aborted) return;
        const data = await latest.current.loader(accessToken, request.signal);
        if (!valid() || revision !== version) return;
        loaded = true;
        ready = true;
        accessDenied = false;
        update({ data, canAct: !busy, accessDenied: false, ...(preserveError ? {} : { error: '' }) });
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
      if (!valid() || !visible() || busy || !ready) return;
      busy = true; // Synchronous guard: even two taps before React renders cannot send two actions.
      stopRead();
      const request = new AbortController();
      controller = request;
      const revision = version;
      let failed = false;
      update({ isUpdating: true, canAct: false, isRefreshing: false, isLoading: false, error: '' });
      try {
        const accessToken = await token();
        if (!valid() || request.signal.aborted) return;
        const result = await action(accessToken, request.signal);
        if (valid() && revision === version) onSuccess(result);
      } catch (error) {
        if (valid() && revision === version) { failed = true; await report(error); }
      } finally {
        if (valid() && revision === version) {
          controller = null;
          // A timeout may still have committed server-side. Read before offering another action.
          if (failed && !accessDenied) await load(true, true);
          busy = false;
          update({ isUpdating: false, canAct: ready });
          schedule();
        }
      }
    };
    const actions = { refresh: () => { void load(); }, perform, setData: (data: T) => update({ data }) };
    operations.current = actions;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
      else {
        clearTimeout(timer);
        if (!busy) { stopRead(); update({ isLoading: false, isRefreshing: false }); }
      }
    });
    void load();
    return () => {
      alive = false;
      stopRead();
      subscription.remove();
      if (operations.current === actions) operations.current = null;
    };
  }, [userId, enabled, poll]));

  const state = snapshot.userId === userId && enabled ? snapshot
    : { data: initial.current, isLoading: enabled && userId !== null, isRefreshing: false, isUpdating: false, canAct: false, accessDenied: false, error: '' };
  return {
    ...state,
    refresh: () => operations.current?.refresh(),
    setData: (data: T) => operations.current?.setData(data),
    perform: (async (action, onSuccess) => { await operations.current?.perform(action, onSuccess); }) as Perform,
  };
}
