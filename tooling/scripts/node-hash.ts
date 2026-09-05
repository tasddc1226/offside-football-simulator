import { createHash } from 'node:crypto';
import { canonicalize, utf8Encode, type JsonValue } from '../../packages/domain/src/canonical.ts';
import type { CareerState } from '../../packages/domain/src/types.ts';

/** Drop-in SHA-256 implementation for the offline Node accelerator. Canonicalization and UTF-8 bytes are unchanged. */
export function sha256Hex(input: string): string {
  // Native UTF-8 is byte-equivalent for well-formed strings. Preserve the domain's
  // explicit encoding of unpaired surrogates instead of Node's replacement character.
  return createHash('sha256')
    .update(input.isWellFormed() ? input : utf8Encode(input))
    .digest('hex');
}

export function hashState(state: CareerState): string {
  return sha256Hex(canonicalize(state as unknown as JsonValue));
}
