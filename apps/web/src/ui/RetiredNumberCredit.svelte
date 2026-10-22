<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  // T-10-076 은퇴 리포트의 영구결번 장면 — 결번 세리머니 · 명예의 벽 헌정 · 이름 공개 안내. 판정 기준(점수·시즌 수)은
  // 서버만 안다 — 웹은 서버가 준 결과만 그린다. LegendReport가 따로 불러온다(첫 화면 번들 밖).
  import type { RetiredNumberResult } from '@offside/contracts';
  import { setLegendPublic } from './legend.js';
  import { canPublishName } from '@offside/app-core/namePublic';
  import { pendingRetirementIds } from '@offside/app-core/outbox';
  import { checkRetiredNumber } from '@offside/app-core/api/client';
  import { recordRn, rnMissOf, rnResults } from './retiredNumber.svelte.js';
  import { isHofEligible } from '@offside/contracts/hof-rules';
  import { rnClubStats, rnMissStats, rnMissText, rnSlotOf } from '@offside/app-core/legendReport';
  import type { LegendView } from './state.svelte.js';
  import ClubMark from './ClubMark.svelte';
  import RnFrame from './RnFrame.svelte';
  import { careerGuideText as CG } from '@offside/app-core/i18n/ko/careerGuide';
  import { legendRnText as L } from '@offside/app-core/i18n/ko/legendRn';
  import { personName } from '@offside/game/i18n/names';

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
  // 로컬·백업 기록은 칭호 증거가 아니므로 상세를 열 때 서버에서 확인한다.
  // 반복 진입은 API 메모를 사용하며 은퇴 업로드 대기 중에는 응답 이벤트를 기다린다.
  /** 한 선수에 한 번만 묻는다(결과를 남기면 rn0가 바뀌어 효과가 다시 돈다). */
  let asked = '';
  $effect(() => {
    const id = v.own?.id ?? v.shareId;
    // 공개 명예의 전당에 오르는 은퇴(만 30세 이상)만 심사 대상이다.
    if (!id || id === asked || !isHofEligible(v.age) || pendingRetirementIds().has(id)) return;
    asked = id;
    void checkRetiredNumber(id).then((r) => {
      if (r.ok) recordRn(id, r.data.retiredNumber, undefined, r.data.title, r.data.retiredNumberMiss);
    });
  });
  const rn = $derived(rn0?.kind === 'taken' && v.own?.id && !(v.own.id in rnResults) ? { ...rn0, wallOfHonor: false } : rn0 ?? null);
  const rnSlot = $derived(rnSlotOf(rn, v.own));
  const rnClub = $derived((rnSlot?.kind === 'granted' || (rnSlot?.kind === 'taken' && rnSlot.wallOfHonor)) ? rnClubStats(rnSlot, v.d) : null);
  // T-11-180 자격에 못 미쳤으면 이유. T-11-264 이번 접속 값이 없으면 기기 기록(HofEntry.rnMiss)에 남긴 값.
  const miss = $derived(!rn && v.own?.id ? rnMissOf(v.own.id, v.own.rnMiss) : undefined);
  const missStats = $derived(miss ? rnMissStats(miss) : []);
</script>

{#if rn?.kind === 'pending' || rnSlot || v.wallOfHonor || miss}
  <section class="film-rn" data-credit="retired-number" data-legend-rn={rn?.kind} use:reveal>
    {#if !rnSlot && v.wallOfHonor}
      <div class="rn-ceremony rn-honour"><div class="eyebrow film-kicker">Wall of Honour</div><p class="rn-stats" data-wall-of-honor>{L.wallOfHonor}</p></div>
    {:else if rn?.kind === 'pending'}
      <p class="rn-pending" data-rn-pending>{L.pending}</p>
    {:else if rnSlot?.kind === 'granted'}
      <div class="rn-ceremony">
        <div class="eyebrow film-kicker">Retired Number</div>
        <div class="rn-unveil">
          <span class="rn-curtain rn-curtain-l" aria-hidden="true"></span>
          <span class="rn-curtain rn-curtain-r" aria-hidden="true"></span>
          <RnFrame class="rn-unveil-frame" clubId={rnSlot.clubId} number={rnSlot.number} />
        </div>
        <p class="rn-line"><b>{L.lineNum({ number: rnSlot.number })}</b>{L.lineNumAfter}<br /><b>{v.name}</b>{L.lineNameAfter}</p>
        {#if rnClub}
          <p class="rn-stats">{L.stats(rnClub)}</p>
        {/if}
        <p class="rn-foot"><ClubMark name={rnSlot.club} id={rnSlot.clubId} size={18} /> {L.foot({ club: tn(rnSlot.club), seq: rnSlot.seq })}</p>
      </div>
    {:else if rnSlot?.kind === 'taken'}
      <div class="rn-ceremony rn-honour">
        <div class="eyebrow film-kicker">Wall of Honour</div>
        {#if rnSlot.wallOfHonor}
          <p class="rn-line"><b>{v.name}</b><br />{CG.wallTitle}</p>
          <p class="rn-stats" role="status" data-wall-of-honor>{L.wallOfHonor}</p>
          {#if rnClub}<p class="rn-stats">{L.stats(rnClub)}</p>{/if}
          <p class="rn-stats">{CG.wallRule}</p>
        {/if}
        {#if rnSlot.wallOfHonor}<p class="rn-stats">{CG.occupied({number: rnSlot.number, holder: rnSlot.holder != null ? personName(rnSlot.holder) : L.anonLegend})}</p>{:else}<p class="rn-line">{L.takenA({ number: rnSlot.number })} <b>{rnSlot.holder != null ? personName(rnSlot.holder) : L.anonLegend}</b>{L.takenB}<br />{L.takenC} <b>{v.name}</b>{L.takenD}</p>{/if}
      </div>
    {:else if rnSlot?.kind === 'anonymous'}
      <div class="rn-ceremony rn-anon">
        <div class="eyebrow film-kicker">Retired Number</div>
        <p class="rn-line">{L.anonA}<br /><b>{L.anonSlot({ club: tn(rnSlot.club), number: rnSlot.number })}</b> {L.anonTail}</p>
        {#if v.own && !canPublishName(v.own.name)}
          <!-- T-11-439 공개할 수 없는 이름이면 누르기 전에 알린다(눌러도 막힌다). -->
          <p class="rn-stats" data-rn-blocked>{L.anonBlocked}</p>
        {:else}
          <p class="rn-stats">{L.anonNote}</p>
          {#if v.own}
            <button class="btn btn-primary" data-act="rn-public" onclick={() => v.own && setLegendPublic(v.own, true)}>{L.publish}</button>
          {/if}
        {/if}
      </div>
    {:else if miss}
      <div class="rn-ceremony rn-miss">
        <div class="eyebrow film-kicker">{L.missKicker}</div>
        <p class="rn-pending" data-rn-miss={miss.reason}>{rnMissText(miss)}</p>
        <!-- T-11-264 어디서 모자랐는지: 시즌 수 · 기여 점수 게이지 -->
        {#if missStats.length}
          <dl class="rn-miss-stats">
            {#each missStats as st (st.key)}
              <div class="rn-miss-stat" data-rn-miss-stat={st.key} data-met={st.met}>
                <dt>{st.label}</dt>
                <dd><span class="rn-miss-bar" aria-hidden="true"><i style:width="{st.pct}%"></i></span><span class="rn-miss-val">{st.value}</span></dd>
              </div>
            {/each}
          </dl>
        {/if}
      </div>
    {/if}
  </section>
{/if}
