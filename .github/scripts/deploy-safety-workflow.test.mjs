// T-11-824 운영 배포 워크플로의 배포 뒤 확인 · 에이전트 Worker · 되돌리기 배선을 고정한다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const wf = readFileSync(new URL('../workflows/deploy-production.yml', import.meta.url), 'utf8');
const job = (name) => {
  const start = wf.indexOf(`\n  ${name}:\n`);
  assert.ok(start > 0, `${name} job missing`);
  const rest = wf.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};

test('mode에 rollback이 있고, 웹 · API 배포 잡은 rollback에서 돌지 않는다', () => {
  assert.match(wf, /options: \[preflight, deploy, rollback\]/);
  assert.match(job('production-release'), /if: inputs\.mode != 'rollback'/);
  assert.match(job('app-update'), /if: inputs\.mode == 'deploy' \|\| inputs\.mode == 'preflight'/);
});

test('되돌리기는 main · ROLLBACK_PRODUCTION을 요구하고 세 Worker를 rollback-target으로 고른 버전으로 돌린 뒤 확인한다', () => {
  const r = job('rollback');
  assert.match(r, /if: inputs\.mode == 'rollback'/);
  assert.match(r, /"\$CONFIRMATION" = "ROLLBACK_PRODUCTION"/);
  assert.match(r, /refs\/heads\/main/);
  assert.match(r, /for worker in offside-api offside-web offside-og/);
  assert.match(r, /rollback-target\.mjs/);
  assert.match(r, /wrangler rollback "\$VERSION"/);
  assert.doesNotMatch(r, /d1|migrat/i);
  assert.ok(r.indexOf('rollback-target') < r.indexOf('Read-back health'));
});

test('배포 뒤 확인은 웹 · API가 성공했을 때 OTA · 에이전트 결과와 함께 돈다', () => {
  const w = job('release-watch');
  assert.match(w, /needs: \[production-release, app-update, agents-release\]/);
  assert.match(w, /needs\.production-release\.result == 'success'/);
  assert.match(w, /!cancelled\(\)/);
  assert.match(w, /DEPLOY_AT: \$\{\{ needs\.production-release\.outputs\.deployed_at \}\}/);
  assert.match(w, /release-watch\.mjs/);
  assert.match(job('production-release'), /deployed_at: \$\{\{ steps\.deployed\.outputs\.at \}\}/);
  const p = job('production-release');
  assert.ok(p.indexOf('id: deployed') > p.indexOf('deploy-api production'));
});

test('에이전트 Worker는 변수를 켰을 때만 배포하고 아니면 경고한다', () => {
  const a = job('agents-release');
  assert.match(a, /agents-drift\.mjs/);
  assert.match(a, /drift == 'true' && vars\.AGENTS_AUTO_DEPLOY == '1'/);
  assert.match(a, /drift == 'true' && vars\.AGENTS_AUTO_DEPLOY != '1'/);
  assert.match(a, /::warning::/);
});

test('OTA 잡은 웹 · API 배포와 나란히 준비하고, 게시 직전에 그 배포의 성공을 기다린다', () => {
  const a = job('app-update');
  assert.doesNotMatch(a, /\n {4}needs:/);
  assert.match(a, /actions: read/);
  const wait = a.indexOf('wait-job.mjs "Deploy production"');
  assert.ok(wait > a.indexOf('id: changed'));
  assert.ok(wait < a.indexOf('eas update --channel production'));
  assert.match(
    a.slice(a.indexOf('Wait for production web/API deploy')),
    /if: inputs\.mode == 'deploy' && steps\.changed\.outputs\.publish == 'true'/,
  );
});
