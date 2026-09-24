<script lang="ts">
  // ui.ts playerTab()/nationalCard() 포트 (316~356줄)
  import { TRAITS } from '../../game/data.js';
  import { ovr } from '../../game/attributes.js';
  import { potGrade, leagueOf, fmtMoney } from '../../game/engine.js';
  import { marketValue } from '../../game/season.js';
  import { milStatusText } from '../../game/military.js';
  import { nextWC, HOSTS } from '../../game/national.js';
  import type { GameState } from '../../game/types.js';
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
</script>

<AttrCard {s} />

<section class="card">
  <div class="eyebrow">Profile</div>
  <h2 style="margin-bottom:10px">선수 정보</h2>
  <dl class="kv">
    <dt>주발</dt><dd>{s.foot}</dd>
    <dt>성장 특성</dt><dd>{traitName}</dd>
    <dt>스카우트 잠재력 평가</dt><dd>{potGrade(s)}등급</dd>
    <dt>최고 OVR</dt><dd>{Math.max(s.peak, ovr(s))}</dd>
    <dt>감독 신뢰</dt><dd>{s.trust >= 2 ? '두터움' : s.trust >= 0 ? '보통' : '냉랭함'}</dd>
    <dt>계약</dt><dd>{s.contract ? `${s.contract.years}년 남음 · ${fmtMoney(s.contract.salary)}/년` : L.amateur ? '아마추어' : '-'}</dd>
    <dt>보유 자금</dt><dd>{fmtMoney(s.money)}원</dd>
    {#if !L.amateur}
      <dt>추정 시장가치</dt><dd>{fmtMoney(value)}원</dd>
    {/if}
  </dl>
</section>

<section class="card">
  <div class="eyebrow">Korea Republic</div>
  <h2 style="margin-bottom:10px">국가대표</h2>
  <div class="totals">
    <div><b>{s.nat.caps}</b><span>A매치</span></div>
    <div><b>{s.nat.goals}</b><span>골</span></div>
    <div><b>{s.nat.assists}</b><span>도움</span></div>
    <div><b>{s.nat.captain ? 'C' : '-'}</b><span>주장</span></div>
  </div>
  <dl class="kv" style="margin-top:10px">
    <dt>A매치 데뷔</dt><dd>{s.nat.debutYear || '미발탁'}</dd>
    <dt>병역</dt><dd>{milTxt}</dd>
    <dt>다음 월드컵</dt><dd>{nextWcYear} · {nextWcHost}</dd>
  </dl>
  {#if tours.length}
    <div style="margin-top:8px">
      {#each tours.slice().reverse() as x (x.year + x.name)}
        <div class="trophy">
          <span class="y">{x.year}</span>
          <div><b>{x.name.replace(/^\d{4} /, '')}</b> <span class="muted" style="font-size:12px">{x.stage} · {x.apps}경기 {x.goals}골</span></div>
        </div>
      {/each}
    </div>
  {/if}
</section>

{#if s.age >= 32 && !L.amateur}
  <button class="btn btn-block" data-act="retire-ask" onclick={retireAsk}>은퇴 선언하기</button>
{/if}
