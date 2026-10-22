<script lang="ts">
  // T-11-145 편성 화면의 컵 명단 띠 — 컵에 참가 중이면 마감 시각을, 잠긴 동안은 잠겼다는 안내를 보여 준다. 서버가 저장을 막으므로
  // 여기서는 안내만 한다. T-11-436 참가 중이거나 신청을 받는 중이면 팀 OVR · 구간 상한과 선발 · 최소 인원 줄을 늘 보인다.
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import type { CupLineupBar } from '@offside/app-core/cupLineupBar';

  let { locked, when, bar = null }: { locked: boolean; when: string | null; bar?: CupLineupBar | null } = $props();
  const warn = $derived(locked || !!bar?.notes.length);
</script>

<section class="card cup-band" class:locked={warn} role="status" data-cup-lineup={locked ? 'locked' : 'open'}>
  <b class="cb-title">{L.title}</b>
  {#if locked || when}<p>{locked ? L.lineupLocked : L.lineupBand({ when: when ?? '' })}</p>{/if}
  {#if bar}
    <div class="cb-rule" data-cup-rule={bar.mode}>
      {#if bar.ovrText}<span class:bad={bar.overCap} data-cup-rule-ovr={bar.overCap ? 'over' : 'ok'}>{bar.ovrText}</span>{/if}
      <span class:bad={bar.short} data-cup-rule-filled={bar.short ? 'short' : 'ok'}>{bar.filledText}</span>
    </div>
    {#each bar.notes as note (note)}<p class="cb-note" data-cup-rule-note>{note}</p>{/each}
  {/if}
</section>

<style>
  .cup-band {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 16px;
    border-left: 4px solid var(--good);
  }
  .cup-band.locked {
    border-left-color: var(--warn);
  }
  .cb-title {
    font-size: var(--fs-label);
  }
  .cup-band p {
    margin: 0;
    font-size: var(--fs-label);
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .cb-rule {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: var(--fs-label);
    font-variant-numeric: tabular-nums;
  }
  .cb-rule .bad {
    color: var(--bad);
    font-weight: 700;
  }
  .cup-band p.cb-note {
    color: color-mix(in srgb, var(--bad) 70%, var(--ink));
  }
</style>
