const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTypeScript, deferred, spy, flush } = require('./test-support.cjs');

// Focused hook lifecycle harness; native rendering and device storage are outside this check.
function createAuth({ role = 'TaxiDriver', storage = { token: 'previous-token' }, beforeDelete = async () => {} } = {}) {
  const slots = [];
  let index = 0;
  let effects;
  const react = {
    createContext: () => ({ Provider: {} }),
    useState(value) {
      const slot = index++;
      slots[slot] ??= { value };
      return [slots[slot].value, (next) => { slots[slot].value = next; }];
    },
    useEffect(effect, dependencies) {
      const slot = index++;
      if (!slots[slot] || dependencies.some((value, i) => !Object.is(value, slots[slot].dependencies[i]))) {
        slots[slot] = { dependencies };
        effects.push(effect);
      }
    },
  };
  const secureStore = {
    getItemAsync: spy(async () => storage.token),
    setItemAsync: spy(async (_, token) => { storage.token = token; }),
    deleteItemAsync: spy(async () => { await beforeDelete(); storage.token = null; }),
  };
  const user = { id: 1, role };
  const api = {
    login: spy(async () => ({ user, accessToken: 'new-token' })),
    getCurrentUser: spy(async () => user),
  };
  const { AuthProvider } = loadTypeScript('../src/context/AuthContext.tsx', {
    react,
    'react/jsx-runtime': { jsx: (_, props) => props },
    '@/services/api': { api },
    '@/services/auth': loadTypeScript('../src/services/auth.ts', { 'expo-secure-store': secureStore }),
    '@/utils/mobileAccess': loadTypeScript('../src/utils/mobileAccess.ts'),
  });
  function render() {
    index = 0;
    effects = [];
    const { value } = AuthProvider({ children: null });
    effects.forEach((effect) => effect());
    return value;
  }
  render();
  return { view: render, async settle() { await flush(); return render(); }, api, secureStore, storage, user };
}

test('a fresh launch clears the saved token before loading finishes and never restores its user', async () => {
  const pending = deferred();
  const session = createAuth({ beforeDelete: () => pending.promise });
  assert.equal(session.view().isLoading, true);
  assert.equal(session.view().user, null);
  assert.equal(session.secureStore.deleteItemAsync.calls.length, 1);
  pending.resolve();
  const state = await session.settle();
  assert.equal(state.isLoading, false);
  assert.equal(state.user, null);
  assert.equal(session.storage.token, null);
  assert.equal(session.secureStore.getItemAsync.calls.length, 0);
  assert.equal(session.api.getCurrentUser.calls.length, 0);
});

test('a SecureStore deletion failure still finishes startup without restoring a session', async () => {
  const session = createAuth({ beforeDelete: async () => { throw new Error('SecureStore unavailable'); } });
  const state = await session.settle();
  assert.equal(state.isLoading, false);
  assert.equal(state.user, null);
  assert.equal(session.secureStore.deleteItemAsync.calls.length, 1);
  assert.equal(session.secureStore.getItemAsync.calls.length, 0);
  assert.equal(session.api.getCurrentUser.calls.length, 0);
});

test('allowed roles sign in, keep their session across renders and can sign out', async () => {
  for (const role of ['TaxiDriver', 'Admin', 'SuperAdmin']) {
    const session = createAuth({ role });
    await session.settle();
    await session.view().signIn(' driver@example.com ', 'password');
    assert.deepEqual(session.api.login.calls, [[{ email: 'driver@example.com', password: 'password' }]]);
    assert.deepEqual(session.secureStore.setItemAsync.calls, [['travelhub.driver.access-token', 'new-token']]);
    assert.equal(session.view().isSigningIn, false);
    assert.equal(session.view().user, session.user);
    assert.equal((await session.settle()).user, session.user);
    assert.equal(session.storage.token, 'new-token');
    assert.equal(session.secureStore.deleteItemAsync.calls.length, 1);
    await session.view().signOut();
    assert.equal(session.view().user, null);
    assert.equal(session.storage.token, null);
    assert.equal(session.secureStore.deleteItemAsync.calls.length, 2);
  }
});

test('unsupported roles cannot save a token or start a session', async () => {
  for (const role of ['User', 'HotelOwner', 'TaxiOwner']) {
    const session = createAuth({ role });
    await session.settle();
    await assert.rejects(session.view().signIn('user@example.com', 'password'), /only for taxi drivers, admins, and super admins/);
    assert.equal(session.view().user, null);
    assert.equal(session.view().isSigningIn, false);
    assert.equal(session.storage.token, null);
    assert.equal(session.secureStore.setItemAsync.calls.length, 0);
  }
});

test('a new provider requires login again after a previous launch signed in', async () => {
  const previous = createAuth();
  await previous.settle();
  await previous.view().signIn('driver@example.com', 'password');
  const relaunched = createAuth({ storage: previous.storage });
  const state = await relaunched.settle();
  assert.equal(state.user, null);
  assert.equal(state.isLoading, false);
  assert.equal(relaunched.storage.token, null);
  assert.equal(relaunched.api.getCurrentUser.calls.length, 0);
});
