// T-11-562 시즌 고르기 목록(웹 SeasonSelect와 같은 규칙). 최신 시즌이 위, 프리시즌은 맨 아래. 닫힌 칸에는 '시즌 2 · 진행 중',
// 고르기 창에는 이름 아래에 기간 · 상태를 작게 쓴다.
import { seasonChoices } from '@offside/app-core/seasonPick';
import type { SelectOption } from '../screens/settings/parts';

export const seasonOptions = (
  seasons: readonly (number | { id: number; name?: string })[],
  now: string = new Date().toISOString(),
): SelectOption<number>[] =>
  seasonChoices(seasons, now).map((c) => ({
    value: c.id,
    label: c.name,
    face: c.face,
    detail: c.detail,
  }));
