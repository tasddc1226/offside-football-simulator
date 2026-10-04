<script lang="ts" module>
  import type { PublicHofEntry } from '@offside/contracts';
  export type RowStats = Pick<PublicHofEntry, 'apps' | 'goals' | 'assists' | 'trophies' | 'awards' | 'caps' | 'peak' | 'ballon' | 'value'> & {
    score: number;
  };
</script>

<script lang="ts">
  // 명예의 전당 · 구단주 '내 선수'가 함께 쓰는 은퇴 선수 한 줄(순위 · 이름 · 기록 요약 · 오른쪽 값).
  // 누르는 버튼(.hof-row)은 부르는 쪽이 감싼다.
  import TitleTag from './titles/TitleTag.svelte';
  import { titleById } from '@offside/game/titles';
  import { posLabel, type DetailPos, type POS } from '@offside/game/data';
  import Laurel from './Laurel.svelte';
  import ClubMark from './ClubMark.svelte';
  import { DEFAULT_NATION, NATION_BY_CODE, flagOf } from '@offside/contracts/nations';
  import { motionOK } from './motion.js';

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
    showNation = true,
    flow = false,
    compact = false,
    showPosition = true,
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
    /** 오른쪽에 크게 보일 값. 기본은 레전드 점수. 은퇴 가치(T-10-100)는 '1,115억'처럼 글자로. */
    value?: number | string;
    unit?: string;
    /** 오른쪽 값이 레전드 점수가 아니면 요약 줄에 레전드 점수를 덧붙인다. */
    showScore?: boolean;
    /** 마지막 소속(T-10-064) — 이름 앞에 엠블럼을 붙인다. */
    club?: string | null;
    /** T-10-066 마지막 소속 클럽 id. 옛 기록엔 없어 이름으로 찾는다. */
    clubId?: string | null | undefined;
    /** T-10-076 영구결번 등번호. */
    rn?: number | null | undefined;
    /** 국적 코드 — 없는 예전 커리어는 대한민국으로 표시한다. */
    nation?: string | null | undefined;
    /** 국적을 모르는 옛 로컬 기록에는 국기를 표시하지 않는다. */
    showNation?: boolean;
    /** T-10-125 기록 요약이 칸보다 길면 말줄임 대신 홈 전광판처럼 오른쪽에서 왼쪽으로 흘린다. */
    flow?: boolean;
    compact?: boolean;
    showPosition?: boolean;
  } = $props();
  const country = $derived(showNation ? (NATION_BY_CODE.get(nation || DEFAULT_NATION) ?? NATION_BY_CODE.get(DEFAULT_NATION)!) : undefined);
  const tt = $derived(titleById(titleId));
  // 글자 값('1,115억 3천만')은 큰 단위 아래에 작은 단위를 한 줄 더 — 오른쪽 칸이 좁아 이름 줄이 덜 밀린다.
  const [valueHead, valueSub] = $derived(typeof value === 'string' ? value.split(' ') : []);
  const stats = $derived(
    `${t.apps}경기 ${t.goals}골 ${t.assists}도움 · 트로피 ${t.trophies} · 최고 OVR ${t.peak}${t.ballon ? ` · 발롱도르 ${t.ballon}회` : ''}${showScore ? ` · 레전드 ${t.score}` : ''}`,
  );
  // 흐를 때 두 벌을 이어 붙여 -50%까지 민다(HomeTicker와 같은 방식). 한 벌 = 글 + 뒤 여백(FLOW_GAP).
  const FLOW_SPEED = 28; // px/초
  const FLOW_GAP = 32;
  let boxW = $state(0);
  let copyW = $state(0);
  const flowing = $derived(flow && motionOK && copyW - FLOW_GAP > boxW + 1);
</script>

{#if rank < MEDAL.length}
  <div class="hof-rank medal {MEDAL[rank]}"><Laurel /><span>{rank + 1}</span></div>
{:else}
  <div class="hof-rank">{rank + 1}</div>
{/if}
<!-- 두 줄: 윗줄은 이름·포지션·칭호와 오른쪽 값, 아랫줄 기록 요약은 값 밑까지 넓게 쓰고 넘치면 말줄임(T-10-105). -->
<div class="hof-main" class:hof-main-compact={compact}>
  <span class="hof-identity"><ClubMark name={club} id={clubId} size={18} />{#if country}<span class="hof-flag" role="img" aria-label={country.ko} title={country.ko} data-hof-nation={country.code}>{flagOf(country.code)}</span>{/if}<b>{name}</b></span>
  {#if showPosition || rn != null || tag || tt}
    <span class="hof-badges">{#if showPosition}<span class="pill">{posLabel({ pos, dpos })}</span>{/if}
      {#if rn != null}<span class="pill pill-rn" data-rn-chip title="영구결번 {rn}번">👑 영결 {rn}</span>{/if}
      {#if tag}<span class="pill">{tag}</span>{/if}
      {#if tt}<TitleTag name={tt.name} rarity={tt.rarity} />{/if}
    </span>
  {/if}
</div>
<div class="num hof-value" class:hof-value-text={typeof value === 'string'}>{#if valueSub}{valueHead} <small class="hof-value-sub">{valueSub}</small>{:else}{compact && typeof value === 'number' ? value.toLocaleString('ko-KR') : value}{/if}{#if unit}<small>{unit}</small>{/if}</div>
{#if flow}
  <div class="muted fs-xs hof-stats" class:flowing bind:clientWidth={boxW}>
    <div class="hof-flow" style:animation-duration={flowing ? `${copyW / FLOW_SPEED}s` : null}>
      <span bind:clientWidth={copyW} style:padding-right="{FLOW_GAP}px">{stats}</span>{#if flowing}<span aria-hidden="true" style:padding-right="{FLOW_GAP}px">{stats}</span>{/if}
    </div>
  </div>
{:else if compact}
  <div class="muted hof-stats hof-stats-compact">
    <span>{t.apps.toLocaleString('ko-KR')}경기</span><span>{t.goals.toLocaleString('ko-KR')}골</span><span>{t.assists.toLocaleString('ko-KR')}도움</span>
  </div>
{:else}
  <div class="muted fs-xs hof-stats">{stats}</div>
{/if}
