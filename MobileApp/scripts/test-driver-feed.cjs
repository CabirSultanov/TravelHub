const assert = require('node:assert/strict');
const test = require('node:test');

const { createFeed, loadTypeScript, deferred, spy, flush } = require('./test-support.cjs');

test('GETs stay serial and the next poll starts ten seconds after completion', async () => {
  const pending = deferred();
  const loader = spy(() => pending.promise);
  const feed = createFeed(loader);
  await feed.settle();
  feed.view().refresh();
  await feed.advance(20_000);
  assert.equal(loader.calls.length, 1);
  pending.resolve([{ id: 1 }]);
  assert.deepEqual((await feed.settle()).data, [{ id: 1 }]);
  await feed.advance(9999);
  assert.equal(loader.calls.length, 1);
  await feed.advance(1);
  assert.equal(loader.calls.length, 2);
  feed.blur();
});

test('blur aborts an old GET and its late response cannot update the feed', async () => {
  const pending = deferred();
  const loader = spy(() => pending.promise);
  const feed = createFeed(loader);
  await feed.settle();
  feed.blur();
  assert.equal(loader.calls[0][1].aborted, true);
  pending.resolve([{ id: 1 }]);
  assert.deepEqual((await feed.settle()).data, []);
  await feed.advance(30_000);
  assert.equal(loader.calls.length, 1);
});

test('a new user never receives the previous user response or cached customer data', async () => {
  const previous = deferred();
  const current = deferred();
  const loader = spy(() => loader.calls.length === 1 ? previous.promise : current.promise);
  const feed = createFeed(loader);
  await feed.settle();
  assert.deepEqual(feed.setUser(2).data, []);
  await feed.settle();
  current.resolve([{ id: 2 }]);
  await feed.settle();
  previous.resolve([{ id: 1 }]);
  assert.deepEqual((await feed.settle()).data, [{ id: 2 }]);
  assert.deepEqual(feed.setUser(null).data, []);
  feed.blur();
});

test('401 and a missing SecureStore token sign the user out without endless loading', async () => {
  for (const missingToken of [false, true]) {
    const loader = spy(async () => { throw { status: 401 }; });
    const feed = createFeed(loader, { token: async () => missingToken ? null : 'test-token' });
    await feed.settle();
    assert.equal(feed.signOut.calls.length, 1);
    assert.deepEqual(feed.view().data, []);
    assert.equal(feed.view().isLoading, false);
    if (missingToken) assert.equal(loader.calls.length, 0);
    feed.blur();
  }
});

test('two action taps send only one mutation and invalidate an older GET', async () => {
  const stale = deferred();
  const update = deferred();
  const loader = spy(() => loader.calls.length === 1 ? Promise.resolve([{ id: 1 }]) : stale.promise);
  const action = spy(() => update.promise);
  const success = spy((data) => feed.view().setData(data));
  const feed = createFeed(loader);
  await feed.settle();
  feed.view().refresh();
  await feed.settle();
  const first = feed.view().perform(action, success);
  const second = feed.view().perform(action, success);
  await feed.settle();
  assert.equal(action.calls.length, 1);
  assert.equal(loader.calls[1][1].aborted, true);
  stale.resolve([{ id: 99 }]);
  update.resolve([]);
  await Promise.all([first, second]);
  assert.deepEqual((await feed.settle()).data, []);
  assert.equal(success.calls.length, 1);
  feed.blur();
});

test('failed mutation locks actions until reconciliation finishes', async () => {
  const reconciliation = deferred();
  const loader = spy(() => loader.calls.length === 1 ? Promise.resolve([{ id: 1 }]) : reconciliation.promise);
  const action = spy(async () => { throw { status: 409 }; });
  const secondAction = spy(async () => []);
  const feed = createFeed(loader);
  await feed.settle();
  const mutation = feed.view().perform(action, () => {});
  await feed.settle();
  assert.equal(loader.calls.length, 2);
  assert.equal(feed.view().isUpdating, true);
  assert.equal(feed.view().canAct, false);
  await feed.view().perform(secondAction, () => {});
  assert.equal(secondAction.calls.length, 0);
  reconciliation.resolve([]);
  await mutation;
  const state = await feed.settle();
  assert.equal(state.isUpdating, false);
  assert.equal(state.canAct, true);
  assert.deepEqual(state.data, []);
  feed.blur();
});

test('late mutation success cannot navigate or update a different signed-in user', async () => {
  const pending = deferred();
  const loader = spy(async () => [{ id: loader.calls.length }]);
  const action = spy(() => pending.promise);
  const success = spy();
  const feed = createFeed(loader);
  await feed.settle();
  const mutation = feed.view().perform(action, success);
  await feed.settle();
  feed.setUser(2);
  await feed.settle();
  assert.equal(action.calls[0][1].aborted, true);
  pending.resolve({ id: 99 });
  await mutation;
  assert.equal(success.calls.length, 0);
  assert.deepEqual((await feed.settle()).data, [{ id: 2 }]);
  feed.blur();
});

