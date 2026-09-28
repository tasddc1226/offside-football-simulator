<script lang="ts">
  // T-10-076 은퇴 리포트의 영구결번 장면 — 결번 세리머니 · 명예의 벽 헌정 · 이름 공개 안내. 판정 기준(점수·시즌 수)은
  // 서버만 안다 — 웹은 서버가 준 결과만 그린다. LegendReport가 따로 불러온다(첫 화면 번들 밖).
  import type { RetiredNumberResult } from '@offside/contracts';
  import { RN_SHIRT, RN_TRIM, rnStyle } from './rnStyle.js';
  import { setLegendPublic } from './legend.js';
  import { checkRetiredNumber } from '../api/client.js';
  import { recordRn } from './retiredNumber.svelte.js';
  import { isHofEligible } from '@offside/contracts/hof-rules';
  import { totals } from './format.js';
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
  const rnSlot = $derived(rn && rn.kind !== 'pending' && (rn.kind !== 'anonymous' || v.own) ? rn : null);
  /** 결번 구단에서 뛴 시즌(옛 기록은 구단 id가 없어 이름으로 찾는다). */
  const rnClub = $derived.by(() => {
    if (rnSlot?.kind !== 'granted' || !v.d) return null;
    const recs = v.d.career.filter((r) => (r.clubId ? r.clubId === rnSlot.clubId : r.club === rnSlot.club));
    if (!recs.length) return null;
    const t = totals({ career: recs });
    return { from: recs[0]!.year, to: recs.at(-1)!.year, seasons: recs.length, apps: t.p, goals: t.g, assists: t.a };
  });
  const rnColors = $derived(rnStyle(rnSlot?.clubId));
</script>

{#if rn?.kind === 'pending' || rnSlot}
  <section class="film-rn" data-credit="retired-number" data-legend-rn={rn?.kind} style={rnColors} use:reveal>
    {#if rn?.kind === 'pending'}
      <p class="rn-pending" data-rn-pending>서버가 결번을 심사하고 있어요. 잠시 뒤 명예의 전당에서 확인할 수 있어요.</p>
    {:else if rnSlot?.kind === 'granted'}
      <div class="rn-ceremony">
        <div class="eyebrow film-kicker">Retired Number</div>
        <svg class="rn-jersey" viewBox="0 0 120 124" aria-hidden="true">
          <path class="rn-shirt" d={RN_SHIRT} />
          <path class="rn-trim" d={RN_TRIM} />
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
