import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import configure from '../app.config.js';
const base = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
test('optional purchase recording is off unless explicitly enabled in the app config', () => {
  const key = 'OFFSIDE_ACCOUNT_PURCHASES_ENABLED';
  const previous = process.env[key];
  try {
    delete process.env[key];
    assert.equal(
      configure({ config: structuredClone(base) }).extra.accountPurchaseRecording,
      false,
    );
    process.env[key] = 'true';
    assert.equal(configure({ config: structuredClone(base) }).extra.accountPurchaseRecording, true);
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});
