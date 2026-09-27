<script lang="ts" module>
  import type { PublicHofEntry } from '@offside/contracts';
  export type RowStats = Pick<PublicHofEntry, 'apps' | 'goals' | 'assists' | 'trophies' | 'awards' | 'caps' | 'peak' | 'ballon'> & {
    score: number;
  };
</script>

<script lang="ts">
  // 명예의 전당 · 구단주 '내 선수'가 함께 쓰는 은퇴 선수 한 줄(순위 · 이름 · 기록 요약 · 오른쪽 값).
  // 누르는 버튼(.hof-row)은 부르는 쪽이 감싼다.
  import TitleTag from './titles/TitleTag.svelte';
  import { titleById } from '../game/titles.js';
  import { POS } from '../game/data.js';
  import Laurel from './Laurel.svelte';

  const MEDAL = ['gold', 'silver', 'bronze'];
  const {
    rank,
    name,
    pos,
    tag = null,
    t,
    titleId,
    value = t.score,
    unit = '',
    showScore = false,
  }: {
    /** 0부터. 0~2는 금·은·동 월계관. */
    rank: number;
    name: string;
    pos: keyof typeof POS;
    tag?: string | null;
    t: RowStats;
    titleId: string | null | undefined;
    /** 오른쪽에 크게 보일 값. 기본은 레전드 점수. */
    value?: number;
    unit?: string;
    /** 오른쪽 값이 레전드 점수가 아니면 요약 줄에 레전드 점수를 덧붙인다. */
    showScore?: boolean;
  } = $props();
  const tt = $derived(titleById(titleId));
</script>

{#if rank < MEDAL.length}
  <div class="hof-rank medal {MEDAL[rank]}"><Laurel /><span>{rank + 1}</span></div>
{:else}
  <div class="hof-rank">{rank + 1}</div>
{/if}
<div>
  <b>{name}</b> <span class="pill">{POS[pos].label}</span>
  {#if tag}<span class="pill">{tag}</span>{/if}
  {#if tt}<TitleTag name={tt.name} rarity={tt.rarity} />{/if}
  <div class="muted fs-xs">{t.apps}경기 {t.goals}골 {t.assists}도움 · 트로피 {t.trophies} · 최고 OVR {t.peak}{t.ballon ? ` · 발롱도르 ${t.ballon}회` : ''}{showScore ? ` · 레전드 ${t.score}` : ''}</div>
</div>
<div class="num hof-value">{value}{#if unit}<small>{unit}</small>{/if}</div>
