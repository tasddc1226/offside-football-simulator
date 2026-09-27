<script lang="ts">
  // T-10-076 은퇴 리포트의 영구결번 장면 — 결번 심사(구단 기여 점수 vs 기준, 내 선수만) + 결번 세리머니 · 명예의 벽
  // 헌정 · 이름 공개 안내. LegendReport가 따로 불러온다(첫 화면 번들 밖).
  import type { RetiredNumberResult } from '@offside/contracts';
  import { RN_CUT, RN_MIN_SEASONS, rnQualifies } from '@offside/contracts/retired-numbers';
  import { clubsOf, nearRetiredNumber } from '../game/retired-number.js';
  import { clubById } from '../game/clubs.js';
  import { crestOf } from '../game/crests.js';
  import { setLegendPublic } from './legend.js';
  import type { LegendView } from './state.svelte.js';
  import ClubMark from './ClubMark.svelte';

  const {
    v,
    rn: rn0,
    reveal,
  }: {
    v: LegendView;
    /** 심사 결과(null = 자격 없음, undefined = 아직 모름). */
    rn: RetiredNumberResult | null | undefined;
    /** 스크롤 크레딧(LegendReport). */
    reveal: (el: HTMLElement) => { destroy: () => void } | undefined;
  } = $props();
  const d = $derived(v.d);
  const mine = $derived(!!(v.own || v.pot || v.shareId));
  const rnClubs = $derived(d ? clubsOf(d) : []);
  const rnJudge = $derived(mine && nearRetiredNumber(rnClubs[0]) ? rnClubs[0]! : null);
  /** 방금 은퇴해 자격이 있는데 서버 응답을 아직 못 받았으면 심사 중. */
  const rn = $derived(
    rn0 ?? (v.pot && rn0 === undefined && rnClubs.some(rnQualifies) ? ({ kind: 'pending' } as const) : null),
  );
  const rnSlot = $derived(rn && rn.kind !== 'pending' && (rn.kind !== 'anonymous' || v.own) ? rn : null);
  const rnClub = $derived(rnSlot ? rnClubs.find((c) => c.clubId === rnSlot.clubId) : undefined);
  const rnColors = $derived.by(() => {
    const club = rnSlot ? clubById(rnSlot.clubId) : null;
    if (!club) return '';
    const c = crestOf(club);
    return `--rn-base:${c.base};--rn-accent:${c.accent};--rn-ink:${light(c.base) ? '#111a14' : '#ffffff'}`;
  });
  /** 밝은 유니폼이면 등번호를 어둡게. */
  const light = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170;
  };
  const pts = (n: number) => Math.round(n).toLocaleString('ko-KR');
</script>

{#if rnJudge || rn}
  <section class="film-rn" data-credit="retired-number" data-legend-rn={rn?.kind ?? 'judge'} style={rnColors} use:reveal>
    {#if rnJudge}
      <div class="rn-judge" data-rn-judge>
        <div class="eyebrow film-kicker">결번 심사</div>
        <h2 class="rn-judge-club"><ClubMark name={rnJudge.club} id={rnJudge.clubId} size={20} /> {rnJudge.club}</h2>
        <dl class="rn-judge-rows">
          <div><dt>뛴 시즌</dt><dd>{rnJudge.seasons}시즌 <small>/ {RN_MIN_SEASONS}시즌 이상</small></dd></div>
          <div><dt>경기 기여</dt><dd>{pts(rnJudge.play)}점</dd></div>
          <div><dt>우승 · 수상</dt><dd>{pts(rnJudge.honors)}점</dd></div>
        </dl>
        <div class="rn-bar" role="img" aria-label="구단 기여 {pts(rnJudge.score)}점, 기준 {RN_CUT}점">
          <i style="width:{Math.min(100, Math.round((rnJudge.score / RN_CUT) * 100))}%"></i>
        </div>
        <p class="rn-judge-total"><b>{pts(rnJudge.score)}</b> / {RN_CUT}점</p>
        <p class="rn-judge-verdict">
          {#if rnQualifies(rnJudge)}영구결번 자격을 채웠어요.
          {:else if rnJudge.seasons < RN_MIN_SEASONS}이 구단에서 {RN_MIN_SEASONS - rnJudge.seasons}시즌만 더 뛰었다면 심사 대상이었어요.
          {:else}기준까지 {pts(RN_CUT - rnJudge.score)}점 모자랐어요. 한 구단에 더 오래 남아 우승을 쌓으면 결번이 보여요.{/if}
        </p>
      </div>
    {/if}
    {#if rn?.kind === 'pending'}
      <p class="rn-pending" data-rn-pending>서버가 결번을 심사하고 있어요. 잠시 뒤 명예의 전당에서 확인할 수 있어요.</p>
    {:else if rnSlot?.kind === 'granted'}
      <div class="rn-ceremony">
        <div class="eyebrow film-kicker">Retired Number</div>
        <svg class="rn-jersey" viewBox="0 0 120 124" aria-hidden="true">
          <path class="rn-shirt" d="M40 6 L22 12 L4 34 L18 48 L28 40 L28 118 L92 118 L92 40 L102 48 L116 34 L98 12 L80 6 Q60 20 40 6 Z" />
          <path class="rn-trim" d="M40 6 Q60 20 80 6" />
          <text class="rn-jersey-name" x="60" y="40">{v.name}</text>
          <text class="rn-jersey-num" x="60" y="92">{rnSlot.number}</text>
        </svg>
        <p class="rn-line"><b>{rnSlot.number}번</b>은 이제,<br /><b>{v.name}</b>의 이름으로 남습니다.</p>
        {#if rnClub}
          <p class="rn-stats">{rnClub.from}–{rnClub.to} · {rnClub.seasons}시즌 · {rnClub.apps}경기 {rnClub.goals}골 {rnClub.assists}도움</p>
        {/if}
        <p class="rn-foot"><ClubMark name={rnSlot.club} id={rnSlot.clubId} size={18} /> {rnSlot.club} 영구결번 · 서버 {rnSlot.seq}번째 결번</p>
      </div>
    {:else if rnSlot?.kind === 'taken'}
      <div class="rn-ceremony rn-honour">
        <div class="eyebrow film-kicker">Wall of Honour</div>
        <p class="rn-line">{rnSlot.number}번은 이미 <b>{rnSlot.holder ?? '익명의 레전드'}</b>의 이름으로 남아 있어,<br />구단은 <b>{v.name}</b>의 이름을 명예의 벽에 새겼습니다.</p>
      </div>
    {:else if rnSlot?.kind === 'anonymous'}
      <div class="rn-ceremony rn-anon">
        <div class="eyebrow film-kicker">Retired Number</div>
        <p class="rn-line">이름을 공개하면<br /><b>{rnSlot.club} {rnSlot.number}번</b> 영구결번이 확정됩니다.</p>
        <p class="rn-stats">결번은 이름을 공개한 순서대로 주어져요. 먼저 공개한 선수가 그 번호를 가져갑니다.</p>
        {#if v.own}
          <button class="btn btn-primary" data-act="rn-public" onclick={() => v.own && setLegendPublic(v.own, true)}>이름 공개하고 결번 받기</button>
        {/if}
      </div>
    {/if}
  </section>
{/if}
