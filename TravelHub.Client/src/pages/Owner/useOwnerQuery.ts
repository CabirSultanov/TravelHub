import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { getErrorMessage } from '../../utils/errors';

type OwnerQueryState<T> = {
  key: string; data: T | null; loading: boolean; refreshing: boolean; error: string; accessDenied: boolean;
};

export function createOwnerQuerySession<T>(options: {
  key: string;
  loader: (signal: AbortSignal) => Promise<T>;
  onChange: (state: OwnerQueryState<T>) => void;
  isCurrent: () => boolean;
  isVisible: () => boolean;
  pollMs: number;
}) {
  let state: OwnerQueryState<T> = { key: options.key, data: null, loading: true, refreshing: false, error: '', accessDenied: false };
  let disposed = false;
  let inFlight: Promise<void> | null = null;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const active = () => !disposed && options.isCurrent();
  const pause = () => { clearTimeout(timer); };

  function update(patch: Partial<OwnerQueryState<T>>) {
    if (!active()) return;
    state = { ...state, ...patch };
    options.onChange(state);
  }

  function run(manual = false): Promise<void> {
    if (!active() || (!manual && (state.accessDenied || !options.isVisible()))) return Promise.resolve();
    if (inFlight) return inFlight;
    pause();
    controller = new AbortController();
    const requestController = controller;
    update({ refreshing: true });
    // Defer invocation so even a synchronous loader failure releases an assigned lock.
    inFlight = Promise.resolve().then(async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let onAbort = () => {};
      try {
        if (!active()) return;
        const aborted = new Promise<never>((_, reject) => {
          onAbort = () => reject(new Error('The request timed out.'));
          requestController.signal.addEventListener('abort', onAbort, { once: true });
        });
        timeout = setTimeout(() => requestController.abort(), 15_000);
        // Bound the whole call, including authentication refresh and loaders that ignore abort.
        const data = await Promise.race([options.loader(requestController.signal), aborted]);
        if (!active() || requestController.signal.aborted) return;
        update({ data, loading: false, refreshing: false, error: '', accessDenied: false });
      } catch (error) {
        if (!active()) return;
        const denied = error instanceof ApiError && [401, 403, 404].includes(error.status);
        update({
          loading: false, refreshing: false, accessDenied: denied,
          data: denied ? null : state.data,
          error: denied ? 'Access unavailable. Your hotel assignment or account may have changed.'
            : `${options.pollMs ? 'Connection lost. Retrying… ' : 'Could not load this information. '}${requestController.signal.aborted ? 'The request timed out.' : getErrorMessage(error)}`,
        });
        throw error;
      } finally {
        clearTimeout(timeout);
        requestController.signal.removeEventListener('abort', onAbort);
        inFlight = null;
        if (controller === requestController) controller = null;
        if (active() && options.pollMs && !state.accessDenied && options.isVisible()) {
          timer = setTimeout(() => { void run().catch(() => undefined); }, options.pollMs);
        }
      }
    });
    return inFlight;
  }

  return {
    run, pause,
    dispose: () => { disposed = true; pause(); controller?.abort(); },
  };
}

// Each mounted query owns one request. Its key is also checked during render,
// so an account/filter change cannot briefly display the preceding result.
export function useOwnerQuery<T>(key: string, loader: (signal: AbortSignal) => Promise<T>, pollMs = 0) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const currentKey = useRef(key);
  currentKey.current = key;
  const runRef = useRef<() => Promise<void>>(async () => undefined);
  const [state, setState] = useState<OwnerQueryState<T>>({ key, data: null, loading: true, refreshing: false, error: '', accessDenied: false });

  useEffect(() => {
    setState({ key, data: null, loading: true, refreshing: false, error: '', accessDenied: false });
    const session = createOwnerQuerySession({
      key, loader: (signal) => loaderRef.current(signal), onChange: setState,
      isCurrent: () => currentKey.current === key, isVisible: () => !document.hidden, pollMs,
    });
    runRef.current = () => session.run(true);
    function onVisibility() {
      session.pause();
      if (!document.hidden) void session.run().catch(() => undefined);
    }
    void session.run().catch(() => undefined);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      session.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [key, pollMs]);

  const reload = useCallback(() => runRef.current(), []);
  return {
    ...(state.key === key ? state : { data: null, loading: true, refreshing: false, error: '', accessDenied: false }),
    reload,
  };
}
