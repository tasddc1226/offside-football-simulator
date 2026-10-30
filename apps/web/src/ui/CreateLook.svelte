<script lang="ts">
  // T-11-545 선수 만들기에서 외형(피부 · 머리색 · 머리 모양)을 무료로 고른다. 고르지 않은 항목은 커리어 ID로 정하는 기본 모습이고,
  // 미리보기는 만들 커리어의 ID(draftCid)로 그려 시작한 선수와 같은 얼굴이다. 만들기 화면 청크에만 실린다.
  import { createAvatarSpec } from '@offside/game/avatar';
  import type { CreateLookItem } from '@offside/game/look';
  import { createLookRows, withCreateLook } from '@offside/app-core/createLook';
  import { createText as L } from '@offside/app-core/i18n/ko/create';
  import { avatarLookText as A } from '@offside/app-core/i18n/ko/avatarLook';
  import { appState, draftCid } from './state.svelte.js';
  import PixelAvatar from './PixelAvatar.svelte';

  const C = appState.C;
  const cid = draftCid(C);
  const spec = $derived(createAvatarSpec(cid, C.look));
  const rows = $derived(createLookRows(C.look));
  const set = (item: CreateLookItem, value: number | null) => (C.look = withCreateLook(C.look, item, value));
</script>

<div class="field create-look" data-create-look>
  <span class="lbl">{L.lookTitle}</span>
  <div class="cl-wrap">
    <div class="cl-preview" role="img" aria-label={L.lookPreview}><PixelAvatar {spec} /></div>
    <div class="cl-rows">
      {#each rows as r (r.item)}
        <div class="cl-row" data-look-item={r.item}>
          <b>{r.name}</b>
          <div class="cl-opts" role="group" aria-label={r.name}>
            <button type="button" class="cl-opt" aria-pressed={r.current === null} aria-label={L.lookAutoAria({ item: r.name })} data-look-opt="auto" onclick={() => set(r.item, null)}>{L.lookAuto}</button>
            {#each r.options as o (o.value)}
              <button type="button" class="cl-opt" class:swatch={!!o.swatch} aria-pressed={r.current === o.value} data-look-opt={o.value}
                aria-label={o.label ?? A.pickAria({ item: r.name, n: o.value + 1 })} onclick={() => set(r.item, o.value)}>
                {#if o.swatch}<span style:background={o.swatch}></span>{:else}{o.label}{/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
  <p class="muted fs-sm">{L.lookNote}</p>
</div>

<style>
  .cl-wrap {display:flex;gap:12px;align-items:flex-start;}
  .cl-preview {flex:none;padding:8px;border-radius:var(--radius-md);background:var(--pitch);position:sticky;top:8px;}
  .cl-rows {flex:1;min-width:0;display:flex;flex-direction:column;gap:10px;}
  .cl-row {display:flex;flex-direction:column;gap:6px;font-size:var(--fs-body2);}
  .cl-opts {display:flex;flex-wrap:wrap;gap:6px;}
  .cl-opt {min-height:32px;min-width:32px;padding:0 10px;border:1px solid transparent;border-radius:var(--radius-pill);background:var(--surface-2);color:var(--ink);font:inherit;font-size:var(--fs-label);cursor:pointer;}
  .cl-opt.swatch {padding:4px;display:grid;place-items:center;}
  .cl-opt.swatch span {display:block;width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 1px #0003;}
  .cl-opt[aria-pressed='true'] {border-color:var(--accent);box-shadow:0 0 0 2px var(--accent);font-weight:700;}
</style>
