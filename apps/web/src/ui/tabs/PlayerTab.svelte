<script lang="ts">
  import { appFormatText as W } from '@offside/app-core/i18n/ko/appFormat';
  // ui.ts playerTab()/nationalCard() 포트 (316~356줄)
  import { potentialNotice } from '@offside/app-core/potential-view';
  import { gamePlayerText as L } from '@offside/app-core/i18n/ko/gamePlayer';
  import { gameBoostText as B } from '@offside/app-core/i18n/ko/gameBoost';
  import { createText as C } from '@offside/app-core/i18n/ko/create';
  import { tn } from '@offside/game/i18n/names';
  import { TRAITS } from '@offside/game/data';
  import { ovr } from '@offside/game/attributes';
  import { leagueOf, fmtMoney } from '@offside/game/engine';
  import { marketValue } from '@offside/game/season';
  import { milStatusText, sportsServiceNotice, sportsServiceLegacyNotice } from '@offside/game/military';
  import { nextWC, HOSTS } from '@offside/game/national';
  import type { GameState } from '@offside/game/types';
  import { flagOf, isKorean, nationOf } from '@offside/game/nation';
  import { BODY_DEFAULT } from '@offside/contracts/body';
  import { fmtValue } from '@offside/app-core/format';
  import AttrCard from '../AttrCard.svelte';
  import { boostHidden, boostView, doBoost, type BoostOutcome } from '@offside/app-core/boost-view';
  import BoostFx from '../BoostFx.svelte';
  import { retireAsk } from '../actions.js';
  import { save } from '../helpers.js';

  const { s }: { s: GameState } = $props();
  const lg = $derived(leagueOf(s.leagueId));
  const value = $derived(marketValue(s));
  const traitName = $derived(TRAITS.find((t) => t.id === s.trait)?.name ?? '');
  const milTxt = $derived(milStatusText(s));
  const tours = $derived(s.nat.tours.filter((x) => x.inSquad));
  const nextWcYear = $derived(nextWC(s.year - 1));
  const nextWcHost = $derived(tn((HOSTS.wc as Record<number, string>)[nextWcYear] || '') || L.hostTbd);
  const nation = $derived(nationOf(s));
  // 체격 입력 이전 선수는 포지션 표준 체격으로 보여 준다(표시만 — 능력치 보정은 없다).
  const body = $derived(s.body ?? BODY_DEFAULT[s.pos]);
  // T-11-083 잠재력 강화. 자금을 쓰는 시도라 버튼을 한 번 더 눌러야 한다.
  const boost = $derived(boostView(s));
  let arming = $state(false);
  let fx = $state<BoostOutcome | null>(null);
  function onBoost() {
    if (!arming) {
      arming = true;
      return;
    }
    arming = false;
    const out = doBoost(s);
    if (!out) return;
    // 결과를 먼저 저장하고 연출을 연다 — 연출 중에 닫아도 결과는 그대로다.
    save();
    fx = out;
  }
</script>

<AttrCard {s} />

