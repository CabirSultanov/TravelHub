const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTypeScript } = require('./test-support.cjs');

const { resolveApiBaseUrl } = loadTypeScript('../src/config/apiConfig.ts', {
  'expo-constants': { default: {} },
  'expo-device': { isDevice: false },
  'react-native': { Platform: { OS: 'android' } },
});

test('explicit API URL still wins and normalizes trailing slashes', () => {
  assert.equal(resolveApiBaseUrl({ explicitUrl: ' https://api.example.com/// ', expoHostUri: 'localhost:8081', isAndroidEmulator: true }), 'https://api.example.com');
});

test('LAN hosts keep backend port 5207 for phones and emulators', () => {
  for (const host of ['192.168.1.5', '10.0.0.4', 'my-pc.local']) {
    for (const isAndroidEmulator of [false, true]) {
      assert.equal(resolveApiBaseUrl({ expoHostUri: `${host}:8081`, isAndroidEmulator }), `http://${host}:5207`);
      assert.equal(resolveApiBaseUrl({ expoHostUri: `exp://${host}:8081/`, isAndroidEmulator }), `http://${host}:5207`);
    }
  }
});

test('only Android Emulator maps Metro loopback to the computer alias', () => {
  for (const expoHostUri of ['localhost:8081', '127.0.0.1:8081', 'http://localhost:8081/', '[::1]:8081']) {
    assert.equal(resolveApiBaseUrl({ expoHostUri, isAndroidEmulator: true }), 'http://10.0.2.2:5207');
    assert.throws(() => resolveApiBaseUrl({ expoHostUri }), /LAN address/);
  }
});

test('missing or unusable hosts still produce a configuration error', () => {
  for (const expoHostUri of [undefined, '', ' ', 'http://', '0.0.0.0:8081']) {
    for (const isAndroidEmulator of [false, true]) {
      assert.throws(() => resolveApiBaseUrl({ expoHostUri, isAndroidEmulator }), /LAN address/);
    }
  }
});
