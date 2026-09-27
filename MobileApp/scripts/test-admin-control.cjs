const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTypeScript, createFeed, spy, deferred } = require('./test-support.cjs');
const access = loadTypeScript('../src/utils/mobileAccess.ts');
const control = loadTypeScript('../src/utils/adminControl.ts');
const ride = (id, status, extra = {}) => ({ id, status, taxiServiceId: 1, taxiServiceName: 'Test Fleet', customerName: 'Test Customer', driverName: null, ...extra });

test('every role has one home and control access is restricted to administrators', () => {
  for (const role of ['User', 'HotelOwner', 'TaxiOwner', undefined]) {
    assert.equal(access.getMobileHome(role), '/login');
    assert.equal(access.canAccessControl(role), false);
  }
  assert.equal(access.getMobileHome('TaxiDriver'), '/(driver)/available');
  assert.equal(access.canAccessControl('TaxiDriver'), false);
  for (const role of ['Admin', 'SuperAdmin']) {
    assert.equal(access.getMobileHome(role), '/admin/overview');
    assert.equal(access.canAccessControl(role), true);
  }
});

test('ride counters and filters include only the intended states, newest first', () => {
  const rides = ['AwaitingDriver', 'DriverAssigned', 'DriverArrived', 'Completed', 'Cancelled', 'Paid', 'PendingPayment'].map((status, i) => ride(i + 1, status));
  assert.deepEqual(control.filterRides(rides, 'Waiting').map(r => r.id), [1]);
  assert.deepEqual(control.filterRides(rides, 'Active').map(r => r.id), [3, 2]);
  assert.deepEqual(control.filterRides(rides, 'Completed').map(r => r.id), [4]);
  assert.deepEqual(control.filterRides(rides, 'Cancelled').map(r => r.id), [5]);
  assert.equal(control.filterRides(rides, 'All').length, 7);
  assert.match(control.adminStatus('Paid'), /legacy/);
  assert.match(control.adminStatus('PendingPayment'), /legacy/);
  assert.equal(control.adminStatus('Unexpected'), 'Status unavailable');
  assert.equal(control.isTerminalRide(ride(1, 'Cancelled')), true);
  assert.equal(control.isTerminalRide(null), false);
});

test('completed today uses SQL UTC values and the device local day boundaries', () => {
  const now = new Date(2026, 8, 10, 12, 0, 0);
  const start = new Date(2026, 8, 10, 0, 0, 0);
  const end = new Date(2026, 8, 10, 23, 59, 59);
  for (const date of [start, now, end]) {
    for (const value of [date.toISOString(), date.toISOString().replace(/Z$/, '')]) {
      assert.equal(control.completedToday(ride(1, 'Completed', { completedAt: value }), now), true);
    }
  }
  for (const value of [new Date(start.getTime() - 1).toISOString(), new Date(end.getTime() + 1000).toISOString(), 'invalid', null]) {
    assert.equal(control.completedToday(ride(1, 'Completed', { completedAt: value }), now), false);
  }
  assert.equal(control.completedToday(ride(1, 'DriverArrived', { completedAt: now.toISOString() }), now), false);
});

test('search combines ride id, customer/driver, fleet and local-date filters', () => {
  const now = new Date();
  const rides = [ride(21, 'Completed', { driverName: 'Taylor Test', completedAt: now.toISOString() }), ride(22, 'AwaitingDriver', { taxiServiceId: 2 })];
  assert.equal(control.filterRides(rides, 'All', ' taylor ', 1).length, 1);
  assert.equal(control.filterRides(rides, 'All', '#22')[0].id, 22);
  assert.equal(control.filterRides(rides, 'All', 'customer', 2).length, 1);
  assert.equal(control.filterRides(rides, 'Completed', '', undefined, true, now).length, 1);
});

test('fleet ownership depends on ownerId, not availability of a candidate record', () => {
  const fleets = [{ id: 1, companyName: 'Alpha', city: 'Baku', ownerId: 999 }, { id: 2, companyName: 'Beta', city: 'Ganja', ownerId: null }];
  assert.deepEqual(control.filterFleets(fleets, 'With owner', 'BAKU').map(f => f.id), [1]);
  assert.deepEqual(control.filterFleets(fleets, 'Without owner', '').map(f => f.id), [2]);
});

test('all roles may be displayed, but only User/Admin have block controls', () => {
  for (const role of ['User', 'Admin', 'SuperAdmin', 'TaxiDriver', 'TaxiOwner', 'HotelOwner']) {
    assert.equal(control.canBlockAccount({ role }), role === 'User' || role === 'Admin');
  }
});

test('control feeds refuse driver/owner/user accounts and honor a SuperAdmin-only guard', async () => {
  for (const role of ['TaxiDriver', 'TaxiOwner', 'HotelOwner', 'User']) {
    const loader = spy(async () => []);
    const feed = createFeed(loader, { mode: 'control', delayMs: 300 });
    feed.setUser(1, role);
    await feed.advance(500);
    assert.equal(loader.calls.length, 0);
    assert.equal(feed.view().canAct, false);
    feed.blur();
  }
  const loader = spy(async () => []);
  const feed = createFeed(loader, { mode: 'control', enabled: false });
  await feed.settle();
  assert.equal(loader.calls.length, 0);
  feed.blur();
});

