// T-11-005 자리 — 기록실 묶음(C)이 채운다(웹 HofRow.svelte). 모양(props)은 바꾸지 않는다.
import type { PublicHofEntry } from '@offside/contracts';
import type { DetailPos, POS } from '@offside/game/data';
import { Txt } from '../ui/Txt';

export type RowStats = Pick<
  PublicHofEntry,
  'apps' | 'goals' | 'assists' | 'trophies' | 'awards' | 'caps' | 'peak' | 'ballon' | 'value'
> & {
  score: number;
};

export interface HofRowProps {
  /** 0부터. 0~2는 금·은·동 월계관. */
  rank: number;
  name: string;
  pos: keyof typeof POS;
  dpos?: DetailPos | null | undefined;
  tag?: string | null | undefined;
  t: RowStats;
  titleId: string | null | undefined;
  /** 오른쪽에 크게 보일 값. 기본은 레전드 점수. */
  value?: number | string;
  unit?: string;
  showScore?: boolean;
  club?: string | null | undefined;
  clubId?: string | null | undefined;
  rn?: number | null | undefined;
  nation?: string | null | undefined;
  flow?: boolean;
}

export function HofRow(p: HofRowProps) {
  return <Txt>{`${p.rank + 1}. ${p.name}`}</Txt>;
}
