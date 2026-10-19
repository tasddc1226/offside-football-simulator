<script lang="ts">
  import type { PushPerformance } from '@offside/contracts';
  import { cupPushText as L, CUP_AUDIENCE_METRICS, CUP_DELIVERY_METRICS, pushClickRate } from '@offside/app-core/pushPerformance';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  let { items = [] }: { items?: PushPerformance['cups'] } = $props();
</script>

<section class="cup-push" aria-label={L.title} data-cup-push>
  <h3>{L.title}</h3>
  <p class="muted fs-xs">{L.policy}</p>
  {#each items as item (item.cupId)}
    <details class="cup-row" data-cup-id={item.cupId}>
      <summary>
        <strong>{item.season !== null && item.edition !== null ? L.cupName({ season: item.season, edition: item.edition }) : item.title}</strong>
        <small class="muted">{kst(item.createdAt)}</small>
        <span class="summary-metrics">
          <span>{L.recipients} <b>{item.recipients.toLocaleString()}</b></span>
          <span>{L.acceptedRecipients} <b>{item.acceptedRecipients.toLocaleString()}</b></span>
          <span>{L.clickRate} <b>{pushClickRate(item)}</b></span>
        </span>
        <span class="muted fs-xs"><span class="closed">{L.expand}</span><span class="opened">{L.collapse}</span></span>
      </summary>
      <dl>
        {#each CUP_AUDIENCE_METRICS as key (key)}<div><dt>{L[key]}</dt><dd>{item[key].toLocaleString()}</dd></div>{/each}
      </dl>
      <p class="muted fs-xs">{L.dedupeHelp}</p>
      <p class="muted fs-xs">{L.notQueuedHelp}</p>
      <dl>
        {#each CUP_DELIVERY_METRICS as key (key)}<div><dt>{L[key]}</dt><dd>{item[key].toLocaleString()}</dd></div>{/each}
      </dl>
    </details>
  {:else}<p class="muted">{L.empty}</p>{/each}
  <p class="muted fs-xs">{L.help}</p>
</section>

<style>
  .cup-push { display: grid; gap: 12px; border-block: 1px solid var(--line); padding-block: 16px; min-width: 0; }
  h3, p, dl { margin: 0; }
  p { line-height: 1.6; }
  .cup-row { border-top: 1px solid var(--line); min-width: 0; }
  summary { display: grid; gap: 8px; padding-block: 14px; min-height: 48px; cursor: pointer; overflow-wrap: anywhere; }
  summary:focus-visible { outline: 2px solid var(--good); outline-offset: 3px; }
  .summary-metrics { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: var(--fs-body2); }
  .summary-metrics b { font-variant-numeric: tabular-nums; }
  dl { display: grid; gap: 10px; padding-block: 12px; }
  dl div { display: flex; gap: 12px; justify-content: space-between; align-items: baseline; }
  dt { min-width: 0; overflow-wrap: anywhere; color: var(--muted); }
  dd { margin: 0; flex-shrink: 0; font-weight: 700; font-variant-numeric: tabular-nums; }
  .opened, details[open] .closed { display: none; }
  details[open] .opened { display: inline; }
</style>
