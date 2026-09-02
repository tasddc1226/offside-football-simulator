import { createHash } from 'node:crypto';
import { canonicalStringify } from './canonical-json.ts';

/**
 * manifest.files에 나열된 순서로 각 파일을 canonical JSON으로 직렬화해 이어 붙인 뒤 SHA-256(hex)을 낸다.
 */
export function computePackChecksum(files: readonly string[], contentsByFile: ReadonlyMap<string, unknown>): string {
  const hash = createHash('sha256');
  for (const file of files) {
    const content = contentsByFile.get(file);
    hash.update(canonicalStringify(content));
  }
  return hash.digest('hex');
}
