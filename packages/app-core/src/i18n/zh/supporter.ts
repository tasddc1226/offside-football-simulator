import type { Translation } from '../core';
import type { SupporterMsgs } from '../ko/supporter';

export const supporter: Translation<SupporterMsgs> = {
  pill: (p) => (p.tier > 1 ? `支持者 ${p.tier} 個月` : '支持者'),
  label: (p) => (p.tier > 1 ? `俱樂部會員 連續 ${p.tier} 個月支持者` : '俱樂部會員 支持者'),
};
