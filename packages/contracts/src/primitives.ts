import { z } from 'zod';

/** ISO 8601 UTC, `Z` 접미만 허용한다. `Date` 객체는 계약에 쓰지 않는다. */
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

export const IsoUtcSchema = z
  .string()
  .regex(ISO_UTC_PATTERN, 'ISO 8601 UTC(Z 접미) 문자열이어야 한다.');

/** SHA-256 hex. `stateHash`·`resultHash`에 쓴다. */
export const Hex64Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, '64자리 소문자 hex(SHA-256)여야 한다.');

export const Uint32Schema = z.number().int().min(0).max(0xffffffff);

/**
 * 클라이언트가 발급하는 ID(commandId, careerId 등). 07 예시의 접두사 문자열(`cmd_...`)과 UUID를
 * 모두 허용한다. 공백은 허용하지 않는다.
 */
export const ClientIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_:.-]{1,64}$/, '영숫자·_·:·.·-로 이루어진 1~64자 ID여야 한다.');
