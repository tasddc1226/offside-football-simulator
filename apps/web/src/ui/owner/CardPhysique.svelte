<script lang="ts">
  import { untrack } from 'svelte';
  import { webPay, type PhysiqueDraft } from '../cup/webPay.svelte.js';
  import { fetchCardPhysique, saveCardPhysique } from '@offside/app-core/api/cardPhysique';
  import {
    BODY_DEFAULT,
    RETIRED_BODY_LIMITS,
    retiredWeightLimits,
    validRetiredBody,
    type RetiredPhysique,
  } from '@offside/contracts/body';
  import { iapText as L } from '@offside/app-core/i18n/ko/iap';
  import { renameText as RN } from '@offside/app-core/i18n/ko/rename';
  import PopSheet from '../PopSheet.svelte';
  import WebPayPacks from '../cup/WebPayPacks.svelte';
  const {
    id,
    name,
    onclose,
    ondone,
    draft = null,
  }: {
    id: string;
    name: string;
    draft?: PhysiqueDraft | null;
    onclose: () => void;
    ondone: () => void;
  } = $props();
  let card = $state<RetiredPhysique | null>(null);
  let h = $state<number>(),
    w = $state<number>();
  let error = $state(''),
    busy = $state(false);
  $effect(() => {
    void webPay.paid;
    let active = true;
    void fetchCardPhysique(id).then((r) => {
      if (!active) return;
      untrack(() => {
        if (!r.ok) {
          error = r.error.message;
          return;
        }
        card = r.data;
        const restore = draft?.revision === card.revision ? draft : null;
        h ??= restore?.height ?? card.height ?? BODY_DEFAULT[card.pos].h;
        w ??= restore?.weight ?? card.weight ?? BODY_DEFAULT[card.pos].w;
      });
    });
    return () => {
      active = false;
    };
  });
  async function save() {
    if (!card || !h || !w || busy) return;
    busy = true;
    try {
      const r = await saveCardPhysique(id, h, w, card.revision);
      if (!r.ok) {
        error = r.error.message;
        return;
      }
      ondone();
    } finally {
      busy = false;
    }
  }
</script>
<PopSheet label={L.physiqueTitle} {onclose}>
  <h2>{name} · {L.physiqueTitle}</h2>
  <p>{L.physiqueNote}</p>
  {#if card}
    {@const limits=RETIRED_BODY_LIMITS[card.pos]}
    {@const weights=retiredWeightLimits(card.pos,h??0)}
    <p>{L.physiqueHave} · {card.tickets}</p>
    {#if card.listed}
      <p>{L.physiqueListed}</p>
    {:else}
      <label>{L.physiqueHeight} · {limits.minH}–{limits.maxH}
        <input type="number" min={limits.minH} max={limits.maxH} step="1" bind:value={h} disabled={busy} />
      </label>
      <label>{L.physiqueWeight} · {weights.min}–{weights.max}
        <input type="number" min={weights.min} max={weights.max} step="1" bind:value={w} disabled={busy} />
      </label>
      {#if card.tickets}
        <button class="btn btn-block btn-primary" disabled={busy || !validRetiredBody(card.pos,h??0,w??0) || (h===card.height && w===card.weight)} onclick={save}>{L.physiqueApply}</button>
      {:else}
        <WebPayPacks item="physique" back={{card:id,height:h??0,weight:w??0,revision:card.revision}}/>
      {/if}
    {/if}
  {/if}
  <button class="btn btn-block" disabled={busy} onclick={onclose}>{RN.close}</button>
  {#if error}<p role="alert">{error}</p>{/if}
</PopSheet>
<style>
label{display:grid;gap:4px;margin-block:10px}input{min-height:44px;width:100%;box-sizing:border-box}
</style>