<section class="card">
  <div class="eyebrow">Profile</div>
  <h2 style="margin-bottom:10px">{L.profile}</h2>
  <dl class="kv">
    <dt>{L.nation}</dt><dd data-nation><span aria-hidden="true">{flagOf(nation.code)}</span> {tn(nation.ko)}</dd>
    <dt>{L.body}</dt><dd data-body>{body.h}cm · {body.w}kg</dd>
    <dt>{L.foot}</dt><dd>{C.foot({ v: s.foot })}</dd>
    <dt>{L.trait}</dt><dd>{traitName}</dd>
    <dt>{L.potential}</dt><dd data-pot>{potentialNotice()}</dd>
    <dt>{L.peakOvr}</dt><dd>{Math.max(s.peak, ovr(s))}</dd>
    <dt>{L.trust}</dt><dd>{s.trust >= 2 ? L.trustHigh : s.trust >= 0 ? L.trustMid : L.trustLow}</dd>
    <dt>{L.contract}</dt><dd>{s.contract ? L.contractLeft({ years: s.contract.years, salary: fmtMoney(s.contract.salary) }) : lg.amateur ? L.amateur : '-'}</dd>
    <dt>{L.money}</dt><dd>{W.won({ v: fmtMoney(s.money) })}</dd>
    {#if !lg.amateur}
      <dt>{L.value}</dt><dd data-value>{fmtValue(value)}</dd>
    {/if}
  </dl>
</section>

{#if fx}<BoostFx out={fx} onDone={() => (fx = null)} />{/if}

{#if !boostHidden(s)}
  <section class="card" data-boost={boost.status}>
    <div class="eyebrow">Potential</div>
    <div class="boost-head">
      <h2>{B.title}</h2>
      <span class="boost-steps" aria-label={B.stepsLabel({ max: boost.max, lv: boost.lv })}>
        {#each { length: boost.max } as _, i (i)}<i class:on={i < boost.lv}></i>{/each}
        <b>+{boost.lv}</b>
      </span>
    </div>
    <p class="fs-sm" data-boost-line>{boost.line}</p>
    {#if boost.button}
      {#if arming}<p class="fs-sm boost-confirm" data-boost-confirm>{boost.confirm}</p>{/if}
      <div class="boost-acts">
        <button class="btn btn-primary btn-block" data-act="boost" onclick={onBoost}>{arming ? B.confirmBtn : boost.button}</button>
        {#if arming}<button class="btn" data-act="boost-cancel" onclick={() => (arming = false)}>{B.cancel}</button>{/if}
      </div>
    {/if}
    <p class="muted fs-xs">{boost.note}</p>
    {#if boost.history.length}
      <ul class="boost-log muted fs-xs" data-boost-log>
        {#each boost.history as h, i (i)}<li>{h}</li>{/each}
      </ul>
    {/if}
  </section>
{/if}

<section class="card">
  <!-- 영어 나라 이름은 첫 화면 번들에 싣지 않는다 — 외국 국적만 처음 볼 때 불러온다(T-10-096). -->
  <div class="eyebrow">{#if isKorean(s)}Korea Republic{:else}{#await import('@offside/contracts/nations-en') then m}{m.NATION_EN[nation.code]}{/await}{/if}</div>
  <h2 style="margin-bottom:10px">{L.nationalTitle}</h2>
  <div class="totals">
    <div><b>{s.nat.caps}</b><span>{L.caps}</span></div>
    <div><b>{s.nat.goals}</b><span>{L.goals}</span></div>
    <div><b>{s.nat.assists}</b><span>{L.assists}</span></div>
    <div><b>{s.nat.captain ? 'C' : '-'}</b><span>{L.captain}</span></div>
  </div>
  <dl class="kv" style="margin-top:10px">
    <dt>{L.debut}</dt><dd>{s.nat.debutYear || L.notCalled}</dd>
    {#if isKorean(s)}
      <dt>{L.military}</dt><dd style="overflow-wrap:anywhere" data-military-status>{milTxt}</dd>
    {/if}
    <dt>{L.nextWc}</dt><dd>{nextWcYear} · {nextWcHost}</dd>
  </dl>
  {#if isKorean(s)}
    <p class="muted fs-sm" style="margin-top:10px" data-military-guide>{sportsServiceNotice()}</p>
    {#if s.mil.exempt && s.mil.sportsService?.monthsLeft == null}
      <p class="muted fs-sm" data-military-legacy>{sportsServiceLegacyNotice()}</p>
    {/if}
  {/if}
  {#if tours.length}
    <div style="margin-top:8px">
      {#each tours.slice().reverse() as x (x.year + x.name)}
        <div class="trophy">
          <span class="y">{x.year}</span>
          <div><b>{tn(x.name).replace(/^\d{4} /, '')}</b> <span class="muted fs-xs">{L.tourLine({ stage: tn(x.stage), apps: x.apps, goals: x.goals })}</span></div>
        </div>
      {/each}
    </div>
  {/if}
</section>

{#if s.age >= 32 && !lg.amateur}
  <button class="btn btn-block" data-act="retire-ask" onclick={() => retireAsk()}>{L.retire}</button>
{/if}

<style>
  .boost-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .boost-steps {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .boost-steps i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1.5px solid var(--line);
  }
  .boost-steps i.on {
    background: var(--accent);
    border-color: var(--accent);
  }
  .boost-steps b {
    margin-left: 4px;
    font-variant-numeric: tabular-nums;
  }
  .boost-confirm {
    color: var(--bad);
  }
  .boost-acts {
    display: flex;
    gap: 8px;
    margin: 8px 0;
  }
  .boost-acts [data-act='boost-cancel'] {
    flex: none;
    white-space: nowrap;
  }
  .boost-log {
    margin: 6px 0 0;
    padding-left: 16px;
  }
</style>
