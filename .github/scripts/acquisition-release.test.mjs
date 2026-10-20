import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acquisitionConfig, deploymentCommands, deploy } from './acquisition-release.mjs';

test('unset and empty settings keep both collectors off and clear the banner token', () => {
  assert.deepEqual(acquisitionConfig({}), { web: 'false', api: '0', provider: '' });
  assert.deepEqual(
    acquisitionConfig({ VITE_ACQUISITION_ENABLED: '', ACQUISITION_ENABLED: '' }),
    acquisitionConfig({}),
  );
  assert.ok(deploymentCommands('api', 'production', {})[0].includes('ACQUISITION_ENABLED:0'));
  assert.ok(deploymentCommands('web', 'staging', {})[1].includes('APPLE_PROVIDER_TOKEN:'));
});

test('explicit settings reach the intended worker only, without shell interpolation', () => {
  const env = {
    VITE_ACQUISITION_ENABLED: 'true',
    ACQUISITION_ENABLED: '1',
    VITE_APPLE_PROVIDER_TOKEN: '123456',
    APPLE_PROVIDER_TOKEN: '123456',
  };
  const calls = [];
  deploy('web', 'production', env, (command, args) => calls.push([command, args]));
  assert.equal(calls.length, 2);
  assert.ok(calls[0][1].includes('wrangler.og.jsonc'));
  assert.equal(calls[0][1].includes('--var'), false);
  assert.deepEqual(calls[1][1].slice(-4), [
    '--env',
    'production',
    '--var',
    'APPLE_PROVIDER_TOKEN:123456',
  ]);
  assert.ok(deploymentCommands('api', 'staging', env)[0].includes('ACQUISITION_ENABLED:1'));
});

test('invalid flags, mismatched providers and unsupported deploy targets stop before writes', () => {
  for (const env of [
    { VITE_ACQUISITION_ENABLED: '1' },
    { ACQUISITION_ENABLED: 'true' },
    { VITE_APPLE_PROVIDER_TOKEN: '123456' },
    { VITE_APPLE_PROVIDER_TOKEN: '123456', APPLE_PROVIDER_TOKEN: '654321' },
    { VITE_APPLE_PROVIDER_TOKEN: '$(bad)', APPLE_PROVIDER_TOKEN: '$(bad)' },
  ]) {
    let writes = 0;
    assert.throws(() => deploy('web', 'production', env, () => writes++));
    assert.equal(writes, 0);
  }
  assert.throws(() => deploymentCommands('api', 'preview', {}));
  assert.throws(() => deploymentCommands('other', 'production', {}));
});