test('a failed reconciliation keeps actions disabled until a later successful retry', async () => {
  const loader = spy(() => loader.calls.length === 2 ? Promise.reject({ status: 0 }) : Promise.resolve([{ id: 1 }]));
  const action = spy(async () => { throw { status: 409 }; });
  const nextAction = spy(async () => {});
  const feed = createFeed(loader);
  await feed.settle();
  await feed.view().perform(action, () => {});
  assert.equal((await feed.settle()).canAct, false);
  assert.equal(feed.view().isUpdating, false);
  await feed.view().perform(nextAction, () => {});
  assert.equal(nextAction.calls.length, 0);
  assert.equal((await feed.advance(10_000)).canAct, true);
  feed.blur();
});

test('403 clears stale ride details and blocks actions until a fresh successful GET', async () => {
  const loader = spy(() => loader.calls.length === 2 ? Promise.reject({ status: 403 }) : Promise.resolve([{ id: 1 }]));
  const feed = createFeed(loader);
  await feed.settle();
  feed.view().refresh();
  const state = await feed.settle();
  assert.deepEqual(state.data, []);
  assert.equal(state.canAct, false);
  assert.match(state.error, /assignment/i);
  const action = spy(async () => {});
  await feed.view().perform(action, () => {});
  assert.equal(action.calls.length, 0);
  await feed.advance(30_000);
  assert.equal(loader.calls.length, 2);
  feed.view().refresh();
  assert.equal((await feed.settle()).canAct, true);
  assert.deepEqual(feed.view().data, [{ id: 1 }]);
  feed.blur();
});

test('backgrounding pauses reads and returning active immediately reloads', async () => {
  const loader = spy(async () => [{ id: 1 }]);
  const feed = createFeed(loader);
  await feed.settle();
  feed.setAppState('background');
  await feed.advance(30_000);
  assert.equal(loader.calls.length, 1);
  feed.setAppState('active');
  await feed.settle();
  assert.equal(loader.calls.length, 2);
  feed.blur();
});

test('API timeout still covers the response body after headers arrive', async () => {
  let timeout;
  let networkSignal;
  const clear = spy();
  const { api, ApiError } = loadTypeScript('../src/services/api.ts', {
    '@/config/apiConfig': { getApiBaseUrl: () => 'http://test.invalid' },
  }, {
    setTimeout: (callback, milliseconds) => { timeout = { callback, milliseconds }; return 1; },
    clearTimeout: clear,
    fetch: async (_, init) => {
      networkSignal = init.signal;
      return {
        ok: true,
        text: () => new Promise((_, reject) => networkSignal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })),
      };
    },
  });
  const request = api.getAvailableRides('test-token');
  const rejected = assert.rejects(request, (error) => error instanceof ApiError && error.status === 0);
  await flush();
  assert.equal(timeout.milliseconds, 15_000);
  assert.equal(clear.calls.length, 0);
  timeout.callback();
  await rejected;
  assert.equal(networkSignal.aborted, true);
  assert.equal(clear.calls.length, 1);
});

test('caller cancellation aborts the API body read as AbortError, not a network failure', async () => {
  const controller = new AbortController();
  const { api } = loadTypeScript('../src/services/api.ts', {
    '@/config/apiConfig': { getApiBaseUrl: () => 'http://test.invalid' },
  }, {
    fetch: async (_, { signal }) => ({
      ok: true,
      text: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })),
    }),
  });
  const request = api.getAvailableRides('test-token', controller.signal);
  const rejected = assert.rejects(request, { name: 'AbortError' });
  await flush();
  controller.abort();
  await rejected;
});

test('successful API calls remove the caller abort listener', async () => {
  let networkSignal;
  const controller = new AbortController();
  const { api } = loadTypeScript('../src/services/api.ts', {
    '@/config/apiConfig': { getApiBaseUrl: () => 'http://test.invalid' },
  }, {
    fetch: async (_, { signal }) => {
      networkSignal = signal;
      return { ok: true, text: async () => '[]' };
    },
  });
  assert.deepEqual(await api.getAvailableRides('test-token', controller.signal), []);
  controller.abort();
  assert.equal(networkSignal.aborted, false);
});

test('only active-ride 404 becomes an empty state; forbidden and expired sessions remain errors', async () => {
  for (const status of [404, 403, 401]) {
    const { api } = loadTypeScript('../src/services/api.ts', {
      '@/config/apiConfig': { getApiBaseUrl: () => 'http://test.invalid' },
    }, { fetch: async () => ({ ok: false, status, text: async () => '' }) });
    const request = api.getActiveRide('test-token');
    if (status === 404) assert.equal(await request, null);
    else await assert.rejects(request, (error) => error.status === status);
  }
});
