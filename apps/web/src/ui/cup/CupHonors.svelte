<script lang="ts">
  // T-11-145 팀 프로필의 컵 기록 — 우승은 챔피언 칭호, 준우승·4강은 트로피, 그 밖은 기록 한 줄. 구단주가 얻은 성적이라 시즌을
  // 넘어 쌓인다(서버가 최근 대회부터 보낸다).
  import { CUP_REWARDS, type CupStage } from '@offside/contracts/cup';
  import type { CupHonor } from '@offside/app-core/api/cup';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import Laurel from '../Laurel.svelte';
  import { stageLabel } from './cupView.js';

  let { honors }: { honors: readonly CupHonor[] } = $props();

  // 트로피 대상은 CUP_REWARDS가 정하고, 여기서는 색만 고른다.
  const COLOR: Partial<Record<CupStage, 'gold' | 'silver'>> = { champion: 'gold', runnerup: 'silver' };
  const medalOf = (s: CupStage) => (CUP_REWARDS[s].trophy ? (COLOR[s] ?? 'bronze') : undefined);
</script>

{#if honors.length}
  <section class="card stack" style="gap:10px" data-cup-honors>
    <div>
      <div class="eyebrow">Offside Cup</div>
      <h2>{L.honorsTitle}</h2>
    </div>
    <ul class="ch-list">
      {#each honors as h (h.cupId)}
        {@const medal = medalOf(h.stage)}
        <li class="ch {medal ? `medal ${medal}` : ''}" class:trophy={!!medal} data-cup-honor={h.stage}>
          {#if medal}<span class="ch-ico"><Laurel /></span>{/if}
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
  .ch-ico {
    position: relative;
    flex: none;
    width: 40px;
    height: 40px;
  }
  .ch-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
