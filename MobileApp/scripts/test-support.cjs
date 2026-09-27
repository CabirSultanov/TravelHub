const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTypeScript(relativePath, imports = {}, timers = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  });
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', 'setTimeout', 'clearTimeout', 'fetch', outputText)(
    loaded, loaded.exports,
    (name) => { if (!(name in imports)) throw new Error(`Unexpected test import: ${name}`); return imports[name]; },
    timers.setTimeout ?? setTimeout, timers.clearTimeout ?? clearTimeout, timers.fetch ?? globalThis.fetch,
  );
  return loaded.exports;
}

const driverRides = loadTypeScript('../src/utils/driverRides.ts');
const flush = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function spy(implementation = () => {}) {
  const calls = [];
  const result = (...args) => { calls.push(args); return implementation(...args); };
  result.calls = calls;
  return result;
}

// This is a focused lifecycle harness, not a renderer: state/ref slots, focus cleanup and time
// are deterministic. It tests the actual hook source without installing React Native test tools.
function createFeed(loader, { token = async () => 'test-token', poll = true, mode = 'driver', ...options } = {}) {
  const slots = [];
  const scheduled = new Map();
  const listeners = new Set();
  let now = 0;
  let timerId = 0;
  let index = 0;
  let user = { id: 1, role: mode === 'driver' ? 'TaxiDriver' : 'Admin' };
  let focused = true;
  let requestedEffect;
  let activeEffect;
  let cleanup;
  let output;
  const timers = {
    setTimeout: (callback, delay) => { const id = ++timerId; scheduled.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: (id) => scheduled.delete(id),
  };
  const react = {
    useRef(value) { const slot = index++; slots[slot] ??= { current: value }; return slots[slot]; },
    useState(value) {
      const slot = index++;
      slots[slot] ??= { value };
      return [slots[slot].value, (next) => { slots[slot].value = typeof next === 'function' ? next(slots[slot].value) : next; }];
    },
    useCallback(callback, dependencies) {
      const slot = index++;
      if (!slots[slot] || dependencies.some((value, i) => !Object.is(value, slots[slot].dependencies[i]))) {
        slots[slot] = { callback, dependencies };
      }
      return slots[slot].callback;
    },
  };
  const AppState = {
    currentState: 'active',
    addEventListener: (_, callback) => { listeners.add(callback); return { remove: () => listeners.delete(callback) }; },
  };
  const signOut = spy(async () => { user = null; render(); });
  const imports = {
    react,
    'react-native': { AppState },
    'expo-router': { useFocusEffect: (effect) => { requestedEffect = effect; } },
    '@/context/AuthContext': { useAuth: () => ({ user, signOut }) },
    '@/services/auth': { getToken: token },
    '@/utils/driverRides': driverRides,
  };
  const common = loadTypeScript('../src/hooks/useAuthenticatedFeed.ts', imports, timers);
  const { useDriverFeed } = loadTypeScript('../src/hooks/useDriverFeed.ts', { ...imports, './useAuthenticatedFeed': common }, timers);
  const { useControlFeed } = loadTypeScript('../src/hooks/useControlFeed.ts', {
    ...imports, './useAuthenticatedFeed': common,
    '@/utils/mobileAccess': loadTypeScript('../src/utils/mobileAccess.ts'),
    '@/utils/adminControl': loadTypeScript('../src/utils/adminControl.ts'),
  }, timers);
  function render() {
    index = 0;
    output = (mode === 'driver' ? useDriverFeed : useControlFeed)(loader, [], { poll, ...options });
    if (focused && requestedEffect !== activeEffect) {
      cleanup?.();
      activeEffect = requestedEffect;
      cleanup = activeEffect();
    }
    return output;
  }
  render();
  return {
    view: render,
    signOut,
    async settle() { await flush(); return render(); },
    async advance(milliseconds) {
      await flush();
      const end = now + milliseconds;
      while (true) {
        const next = [...scheduled.entries()].filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.at;
        scheduled.delete(id);
        timer.callback();
        await flush();
        render();
      }
      now = end;
      return this.settle();
    },
    blur() { focused = false; cleanup?.(); cleanup = undefined; activeEffect = undefined; },
    focus() { focused = true; render(); },
    setUser(id, role = mode === 'driver' ? 'TaxiDriver' : 'Admin') { user = id === null ? null : { id, role }; return render(); },
    setOptions(next, nextLoader = loader) { options = { ...options, ...next }; loader = nextLoader; return render(); },
    setAppState(state) { AppState.currentState = state; listeners.forEach((listener) => listener(state)); },
  };
}

module.exports = { createFeed, loadTypeScript, deferred, spy, flush };
