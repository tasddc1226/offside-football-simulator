import { createHash } from 'node:crypto';
import { canonicalize, utf8Encode, type JsonValue } from '../../packages/domain/src/canonical.ts';
import type { CareerState } from '../../packages/domain/src/types.ts';

/** Drop-in SHA-256 implementation for the offline Node accelerator. Canonicalization and UTF-8 bytes are unchanged. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(utf8Encode(input)).digest('hex');
}

export function hashState(state: CareerState): string {
  return sha256Hex(canonicalize(state as unknown as JsonValue));
}
