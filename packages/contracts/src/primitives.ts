import { z } from 'zod';

/** ISO 8601 UTC, `Z` 접미만 허용한다. `Date` 객체는 계약에 쓰지 않는다. */
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

export const IsoUtcSchema = z
  .string()
  .regex(ISO_UTC_PATTERN, '날짜는 ISO 8601 UTC 형식으로 입력해 주세요. 끝에 Z가 있어야 해요.');
