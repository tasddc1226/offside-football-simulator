<script lang="ts">
  // ui.ts playerTab()/nationalCard() 포트 (316~356줄)
  import { POTENTIAL_NOTICE } from '@offside/app-core/potential-view';
  import { TRAITS } from '@offside/game/data';
  import { ovr } from '@offside/game/attributes';
  import { leagueOf, fmtMoney } from '@offside/game/engine';
  import { marketValue } from '@offside/game/season';
  import { milStatusText, SPORTS_SERVICE_NOTICE, SPORTS_SERVICE_LEGACY_NOTICE } from '@offside/game/military';
  import { nextWC, HOSTS } from '@offside/game/national';
  import type { GameState } from '@offside/game/types';
  import { flagOf, isKorean, nationOf } from '@offside/game/nation';
  import { BODY_DEFAULT } from '@offside/contracts/body';
  import { fmtValue } from '@offside/app-core/format';
  import AttrCard from '../AttrCard.svelte';
  import { retireAsk } from '../actions.js';

  const { s }: { s: GameState } = $props();
  const L = $derived(leagueOf(s.leagueId));
  const value = $derived(marketValue(s));
  const traitName = $derived(TRAITS.find((t) => t.id === s.trait)?.name ?? '');
  const milTxt = $derived(milStatusText(s));
  const tours = $derived(s.nat.tours.filter((x) => x.inSquad));
  const nextWcYear = $derived(nextWC(s.year - 1));
  const nextWcHost = $derived((HOSTS.wc as Record<number, string>)[nextWcYear] || '개최지 미정');
  const nation = $derived(nationOf(s));
  // 체격 입력 이전 선수는 포지션 표준 체격으로 보여 준다(표시만 — 능력치 보정은 없다).
  const body = $derived(s.body ?? BODY_DEFAULT[s.pos]);
</script>

<AttrCard {s} />

<section class="card">
  <div class="eyebrow">Profile</div>
  <h2 style="margin-bottom:10px">선수 정보</h2>
  <dl class="kv">
    <dt>국적</dt><dd data-nation><span aria-hidden="true">{flagOf(nation.code)}</span> {nation.ko}</dd>
    <dt>체격</dt><dd data-body>{body.h}cm · {body.w}kg</dd>
    <dt>주발</dt><dd>{s.foot}</dd>
    <dt>성장 특성</dt><dd>{traitName}</dd>
    <dt>잠재력 평가</dt><dd data-pot>{POTENTIAL_NOTICE}</dd>
    <dt>최고 OVR</dt><dd>{Math.max(s.peak, ovr(s))}</dd>
    <dt>감독 신뢰</dt><dd>{s.trust >= 2 ? '두터움' : s.trust >= 0 ? '보통' : '냉랭함'}</dd>
    <dt>계약</dt><dd>{s.contract ? `${s.contract.years}년 남음 · ${fmtMoney(s.contract.salary)}/년` : L.amateur ? '아마추어' : '-'}</dd>
    <dt>보유 자금</dt><dd>{fmtMoney(s.money)}원</dd>
    {#if !L.amateur}
      <dt>추정 몸값</dt><dd data-value>{fmtValue(value)}</dd>
    {/if}
  </dl>
</section>

<section class="card">
  <!-- 영어 나라 이름은 첫 화면 번들에 싣지 않는다 — 외국 국적만 처음 볼 때 불러온다(T-10-096). -->
  <div class="eyebrow">{#if isKorean(s)}Korea Republic{:else}{#await import('@offside/contracts/nations-en') then m}{m.NATION_EN[nation.code]}{/await}{/if}</div>
  <h2 style="margin-bottom:10px">국가대표</h2>
  <div class="totals">
    <div><b>{s.nat.caps}</b><span>A매치</span></div>
    <div><b>{s.nat.goals}</b><span>골</span></div>
    <div><b>{s.nat.assists}</b><span>도움</span></div>
    <div><b>{s.nat.captain ? 'C' : '-'}</b><span>주장</span></div>
  </div>
  <dl class="kv" style="margin-top:10px">
    <dt>A매치 데뷔</dt><dd>{s.nat.debutYear || '미발탁'}</dd>
    {#if isKorean(s)}
      <dt>병역</dt><dd style="overflow-wrap:anywhere" data-military-status>{milTxt}</dd>
    {/if}
    <dt>다음 월드컵</dt><dd>{nextWcYear} · {nextWcHost}</dd>
  </dl>
  {#if isKorean(s)}
    <p class="muted fs-sm" style="margin-top:10px" data-military-guide>{SPORTS_SERVICE_NOTICE}</p>
    {#if s.mil.exempt && s.mil.sportsService?.monthsLeft == null}
      <p class="muted fs-sm" data-military-legacy>{SPORTS_SERVICE_LEGACY_NOTICE}</p>
    {/if}
  {/if}
  {#if tours.length}
    <div style="margin-top:8px">
      {#each tours.slice().reverse() as x (x.year + x.name)}
        <div class="trophy">
          <span class="y">{x.year}</span>
          <div><b>{x.name.replace(/^\d{4} /, '')}</b> <span class="muted fs-xs">{x.stage} · {x.apps}경기 {x.goals}골</span></div>
        </div>
      {/each}
    </div>
  {/if}
</section>

{#if s.age >= 32 && !L.amateur}
  <button class="btn btn-block" data-act="retire-ask" onclick={() => retireAsk()}>은퇴 선언하기</button>
{/if}
