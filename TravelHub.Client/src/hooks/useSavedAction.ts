import { useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../utils/errors';

export type ActionFeedback = { kind: 'success' | 'error' | 'warning'; message: string };

// A failed reload must not be mistaken for a failed write (or cause a duplicate write).
export async function saveAndRefresh(action: () => Promise<void>, refresh: () => Promise<void>, message: string) {
  try {
    await action();
  } catch (error) {
    return { saved: false, feedback: { kind: 'error', message: getErrorMessage(error) } as ActionFeedback };
  }
  try {
    await refresh();
    return { saved: true, feedback: { kind: 'success', message } as ActionFeedback };
  } catch {
    return { saved: true, feedback: {
      kind: 'warning', message: `${message} The change was saved, but the lists could not be refreshed. Reload the lists before making another change.`,
    } as ActionFeedback };
  }
}

export function useSavedAction(onBusyChange?: (busy: boolean) => void) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const locked = useRef(false);
  const needsRefresh = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function setPending(value: boolean) {
    locked.current = value;
    if (mounted.current) { setBusy(value); onBusyChange?.(value); }
  }

  async function run(action: () => Promise<void>, refresh: () => Promise<void>, message: string) {
    if (locked.current || needsRefresh.current) return false;
    setPending(true);
    setFeedback(null);
    const result = await saveAndRefresh(action, refresh, message);
    if (mounted.current) {
      needsRefresh.current = result.feedback.kind === 'warning';
      setFeedback(result.feedback);
    }
    setPending(false);
    return result.saved;
  }

  async function retry(refresh: () => Promise<void>) {
    if (locked.current) return;
    setPending(true);
    try {
      await refresh();
      if (mounted.current) { needsRefresh.current = false; setFeedback({ kind: 'success', message: 'Lists are up to date.' }); }
    } catch (error) {
      if (mounted.current) setFeedback({ kind: needsRefresh.current ? 'warning' : 'error', message: `Could not refresh the lists. ${getErrorMessage(error)}` });
    } finally { setPending(false); }
  }

  return { busy, feedback, needsRefresh: needsRefresh.current, run, retry, clear: () => {
    if (!locked.current && !needsRefresh.current) setFeedback(null);
  } };
}
