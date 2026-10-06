<script lang="ts">
  // T-10-076 은퇴 리포트의 영구결번 장면 — 결번 세리머니 · 명예의 벽 헌정 · 이름 공개 안내. 판정 기준(점수·시즌 수)은
  // 서버만 안다 — 웹은 서버가 준 결과만 그린다. LegendReport가 따로 불러온다(첫 화면 번들 밖).
  import type { RetiredNumberResult } from '@offside/contracts';
  import { rnStyle } from '@offside/app-core/rnStyle';
  import { setLegendPublic } from './legend.js';
  import { checkRetiredNumber } from '@offside/app-core/api/client';
  import { recordRn } from './retiredNumber.svelte.js';
  import { isHofEligible } from '@offside/contracts/hof-rules';
  import { rnClubStats, rnSlotOf } from '@offside/app-core/legendReport';
  import type { LegendView } from './state.svelte.js';
  import ClubMark from './ClubMark.svelte';
  import RnJersey from './RnJersey.svelte';
  import { legendRnText as L } from '@offside/app-core/i18n/ko/legendRn';

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
  // 결과를 모르는 내 선수 기록(배포 전 은퇴의 소급 결번·이미 찬 자리, 심사 중이던 기록)은 열 때 서버에 한 번 묻는다
  // (결과는 이 기기 기록에 남아 다시 묻지 않는다). 방금 은퇴한 화면은 은퇴 업로드 응답이 곧 온다.
  /** 한 선수에 한 번만 묻는다(결과를 남기면 rn0가 바뀌어 효과가 다시 돈다). */
  let asked = '';
  $effect(() => {
    const id = v.own?.id ?? v.shareId;
    // 공개 명예의 전당에 오르는 은퇴(만 30세 이상)만 심사 대상이다.
    if (!id || id === asked || v.pot || !isHofEligible(v.age)) return;
    if (rn0 !== undefined && rn0?.kind !== 'pending') return;
    asked = id;
    void checkRetiredNumber(id).then((r) => {
      if (r.ok) recordRn(id, r.data.retiredNumber);
    });
  });
  const rn = $derived(rn0 ?? null);
  const rnSlot = $derived(rnSlotOf(rn, v.own));
  const rnClub = $derived(rnSlot?.kind === 'granted' ? rnClubStats(rnSlot, v.d) : null);
  const rnColors = $derived(rnStyle(rnSlot?.clubId));
</script>

{#if rn?.kind === 'pending' || rnSlot}
  <section class="film-rn" data-credit="retired-number" data-legend-rn={rn?.kind} style={rnColors} use:reveal>
    {#if rn?.kind === 'pending'}
      <p class="rn-pending" data-rn-pending>{L.pending}</p>
    {:else if rnSlot?.kind === 'granted'}
      <div class="rn-ceremony">
        <div class="eyebrow film-kicker">Retired Number</div>
        <RnJersey name={v.name} number={rnSlot.number} />
        <p class="rn-line"><b>{L.lineNum({ number: rnSlot.number })}</b>{L.lineNumAfter}<br /><b>{v.name}</b>{L.lineNameAfter}</p>
        {#if rnClub}
          <p class="rn-stats">{L.stats(rnClub)}</p>
        {/if}
        <p class="rn-foot"><ClubMark name={rnSlot.club} id={rnSlot.clubId} size={18} /> {L.foot({ club: rnSlot.club, seq: rnSlot.seq })}</p>
      </div>
    {:else if rnSlot?.kind === 'taken'}
      <div class="rn-ceremony rn-honour">
        <div class="eyebrow film-kicker">Wall of Honour</div>
        <p class="rn-line">{L.takenA({ number: rnSlot.number })} <b>{rnSlot.holder ?? L.anonLegend}</b>{L.takenB}<br />{L.takenC} <b>{v.name}</b>{L.takenD}</p>
      </div>
    {:else if rnSlot?.kind === 'anonymous'}
      <div class="rn-ceremony rn-anon">
        <div class="eyebrow film-kicker">Retired Number</div>
        <p class="rn-line">{L.anonA}<br /><b>{L.anonSlot({ club: rnSlot.club, number: rnSlot.number })}</b> {L.anonTail}</p>
        <p class="rn-stats">{L.anonNote}</p>
        {#if v.own}
          <button class="btn btn-primary" data-act="rn-public" onclick={() => v.own && setLegendPublic(v.own, true)}>{L.publish}</button>
        {/if}
      </div>
    {/if}
  </section>
{/if}
