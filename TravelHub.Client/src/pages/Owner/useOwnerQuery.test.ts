import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api';
import { createOwnerQuerySession } from './useOwnerQuery';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('owner query request lifecycle', () => {
  const sessions: ReturnType<typeof createOwnerQuerySession>[] = [];
  function setup(loader: (signal: AbortSignal) => Promise<string>, pollMs = 5000) {
    let visible = true;
    let current = true;
    const onChange = vi.fn();
    const session = createOwnerQuerySession({
      key: 'account:1:hotel:42', loader, pollMs, onChange,
      isVisible: () => visible, isCurrent: () => current,
    });
    sessions.push(session);
    return {
      session, onChange, state: () => onChange.mock.lastCall?.[0],
      hide: () => { visible = false; session.pause(); },
      show: () => { visible = true; return session.run(); },
      changeAccount: () => { current = false; },
    };
  }
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    sessions.splice(0).forEach((session) => session.dispose());
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('shares in-flight work and starts the polling delay after the response settles', async () => {
    const pending = deferred<string>();
    const loader = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue('latest');
    const test = setup(loader);
    const first = test.session.run();
    expect(test.session.run(true)).toBe(first);
    await vi.advanceTimersByTimeAsync(6000);
    expect(loader).toHaveBeenCalledTimes(1);
    pending.resolve('initial');
    await first;
    await vi.advanceTimersByTimeAsync(4999);
    expect(loader).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(test.state()).toMatchObject({ data: 'latest', loading: false, refreshing: false });
  });

  it('bounds a loader that ignores abort, releases the lock and ignores its late data', async () => {
    const old = deferred<string>();
    const loader = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue('latest');
    const test = setup(loader);
    const first = test.session.run().catch(() => undefined);
    await vi.advanceTimersByTimeAsync(15000);
    await first;
    expect(loader.mock.calls[0][0].aborted).toBe(true);
    expect(test.state()).toMatchObject({ data: null, loading: false, refreshing: false });
    expect(test.state().error).toContain('timed out');
    await vi.advanceTimersByTimeAsync(5000);
    expect(loader).toHaveBeenCalledTimes(2);
    old.resolve('obsolete');
    await vi.advanceTimersByTimeAsync(0);
    expect(test.state().data).toBe('latest');
  });

  it('allows a retry after a synchronous loader throw and preserves cached data on a network error', async () => {
    const loader = vi.fn().mockImplementationOnce(() => { throw new Error('Offline'); })
      .mockResolvedValueOnce('saved snapshot').mockRejectedValue(new Error('Offline again'));
    const test = setup(loader);
    await expect(test.session.run()).rejects.toThrow('Offline');
    await test.session.run(true);
    await expect(test.session.run(true)).rejects.toThrow('Offline again');
    expect(loader).toHaveBeenCalledTimes(3);
    expect(test.state()).toMatchObject({ data: 'saved snapshot', accessDenied: false, refreshing: false });
  });

  it.each([401, 403, 404])('clears data and stops automatic retries for HTTP %s; explicit retry can restore access', async (status) => {
    const loader = vi.fn().mockResolvedValueOnce('private data').mockRejectedValueOnce(new ApiError('Denied', status, ''))
      .mockResolvedValue('restored');
    const test = setup(loader);
    await test.session.run();
    await vi.advanceTimersByTimeAsync(5000);
    expect(test.state()).toMatchObject({ data: null, accessDenied: true, loading: false, refreshing: false });
    test.hide();
    await test.show();
    await vi.advanceTimersByTimeAsync(30000);
    expect(loader).toHaveBeenCalledTimes(2);
    await test.session.run(true);
    expect(test.state()).toMatchObject({ data: 'restored', accessDenied: false });
  });

  it('pauses while hidden, settles an in-flight response without polling, and refreshes on return', async () => {
    const pending = deferred<string>();
    const loader = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue('returned');
    const test = setup(loader);
    const first = test.session.run();
    await vi.advanceTimersByTimeAsync(0);
    test.hide();
    pending.resolve('hidden response');
    await first;
    await vi.advanceTimersByTimeAsync(30000);
    expect(loader).toHaveBeenCalledTimes(1);
    await test.show();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(test.state().data).toBe('returned');
  });

  it('ignores responses immediately after the account key changes and aborts on disposal', async () => {
    const pending = deferred<string>();
    const loader = vi.fn().mockReturnValue(pending.promise);
    const test = setup(loader);
    const first = test.session.run();
    await vi.advanceTimersByTimeAsync(0);
    const changes = test.onChange.mock.calls.length;
    test.changeAccount();
    test.session.dispose();
    expect(loader.mock.calls[0][0].aborted).toBe(true);
    pending.resolve('previous account data');
    await first;
    await vi.advanceTimersByTimeAsync(30000);
    expect(test.onChange).toHaveBeenCalledTimes(changes);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not invoke a scheduled loader after its session is disposed', async () => {
    const loader = vi.fn().mockResolvedValue('obsolete');
    const test = setup(loader);
    const first = test.session.run();
    test.session.dispose();
    await first;
    expect(loader).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30000);
    expect(loader).not.toHaveBeenCalled();
  });
});
