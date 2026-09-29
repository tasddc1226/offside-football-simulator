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
  import { posLabel, type DetailPos, type POS } from '../game/data.js';
  import Laurel from './Laurel.svelte';
  import ClubMark from './ClubMark.svelte';
  import { DEFAULT_NATION, NATION_BY_CODE, flagOf } from '@offside/contracts/nations';

  const MEDAL = ['gold', 'silver', 'bronze'];
  const {
    rank,
    name,
    pos,
    dpos = null,
    tag = null,
    t,
    titleId,
    value = t.score,
    unit = '',
    showScore = false,
    club = null,
    clubId = null,
    rn = null,
    nation = null,
  }: {
    /** 0부터. 0~2는 금·은·동 월계관. */
    rank: number;
    name: string;
    pos: keyof typeof POS;
    /** T-10-091 세부 포지션(시즌 1부터 만든 선수). */
    dpos?: DetailPos | null | undefined;
    tag?: string | null;
    t: RowStats;
    titleId: string | null | undefined;
    /** 오른쪽에 크게 보일 값. 기본은 레전드 점수. */
    value?: number;
    unit?: string;
    /** 오른쪽 값이 레전드 점수가 아니면 요약 줄에 레전드 점수를 덧붙인다. */
    showScore?: boolean;
    /** 마지막 소속(T-10-064) — 이름 앞에 엠블럼을 붙인다. */
    club?: string | null;
    /** T-10-066 마지막 소속 클럽 id. 옛 기록엔 없어 이름으로 찾는다. */
    clubId?: string | null | undefined;
    /** T-10-076 영구결번 등번호. */
    rn?: number | null | undefined;
    /** T-10-096 국적 코드 — 대한민국이 아니면 이름 앞에 국기를 붙인다. */
    nation?: string | null | undefined;
  } = $props();
  const foreign = $derived(nation && nation !== DEFAULT_NATION ? NATION_BY_CODE.get(nation) : undefined);
  const tt = $derived(titleById(titleId));
</script>

{#if rank < MEDAL.length}
  <div class="hof-rank medal {MEDAL[rank]}"><Laurel /><span>{rank + 1}</span></div>
{:else}
  <div class="hof-rank">{rank + 1}</div>
{/if}
<div>
  <ClubMark name={club} id={clubId} size={18} /> {#if foreign}<span class="hof-flag" role="img" aria-label={foreign.ko} title={foreign.ko} data-hof-nation={foreign.code}>{flagOf(foreign.code)}</span> {/if}<b>{name}</b> <span class="pill">{posLabel({ pos, dpos })}</span>
  {#if rn != null}<span class="pill pill-rn" data-rn-chip title="영구결번 {rn}번">👑 영결 {rn}</span>{/if}
  {#if tag}<span class="pill">{tag}</span>{/if}
  {#if tt}<TitleTag name={tt.name} rarity={tt.rarity} />{/if}
  <div class="muted fs-xs">{t.apps}경기 {t.goals}골 {t.assists}도움 · 트로피 {t.trophies} · 최고 OVR {t.peak}{t.ballon ? ` · 발롱도르 ${t.ballon}회` : ''}{showScore ? ` · 레전드 ${t.score}` : ''}</div>
</div>
<div class="num hof-value">{value}{#if unit}<small>{unit}</small>{/if}</div>
