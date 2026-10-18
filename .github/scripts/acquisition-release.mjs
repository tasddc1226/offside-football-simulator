import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Public deployment settings only. Empty flags fail closed; provider ownership is reviewed separately. */
export function acquisitionConfig(env = process.env) {
  const web = env.VITE_ACQUISITION_ENABLED || 'false';
  const api = env.ACQUISITION_ENABLED || '0';
  const webProvider = env.VITE_APPLE_PROVIDER_TOKEN || '';
  const workerProvider = env.APPLE_PROVIDER_TOKEN || '';
  if (!['true', 'false'].includes(web) || !['0', '1'].includes(api))
    throw new Error('Acquisition flags must be true|false for web and 1|0 for API.');
  if (webProvider !== workerProvider || (webProvider && !/^\d+$/.test(webProvider)))
    throw new Error(
      'Web and worker Apple provider tokens must be the same numeric value or both empty.',
    );
  return { web, api, provider: workerProvider };
}

export function deploymentCommands(target, environment, env = process.env) {
  if (!['api', 'web'].includes(target) || !['staging', 'production'].includes(environment))
    throw new Error('Expected api|web and staging|production.');
  const config = acquisitionConfig(env);
  if (target === 'api')
    return [
      [
        '--filter',
        '@offside/api',
        'exec',
        'wrangler',
        'deploy',
        '--env',
        environment,
        '--var',
        `ACQUISITION_ENABLED:${config.api}`,
      ],
    ];
  return [
    [
      '--filter',
      '@offside/web',
      'exec',
      'wrangler',
      'deploy',
      '-c',
      'wrangler.og.jsonc',
      '--env',
      environment,
    ],
    [
      '--filter',
      '@offside/web',
      'exec',
      'wrangler',
      'deploy',
      '--env',
      environment,
      '--var',
      `APPLE_PROVIDER_TOKEN:${config.provider}`,
    ],
  ];
}

export function deploy(target, environment, env = process.env, exec = execFileSync) {
  for (const args of deploymentCommands(target, environment, env))
    exec('pnpm', args, { env, stdio: 'inherit' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, environment] = process.argv.slice(2);
  if (action === 'validate') {
    acquisitionConfig();
    console.log('Acquisition deployment configuration validated.');
  } else if (action === 'deploy-api' || action === 'deploy-web') {
    deploy(action.slice('deploy-'.length), environment);
  } else
    throw new Error(
      'Usage: acquisition-release.mjs validate|deploy-api|deploy-web [staging|production]',
    );
}
