<script lang="ts">
  // T-11-681 로고 시트: 큰 로고 미리보기 + 이미지 고르기 · 기본 로고로. 저장은 이 기기에만(app-core compIcons.ts).
  import { compIconsText as T } from '@offside/app-core/i18n/ko/compIcons';
  import { tn } from '@offside/game/i18n/names';
  import PopSheet from './PopSheet.svelte';
  import CompIconView from './CompIconView.svelte';
  import { compIcons, setCompIcon } from './compIcons.svelte.js';
  import { encodeCompIcon } from './compIconImage.js';
  import { toast } from './helpers.js';

  let { ko, onclose }: { ko: string; onclose: () => void } = $props();
  const name = $derived(tn(ko));
  const MAX_FILE = 10 * 1024 * 1024;
  const FAIL = { big: () => T.big, full: () => T.full, space: () => T.noSpace } as const;

  async function upload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_FILE) return toast(T.tooLarge);
    let img: string | null;
    try {
      img = encodeCompIcon(await createImageBitmap(file));
    } catch {
      return toast(T.readFail);
    }
    if (!img) return toast(T.big);
    const r = setCompIcon(ko, img);
    toast(r === true ? T.saved : FAIL[r]());
  }
  function restore() {
    const r = setCompIcon(ko, null);
    toast(r === true ? T.restored : FAIL[r]());
  }
</script>

<PopSheet label={T.sheetTitle({ name })} {onclose}>
  <div class="stack comp-sheet" data-comp-sheet={ko}>
    <div class="comp-sheet-head">
      <CompIconView {ko} size={88} />
      <h2>{T.sheetTitle({ name })}</h2>
    </div>
    <p class="muted fs-sm">{T.intro}</p>
    <div class="comp-sheet-actions">
      <label class="btn btn-primary btn-block">{T.pick}<input type="file" accept="image/*" hidden onchange={upload} data-act="comp-icon-pick" /></label>
      {#if compIcons.map[ko]}<button class="btn btn-block" data-act="comp-icon-reset" onclick={restore}>{T.reset}</button>{/if}
      <button class="btn btn-block" onclick={onclose}>{T.close}</button>
    </div>
    <p class="muted fs-xs">{T.where}</p>
  </div>
</PopSheet>

<style>
  .comp-sheet {
    gap: 12px;
  }
  .comp-sheet-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }
  .comp-sheet-head h2 {
    margin: 0;
  }
  .comp-sheet-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .comp-sheet-actions .btn {
    text-align: center;
  }
</style>
