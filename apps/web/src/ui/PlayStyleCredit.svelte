<script lang="ts">
  // T-10-077 은퇴 리포트의 '플레이 성향' 장면 — 커리어 내내 유저가 한 선택으로 뽑은 유형 · 주사위 기록 · 커리어 최고의
  // 한 수. LegendReport가 따로 불러온다(첫 화면 번들 밖). 선택 기록이 없는 옛 은퇴는 그리지 않는다.
  import { styleReport } from '@offside/game/playStyleReport';
  import { luckNote, luckText, pct } from '@offside/app-core/legendReport';
  import type { LegendSource } from '@offside/game/types';
  import { legendStyleText as L } from '@offside/app-core/i18n/ko/legendStyle';

  const {
    d,
    reveal,
  }: {
    d: LegendSource;
    /** 스크롤 크레딧(LegendReport). */
    reveal: (el: HTMLElement) => { destroy: () => void } | undefined;
  } = $props();
  const r = $derived(styleReport(d.style, d.career));
</script>

{#if r}
  <section class="film-style" data-credit="style" data-legend-style={r.type.key} use:reveal>
    <div class="eyebrow film-kicker">How You Played</div>
    <h2>{L.title}</h2>
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
      <div><b>{r.bets}</b><span>{L.bets}</span><small>{L.betsSmall({ wins: r.betWins, pct: pct(r.betWins, r.bets) })}</small></div>
      <div>
        <b class:up={r.luck > 0} class:down={r.luck < 0}>{luckText(r.luck)}</b><span>{L.luck}</span><small>{luckNote(r.luck)}</small>
      </div>
      <div><b>{r.longshots}</b><span>{L.longshots}</span><small>{L.longshotsSmall({ n: r.longshotWins })}</small></div>
      <div><b>{r.moves}</b><span>{L.moves}</span><small>{L.movesSmall({ tierUp: r.tierUp, snubUp: r.snubUp })}</small></div>
    </div>
    {#if r.best}
      <p class="style-best" data-style-best>
        <span class="eyebrow">{L.bestLabel}</span>
        <span>{L.bestBefore}<b>{r.best.pct}%</b>{L.bestAfter({ title: r.best.title })}</span>
      </p>
    {/if}
    <p class="film-note">{L.choices({ choices: r.choices, since: r.since })}</p>
  </section>
{/if}
