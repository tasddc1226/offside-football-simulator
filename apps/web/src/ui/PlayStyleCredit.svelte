<script lang="ts">
  // T-10-077 은퇴 리포트의 '플레이 성향' 장면 — 커리어 내내 유저가 한 선택으로 뽑은 유형 · 주사위 기록 · 커리어 최고의
  // 한 수. LegendReport가 따로 불러온다(첫 화면 번들 밖). 선택 기록이 없는 옛 은퇴는 그리지 않는다.
  import { styleReport } from '@offside/game/playStyleReport';
  import type { LegendSource } from '@offside/game/types';

  const {
    d,
    reveal,
  }: {
    d: LegendSource;
    /** 스크롤 크레딧(LegendReport). */
    reveal: (el: HTMLElement) => { destroy: () => void } | undefined;
  } = $props();
  const r = $derived(styleReport(d.style, d.career));
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
  const luckText = (l: number) => (l > 0 ? `+${l}` : l < 0 ? `${l}` : '±0');
  const luckNote = (l: number) =>
    l > 0 ? `기대보다 ${l}번 더 성공` : l < 0 ? `기대보다 ${-l}번 덜 성공` : '딱 기대만큼 성공';
</script>

{#if r}
  <section class="film-style" data-credit="style" data-legend-style={r.type.key} use:reveal>
    <div class="eyebrow film-kicker">How You Played</div>
    <h2>플레이 성향</h2>
    <div class="style-type">
      <span class="style-icon" aria-hidden="true">{r.type.icon}</span>
      <b data-style-name>{r.type.name}</b>
      <p>{r.type.line}</p>
      {#if r.also.length}
        <div class="film-pills">
          {#each r.also as t (t.key)}<span class="pill">{t.icon} {t.name}</span>{/each}
        </div>
      {/if}
    </div>
    <div class="style-grid">
      <div><b>{r.bets}</b><span>주사위를 굴린 선택</span><small>성공 {r.betWins}번 · {pct(r.betWins, r.bets)}%</small></div>
      <div>
        <b class:up={r.luck > 0} class:down={r.luck < 0}>{luckText(r.luck)}</b><span>운</span><small>{luckNote(r.luck)}</small>
      </div>
      <div><b>{r.longshots}</b><span>40% 이하 승부수</span><small>{r.longshotWins}번 적중</small></div>
      <div><b>{r.moves}</b><span>이적</span><small>{r.tierUp ? `윗 리그로 ${r.tierUp}번` : '—'}{r.snubUp ? ` · 빅클럽 거절 ${r.snubUp}번` : ''}</small></div>
    </div>
    {#if r.best}
      <p class="style-best" data-style-best>
        <span class="eyebrow">커리어 최고의 한 수</span>
        <span>성공 확률 <b>{r.best.pct}%</b>의 ‘{r.best.title}’, 기어이 해냈다.</span>
      </p>
    {/if}
    <p class="film-note">선택 {r.choices}번 기준{r.since ? ` · ${r.since}세 이후 기록` : ''}</p>
  </section>
{/if}
