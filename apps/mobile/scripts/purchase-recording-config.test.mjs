import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import configure from '../app.config.js';
const base = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
test('JS purchase-recording gate never changes the native config or fingerprint input', () => {
  const key = 'EXPO_PUBLIC_ACCOUNT_PURCHASES_ENABLED';
  const previous = process.env[key];
  try {
    delete process.env[key];
    const off = configure({ config: structuredClone(base) });
    assert.equal(Object.hasOwn(off.extra, 'accountPurchaseRecording'), false);
    process.env[key] = 'true';
    assert.deepEqual(
      JSON.parse(JSON.stringify(configure({ config: structuredClone(base) }))),
      JSON.parse(JSON.stringify(off)),
    );
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});
