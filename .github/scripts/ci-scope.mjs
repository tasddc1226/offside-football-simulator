import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const DOCUMENT_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.gif',
  '.webp',
  '.pdf',
]);

function isAllowedDocument(path) {
  if (path.startsWith('docs/')) {
    const dot = path.lastIndexOf('.');
    return (
      dot >= 0 &&
      (path.slice(dot).toLowerCase() === '.md' ||
        DOCUMENT_IMAGE_EXTENSIONS.has(path.slice(dot).toLowerCase()))
    );
  }
  if (!path.includes('/') && path.toLowerCase().endsWith('.md')) return true;
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  return fileName === 'README.md' || fileName === 'CHANGELOG.md';
}

/** Return true when any changed path may affect code or CI behaviour. */
export function classifyPaths(paths) {
  return Array.from(paths, String).some((path) => !isAllowedDocument(path));
}

function assertCommitSha(value, name) {
  if (!SHA_PATTERN.test(value) || /^0+$/.test(value))
    throw new Error(`${name} must be a non-zero 40-character SHA`);
}

function gitObjectExists(sha, exec) {
  exec('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' });
}

export function readChangedPaths(baseSha, headSha, exec = execFileSync) {
  assertCommitSha(baseSha, 'CI_BASE_SHA');
  assertCommitSha(headSha, 'CI_HEAD_SHA');
  gitObjectExists(baseSha, exec);
  gitObjectExists(headSha, exec);
  const output = exec('git', ['diff', '--no-renames', '--name-only', '-z', baseSha, headSha], {
    encoding: 'utf8',
  });
  return output.split('\0').filter(Boolean);
}

export function main(env = process.env, exec = execFileSync, append = appendFileSync) {
  const outputPath = env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');

  let codeChanged = true;
  let fileCount = 0;
  let description = 'git diff classification failed (fail-closed)';
  try {
    const paths = readChangedPaths(env.CI_BASE_SHA ?? '', env.CI_HEAD_SHA ?? '', exec);
    fileCount = paths.length;
    codeChanged = classifyPaths(paths);
    description = `classified ${fileCount} changed path${fileCount === 1 ? '' : 's'}`;
  } catch {
    // Do not expose git errors or path contents in CI output.
  }

  append(outputPath, `code_changed=${codeChanged}\n`, 'utf8');
  console.log(`${description}; code_changed=${codeChanged}`);
  return codeChanged;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
