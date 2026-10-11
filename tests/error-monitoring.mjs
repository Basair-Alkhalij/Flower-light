import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../analytics.js', import.meta.url), 'utf8');
const events = [];
const storageValues = new Map();
const storage = {
  getItem: key => storageValues.get(key) ?? null,
  setItem: (key, value) => storageValues.set(key, value),
};

function run({ measurementId = 'G-TEST123', sessionStorage = storage } = {}) {
  const listeners = new Map();
  const calls = [];
  const window = {
    FLOWER_LIGHT_ANALYTICS_CONFIG: { measurementId, debug: false },
    sessionStorage,
    addEventListener(type, callback) { listeners.set(type, callback); },
    gtag(...args) { calls.push(args); },
  };
  const document = {
    createElement() { return {}; },
    head: { appendChild() {} },
  };
  vm.runInNewContext(source, { window, document, console });
  return { window, listeners, calls, tracked: () => calls.filter(args => args[0] === 'event' && args[1] === 'js_error') };
}

let app = run();
assert.equal(typeof app.window.flTrack, 'function');
assert.equal(typeof app.listeners.get('error'), 'function');
assert.equal(typeof app.listeners.get('unhandledrejection'), 'function');

app.listeners.get('error')({
  type: 'error',
  message: 'Uncaught TypeError: Cannot read properties of undefined (reading private.person@example.com, 0555555555)',
  filename: 'https://example.com/assets/app.js?token=private',
  lineno: 42,
});
assert.equal(app.tracked().length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(app.tracked()[0][2])), {
  message: 'TypeError: Cannot read properties',
  source: 'app.js',
  line: 42,
  transport_type: 'beacon',
});
assert.doesNotMatch(JSON.stringify(app.tracked()), /person@example|0555555555|private|token=/);

app.listeners.get('unhandledrejection')({
  reason: { message: 'ReferenceError: customer@example.com is not defined' },
});
assert.equal(app.tracked().length, 2);
assert.equal(app.tracked()[1][2].message, 'ReferenceError: is not defined');
assert.equal(app.tracked()[1][2].source, 'unknown');
assert.equal(app.tracked()[1][2].line, 0);

// Ignore browser-extension and non-script asset errors.
app.listeners.get('error')({ type: 'error', message: 'TypeError: extension failed', filename: 'chrome-extension://abc/file.js' });
app.listeners.get('unhandledrejection')({ reason: { message: 'Failed to fetch', stack: 'moz-extension://abc/script.js' } });
app.listeners.get('error')({ type: 'error', target: { tagName: 'IMG' } });
assert.equal(app.tracked().length, 2);

// Never exceed five events per session even after a reload.
for (let i = 0; i < 12; i++) {
  app.listeners.get('error')({ type: 'error', message: 'Unexpected error', filename: '/assets/catalog-search.js', lineno: 7 });
}
assert.equal(app.tracked().length, 5);
assert.equal(storageValues.get('flowerlight:js-error-count:v1'), '5');
app = run();
app.listeners.get('error')({ type: 'error', message: 'TypeError: Failed to fetch', filename: 'app.js' });
assert.equal(app.tracked().length, 0);

// Private browsing / denied sessionStorage must not break the page.
const blockedStorage = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
app = run({ sessionStorage: blockedStorage });
for (let i = 0; i < 10; i++) {
  assert.doesNotThrow(() => app.listeners.get('error')({ type: 'error', message: 'SyntaxError: Unexpected token', filename: 'app.js' }));
}
assert.equal(app.tracked().length, 5);

// Empty or invalid GA4 ID: tracking still exists and never throws.
app = run({ measurementId: '' });
assert.doesNotThrow(() => app.window.flTrack('js_error', { message: 'TypeError', source: 'app.js', line: 1 }));
assert.doesNotThrow(() => app.listeners.get('error')({ type: 'error', message: 'TypeError', filename: 'app.js' }));
assert.equal(app.tracked().length, 0);

console.log('JS_ERROR_MONITORING_OK');
