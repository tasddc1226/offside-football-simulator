<script lang="ts">
  // SNS 공유 이미지 시트(팀 편성 · 시즌 결산). 열면 make()로 한 장을 그려 미리 보여 주고, 휴대폰은 공유 시트로 바로,
  // 공유 시트가 없는 브라우저는 PNG로 저장한다. 바텀 시트(넓은 화면은 가운데 대화창).
  import { onMount } from 'svelte';
  import { lockScroll } from '../scrollLock.js';

  export type ShareSheetText = {
    title: string;
    lead: string;
    close: string;
    making: string;
    makeFail: string;
    openFail: string;
    save: string;
    share: string;
    remake: string;
    makingBtn: string;
  };

  let {
    make,
    text,
    alt,
    shareTitle,
    shareText,
    note,
    act,
    onclose,
  }: {
    make: () => Promise<File>;
    text: ShareSheetText;
    alt: string;
    shareTitle?: string | undefined;
    shareText: string;
    note?: string | undefined;
    /** data-act · data 속성 접두사(team-share · recap-share). */
    act: string;
    onclose: () => void;
  } = $props();
  const uid = $props.id();
  let dialog: HTMLDialogElement;
  let shot = $state<{ file: File; url: string; canShare: boolean } | null>(null);
  let busy = $state(false);
  let error = $state('');
  let disposed = false;

  onMount(() => {
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.close')?.focus();
    const unlock = lockScroll();
    void build();
    return () => {
      disposed = true;
      if (shot) URL.revokeObjectURL(shot.url);
      dialog.close();
      unlock();
    };
  });

  async function build() {
    if (busy) return;
    busy = true;
    error = '';
    try {
      const file = await make();
      if (disposed) return;
      if (shot) URL.revokeObjectURL(shot.url);
      shot = { file, url: URL.createObjectURL(file), canShare: typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [file] }) };
    } catch {
      if (!disposed) error = text.makeFail;
    } finally {
      if (!disposed) busy = false;
    }
  }
  function save() {
    if (shot) Object.assign(document.createElement('a'), { href: shot.url, download: shot.file.name }).click();
  }
  function trapTab(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  async function share() {
    if (!shot) return;
    try {
      await navigator.share({ files: [shot.file], text: shareText, ...(shareTitle ? { title: shareTitle } : {}) });
    } catch (e) {
      // 공유 시트를 닫은 건 실패가 아니다.
      if ((e as DOMException)?.name !== 'AbortError') error = text.openFail;
    }
  }
</script>

<dialog bind:this={dialog} aria-labelledby="{uid}-title" onclose={onclose} onkeydown={trapTab} {...{ [`data-${act}`]: '' }}>
  <header><div><h2 id="{uid}-title">{text.title}</h2><p>{text.lead}</p></div><button class="close" aria-label={text.close} onclick={() => dialog.close()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button></header>
  <div class="preview-body">
    {#if shot}<img src={shot.url} {alt} width="1080" height="1350" {...{ [`data-${act}-preview`]: '' }} />
    {:else if busy}<div class="making" role="status">{text.making}</div>{/if}
    {#if note}<p class="note">{note}</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
  <footer>
    {#if shot}<button class="btn" data-act="{act}-save" onclick={save}>{text.save}</button>{#if shot.canShare}<button class="btn btn-primary" data-act="{act}-send" onclick={share}>{text.share}</button>{/if}
    {:else}<button class="btn btn-primary" onclick={build} disabled={busy}>{busy ? text.makingBtn : text.remake}</button>{/if}
  </footer>
</dialog>

<style>
  dialog {width:100%;max-width:480px;max-height:92dvh;margin:auto auto 0;padding:0;border:1px solid var(--line);border-radius:18px 18px 0 0;background:var(--surface);color:var(--ink);box-shadow:var(--shadow);overflow:hidden;}
  dialog[open] {display:flex;flex-direction:column;}
  dialog::backdrop {background:#0009;}
  header {display:flex;align-items:center;justify-content:space-between;gap:8px;padding:16px;flex:none;}
  h2 {margin:0;font-size:18px;}
  header p,.note,.error {margin:5px 0 0;font-size:12px;line-height:1.6;color:var(--muted);}
  .close {width:44px;height:44px;flex:none;border:0;border-radius:8px;background:none;color:var(--ink);}
  .close svg {width:20px;height:20px;stroke:currentColor;stroke-width:1.5;fill:none;}
  .preview-body {padding:0 16px 16px;overflow:auto;overscroll-behavior:contain;min-height:0;}
  img {display:block;width:100%;height:auto;border-radius:10px;}
  .making {display:grid;place-items:center;aspect-ratio:4/5;background:var(--surface-2);border-radius:10px;font-size:13px;}
  .error {color:var(--bad);}
  footer {display:flex;gap:8px;padding:12px 16px calc(12px + var(--safe-b));flex:none;}
  footer .btn {flex:1;min-height:44px;font-size:14px;}
  @media(min-width:600px) {dialog {margin:auto;border-radius:18px;}}
</style>
