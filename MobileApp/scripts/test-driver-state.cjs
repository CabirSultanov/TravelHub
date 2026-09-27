const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Exercise the pure TypeScript helper with Node's existing test runner, without a mobile test stack.
const filename = path.resolve(__dirname, '../src/utils/driverRides.ts');
const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const loaded = { exports: {} };
new Function('module', 'exports', 'require', outputText)(loaded, loaded.exports, require);
const { formatRideDate, formatRidePrice, getDriverAction, getDriverStatusLabel, getDriverErrorMessage } = loaded.exports;

test('SQL UTC timestamps display at the same local time as explicit UTC and offset values', () => {
  assert.equal(formatRideDate('2026-09-08T12:30:00'), formatRideDate('2026-09-08T12:30:00Z'));
  assert.equal(formatRideDate('2026-09-08T16:30:00+04:00'), formatRideDate('2026-09-08T12:30:00Z'));
  assert.equal(formatRideDate(null), 'Date unavailable');
  assert.equal(formatRideDate('invalid'), 'Date unavailable');
});

test('the driver must arrive before completing a ride', () => {
  assert.equal(getDriverAction('DriverAssigned'), 'arrived');
  assert.equal(getDriverAction('DriverArrived'), 'complete');
});

test('waiting, completed, cancelled and unknown states cannot trigger an active-ride action', () => {
  for (const status of ['AwaitingDriver', 'Completed', 'Cancelled', 'PendingPayment', 'Paid', 'Unknown']) {
    assert.equal(getDriverAction(status), null, status);
  }
});

test('prices keep the server amount and use AZN with two decimal places', () => {
  assert.match(formatRidePrice(333.62), /333\.62/);
  assert.match(formatRidePrice(333.62), /AZN/);
  assert.match(formatRidePrice(12), /12\.00/);
  assert.match(formatRidePrice(0), /0\.00/);
});

test('all supported ride states have readable labels instead of internal enum names', () => {
  const labels = {
    AwaitingDriver: 'New request',
    DriverAssigned: 'Head to pickup',
    DriverArrived: 'At pickup',
    Completed: 'Ride completed',
  };
  for (const [status, label] of Object.entries(labels)) {
    assert.equal(getDriverStatusLabel(status), label);
  }
});

test('expired sessions and missing driver assignments have actionable explanations', () => {
  assert.match(getDriverErrorMessage({ status: 401 }), /sign in again/i);
  assert.match(getDriverErrorMessage({ status: 403 }), /assignment/i);
  assert.match(getDriverErrorMessage({ status: 403 }), /owner/i);
});

test('conflicts explain that the latest rides are being checked', () => {
  assert.match(getDriverErrorMessage({ status: 409 }), /latest rides/i);
});

test('network and server errors do not expose raw implementation details', () => {
  const detail = 'Private implementation detail';
  for (const status of [0, 500, 503]) {
    const message = getDriverErrorMessage({ status, message: detail });
    assert.match(message, /connection lost/i);
    assert.ok(!message.includes(detail));
  }
  assert.match(getDriverErrorMessage(null), /connection lost/i);
  assert.match(getDriverErrorMessage(undefined), /connection lost/i);
});

test('dispatch errors always have a useful message', () => {
  for (const status of [0, 401, 403, 404, 409, 500]) {
    const message = getDriverErrorMessage({ status });
    assert.equal(typeof message, 'string');
    assert.ok(message.length > 0, `HTTP ${status}`);
    assert.ok(!message.includes('undefined'));
  }
});