test('new resource/query clears old data and ignores its late answer, even within the same account', async () => {
  const old = deferred();
  const loader = spy(() => old.promise);
  const feed = createFeed(loader, { mode: 'control', resourceKey: 'fleet:1' });
  await feed.settle();
  feed.setOptions({ resourceKey: 'fleet:2' }, async () => [{ id: 2 }]);
  assert.equal(loader.calls[0][1].aborted, true);
  assert.deepEqual(feed.view().data, []);
  await feed.settle();
  old.resolve([{ id: 1 }]);
  assert.deepEqual((await feed.settle()).data, [{ id: 2 }]);
  feed.blur();
});

test('candidate/user search waits 300ms after the last change; old selections cannot trigger reads', async () => {
  const loader = spy(async () => []);
  const feed = createFeed(loader, { mode: 'control', resourceKey: 'a', delayMs: 300 });
  await feed.advance(200);
  feed.setOptions({ resourceKey: 'ab' });
  await feed.advance(200);
  feed.setOptions({ resourceKey: 'abc' });
  await feed.advance(299);
  assert.equal(loader.calls.length, 0);
  await feed.advance(1);
  assert.equal(loader.calls.length, 1);
  feed.blur();
});

test('terminal details stop polling; returning to the screen still refreshes', async () => {
  const loader = spy(async () => [ride(1, 'Completed')]);
  const feed = createFeed(loader, { mode: 'control', stopPolling: data => control.isTerminalRide(data[0]) });
  await feed.settle();
  await feed.advance(30_000);
  assert.equal(loader.calls.length, 1);
  feed.blur(); feed.focus(); await feed.settle();
  assert.equal(loader.calls.length, 2);
  feed.blur();
});

test('saved mutation with failed reload is not reported as an unsaved change or retried', async () => {
  const loader = spy(async () => { if (loader.calls.length === 2) throw { status: 0 }; return [{ id: 1 }]; });
  const action = spy(async () => {});
  const feed = createFeed(loader, { mode: 'control', poll: false });
  await feed.settle();
  assert.equal(await feed.view().perform(action), true);
  await feed.settle();
  assert.match(feed.view().error, /Change saved, but/);
  assert.equal(feed.view().canAct, false);
  feed.view().refresh(); await feed.settle();
  assert.equal(feed.view().error, '');
  assert.equal(action.calls.length, 1);
  feed.blur();
});

test('uncertain mutation reloads the actual result without claiming success or resubmitting', async () => {
  const loader = spy(async () => [{ id: 1, isBlocked: loader.calls.length > 1 }]);
  const action = spy(async () => { throw { status: 0 }; });
  const feed = createFeed(loader, { mode: 'control', poll: false });
  await feed.settle();
  assert.equal(await feed.view().perform(action), false);
  assert.equal((await feed.settle()).data[0].isBlocked, true);
  assert.match(feed.view().error, /may have been saved/);
  assert.equal(action.calls.length, 1);
  feed.blur();
});

test('active ride removal error preserves the team and allows another explicit action after reload', async () => {
  const feed = createFeed(async () => [{ id: 1 }], { mode: 'control', poll: false });
  await feed.settle();
  assert.equal(await feed.view().perform(async () => { throw { status: 400, message: 'A driver with an active ride cannot be removed.' }; }), false);
  assert.deepEqual((await feed.settle()).data, [{ id: 1 }]);
  assert.match(feed.view().error, /active ride/);
  assert.equal(feed.view().canAct, true);
  feed.blur();
});

test('admin 403 clears private data, explains permission denial and stops retries', async () => {
  const loader = spy(async () => { throw { status: 403 }; });
  const feed = createFeed(loader, { mode: 'control' });
  await feed.settle(); await feed.advance(30_000);
  assert.equal(loader.calls.length, 1);
  assert.equal(feed.view().hasLoaded, false);
  assert.match(feed.view().error, /do not have access/);
  assert.ok(!feed.view().error.includes('assignment'));
  feed.blur();
});

test('admin methods use only existing endpoints, encoded searches and the common authorization header', async () => {
  const requests = [];
  const { api } = loadTypeScript('../src/services/api.ts', { '@/config/apiConfig': { getApiBaseUrl: () => 'http://test.invalid' } }, {
    fetch: async (url, init) => { requests.push({ url, init }); return { ok: true, text: async () => '[]' }; },
  });
  await api.getAdminRides('test-token');
  await api.getAdminRide(5, 'test-token');
  await api.getAdminUsers('a&b', 2, 'test-token');
  await api.assignFleetOwner(1, 20, 'test-token');
  await api.assignFleetDriver(1, 21, 'test-token');
  await api.removeFleetDriver(1, 21, 'test-token');
  await api.setUserBlocked(20, true, 'test-token');
  assert.deepEqual(requests.map(r => r.url.replace('http://test.invalid', '')), ['/api/taxi-bookings', '/api/taxi-bookings/5', '/api/admins/users?search=a%26b&page=2&pageSize=20', '/api/taxi-services/1/owner', '/api/taxi-services/1/drivers/21', '/api/taxi-services/1/drivers/21', '/api/admins/20/block']);
  assert.equal(requests[3].init.body, JSON.stringify({ ownerId: 20 }));
  assert.equal(requests[5].init.method, 'DELETE');
  for (const request of requests) assert.equal(request.init.headers.get('Authorization'), 'Bearer test-token');
});
