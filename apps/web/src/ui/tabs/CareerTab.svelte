<script lang="ts">
  // ui.ts careerTab() 포트 (371~387줄)
  import type { GameState } from '../../game/types.js';
  import { seasonLabelOf, totals } from '../format.js';

  const { s }: { s: GameState } = $props();
  const t = $derived(totals(s));
  const rows = $derived(s.career.slice().reverse());
  const miles = $derived((s.miles || []).slice().reverse());
</script>

<section class="card stack">
  <div><div class="eyebrow">Career</div><h2>통산 기록</h2></div>
  <div class="totals">
    <div><b>{t.p}</b><span>경기</span></div>
    <div><b>{t.g}</b><span>골</span></div>
    {#if s.pos === 'GK' || s.pos === 'DF'}
      <div><b>{t.cs}</b><span>무실점</span></div>
    {:else}
      <div><b>{t.a}</b><span>도움</span></div>
    {/if}
    <div><b>{s.trophies.length + s.awards.length}</b><span>수상</span></div>
  </div>
  {#if s.career.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>시즌</th><th>소속</th><th class="n">경기</th><th class="n">골</th><th class="n">도움</th><th class="n">평점</th><th class="n">순위</th><th class="n">OVR</th></tr>
        </thead>
        <tbody>
          {#each rows as r, i (i)}
            <tr>
              <td>{r.mil ? r.year : seasonLabelOf(r)} <span class="muted">({r.age})</span></td>
              <td>{r.club}<div class="muted" style="font-size:11px">{r.league}{r.honors.length ? ` · ` : ''}{#if r.honors.length}<span class="honor">{r.honors.join(', ')}</span>{/if}</div></td>
              <td class="n">{r.apps}</td>
              <td class="n">{r.goals}</td>
              <td class="n">{r.assists}</td>
              <td class="n">{r.rating ? r.rating.toFixed(2) : '-'}</td>
              <td class="n">{r.rank}</td>
              <td class="n">{r.ovr}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="empty">첫 시즌을 마치면 기록이 쌓입니다.</p>
  {/if}
  <p class="muted" style="font-size:12px">경기·골·도움은 리그·컵·대륙 대회를 합친 공식전 기록입니다.</p>
</section>
<section class="card">
  <div class="eyebrow">Journey</div>
  <h2 style="margin-bottom:4px">커리어 여정</h2>
  {#if miles.length}
    {#each miles as m, i (i)}
      <div class="trophy"><span class="y">{m.year}</span><div><b>{m.t}</b></div></div>
    {/each}
  {:else}
    <p class="empty">프로 데뷔부터 여정이 기록됩니다.</p>
  {/if}
</section>
