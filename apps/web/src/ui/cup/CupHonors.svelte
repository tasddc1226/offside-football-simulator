<script lang="ts">
  // T-11-145 팀 프로필의 컵 기록 — 우승·준우승·4강은 트로피(금·은·동)와 함께, 그 밖은 기록 한 줄. 구단주가 얻은 성적이라 시즌을
  // 넘어 쌓인다(서버가 최근 대회부터 보낸다).
  import type { CupHonor } from '@offside/app-core/api/cup';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { plateText, trophyStage } from '@offside/app-core/cupTrophy';
  import CupTrophy from './CupTrophy.svelte';
  import { stageLabel } from './cupView.js';

  let { honors }: { honors: readonly CupHonor[] } = $props();

  const MEDAL = { champion: 'gold', runnerup: 'silver', sf: 'bronze' } as const;
</script>

{#if honors.length}
  <section class="card stack" style="gap:10px" data-cup-honors>
    <div>
      <div class="eyebrow">Offside Cup</div>
      <h2>{L.honorsTitle}</h2>
    </div>
    <ul class="ch-list">
      {#each honors as h (h.cupId)}
        {@const trophy = trophyStage(h.stage)}
        {@const medal = trophy && MEDAL[trophy]}
        <li class="ch {medal ? `medal ${medal}` : ''}" class:trophy={!!medal} data-cup-honor={h.stage}>
          {#if trophy}<CupTrophy stage={trophy} name={plateText(h.owner, h.season)} size={60} />{/if}
          <span class="ch-text">
            <b>{h.stage === 'champion' ? L.champTitle({ n: h.edition }) : L.honorResult({ edition: h.edition, stage: stageLabel(h.stage) })}</b>
            <small class="muted">{L.honorTeam({ team: h.teamName })}</small>
          </span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .ch-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ch {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--surface-2);
  }
  .ch.trophy {
    background: color-mix(in srgb, var(--medal, var(--accent)) 14%, var(--surface-2));
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--medal, var(--accent)) 55%, transparent);
  }
  .ch-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
