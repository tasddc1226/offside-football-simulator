<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { TEAM_LOGO_COLORS, TEAM_LOGO_SHAPES, defaultTeamLogo, type TeamLogo as Logo } from '@offside/contracts/team-logo';
  import { lockScroll } from '../scrollLock.js';
  import { doneOnEnter } from '../inputDone.js';
  import TeamLogo from './TeamLogo.svelte';

  let { logo, name, onapply, onclose }: { logo: Logo | null; name: string; onapply: (logo: Logo | null) => void; onclose: () => void } = $props();
  let draft = $state<Logo>(untrack(() => ({ ...(logo ?? defaultTeamLogo(name)) })));
  let mode = $state<'preset' | 'image'>(untrack(() => logo?.img ? 'image' : 'preset'));
  let busy = $state(false);
  let error = $state('');
  let dialog: HTMLDialogElement;
  let fileInput = $state<HTMLInputElement>();
  let closeButton: HTMLButtonElement;
  let disposed = false;
  const preview = $derived(mode === 'image' ? draft : { ...draft, img: undefined });
  const SHAPE_LABEL = { s: '방패', p: '뾰족 방패', r: '원형', b: '둥근 사각' };
  const PATTERNS = [['plain', '단색'], ['v', '줄무늬'], ['sash', '사선'], ['half', '반반']] as const;

  onMount(() => {
    dialog.showModal();
    closeButton.focus();
    const unlock = lockScroll();
    return () => { disposed = true; dialog.close(); unlock(); };
  });
  function trapTab(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const fields = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not([hidden]):not(:disabled)')];
    const first = fields[0], last = fields[fields.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }
  async function upload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    busy = true; error = '';
    try {
      const { teamLogoImage } = await import('./teamLogoImage.js');
      const img = await teamLogoImage(file);
      if (!disposed) { draft = { ...draft, img }; mode = 'image'; }
    } catch (e) {
      if (!disposed) error = e instanceof Error && /[가-힣]/.test(e.message) ? e.message : '이미지를 읽지 못했어요. 다른 이미지를 골라 주세요.';
    } finally {
      if (!disposed) busy = false;
    }
  }
  function apply() {
    const value = { ...draft, text: draft.text.trim() };
    if (mode === 'preset') delete value.img;
    onapply(value);
  }
</script>

<dialog bind:this={dialog} aria-labelledby="team-logo-title" onclose={onclose} onkeydown={trapTab} data-team-logo-editor>
  <header><h2 id="team-logo-title">팀 로고</h2><button class="close" bind:this={closeButton} aria-label="팀 로고 설정 닫기" onclick={() => dialog.close()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button></header>
  <div class="body">
    <div class="preview"><TeamLogo logo={preview} {name} size={96} /><div><b>{name}</b><p>적용 후 변경 저장을 누르면<br />내 팀·랭킹·경기 화면에 보여요.</p></div></div>
    <div class="hof-sorts modes" role="group" aria-label="로고 설정 방식">
      <button class="hof-sort" aria-pressed={mode === 'preset'} disabled={busy} onclick={() => { mode = 'preset'; error = ''; }}>기본 엠블럼</button>
      <button class="hof-sort" aria-pressed={mode === 'image'} disabled={busy} onclick={() => { mode = 'image'; error = ''; }}>내 이미지</button>
    </div>
    {#if mode === 'preset'}
      <div class="control"><span class="lbl">모양</span><div class="shapes" role="group" aria-label="엠블럼 모양">
        {#each TEAM_LOGO_SHAPES as shape (shape)}<button class:chosen={draft.shape === shape} aria-label={SHAPE_LABEL[shape]} aria-pressed={draft.shape === shape} data-logo-shape={shape} onclick={() => (draft.shape = shape)}><TeamLogo logo={{ ...preview, shape }} {name} size={42} /></button>{/each}
      </div></div>
      <div class="control"><span class="lbl">팀 색상</span><div class="colors" role="group" aria-label="팀 색상">
        {#each TEAM_LOGO_COLORS as color (color.bg)}<button class:chosen={draft.bg === color.bg && draft.fg === color.fg} aria-label={color.name} aria-pressed={draft.bg === color.bg && draft.fg === color.fg} data-logo-color={color.bg} onclick={() => (draft = { ...draft, bg: color.bg, fg: color.fg })}><span style:background={color.bg} style:color={color.fg}>FC</span></button>{/each}
      </div></div>
      <div class="control"><span class="lbl">무늬</span><div class="hof-sorts patterns" role="group" aria-label="엠블럼 무늬">{#each PATTERNS as [pattern, label] (pattern)}<button class="hof-sort" aria-pressed={draft.pattern === pattern} onclick={() => (draft.pattern = pattern)}>{label}</button>{/each}</div></div>
      <div class="custom"><label class="field"><span class="lbl">글자 · 최대 3자</span><input type="text" maxlength="3" bind:value={draft.text} enterkeyhint="done" use:doneOnEnter data-logo-text /></label><label class="color-label">바탕<input type="color" bind:value={draft.bg} aria-label="로고 바탕색" /></label><label class="color-label">글자색<input type="color" bind:value={draft.fg} aria-label="로고 글자색" /></label></div>
    {:else}
      <input hidden type="file" accept="image/png,image/jpeg,image/webp" bind:this={fileInput} onchange={upload} data-logo-upload />
      <button class="btn upload" disabled={busy} onclick={() => fileInput?.click()}>{busy ? '이미지를 읽는 중…' : draft.img ? '이미지 바꾸기' : '이미지 선택'}</button>
      <p class="hint">PNG·JPG·WebP, 최대 10MB. 이미지 중앙을 정사각형으로 잘라 사용해요. 원본은 저장하지 않아요.</p>
      {#if busy}<span class="sr-only" role="status">이미지를 읽는 중이에요.</span>{/if}
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
  <footer><button class="btn" onclick={() => onapply(null)} disabled={busy}>기본값</button><button class="btn btn-primary" data-act="team-logo-apply" disabled={busy || (mode === 'image' && !draft.img)} onclick={apply}>적용</button></footer>
</dialog>

<style>
  dialog {width:100%;max-width:480px;max-height:92dvh;margin:auto auto 0;padding:0;border:1px solid var(--line);border-radius:18px 18px 0 0;background:var(--surface);color:var(--ink);box-shadow:var(--shadow);overflow:hidden;}
  dialog[open] {display:flex;flex-direction:column;}
  dialog::backdrop {background:#0009;}
  header {display:flex;align-items:center;justify-content:space-between;padding:10px 16px;flex:none;}
  h2 {margin:0;font-size:18px;}
  .close {width:44px;height:44px;flex:none;border:0;border-radius:8px;background:none;color:var(--ink);}
  .close svg {width:20px;height:20px;stroke:currentColor;stroke-width:1.5;fill:none;}
  .body {display:flex;flex-direction:column;gap:16px;padding:0 16px 16px;overflow:auto;overscroll-behavior:contain;min-height:0;}
  .body > * {flex-shrink:0;}
  .preview {display:flex;align-items:center;gap:16px;padding:12px;border-radius:12px;background:var(--surface-2);}
  .preview > div {min-width:0;}
  .preview b {font-size:16px;overflow-wrap:anywhere;}
  .preview p,.hint,.error {font-size:12px;line-height:1.6;color:var(--muted);margin:6px 0 0;}
  .modes,.patterns {margin:0;gap:8px;}
  .modes .hof-sort,.patterns .hof-sort {min-height:44px;}
  .control {display:flex;flex-direction:column;gap:8px;}
  .lbl {font-size:12px;font-weight:600;color:var(--muted);}
  .shapes {display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
  .shapes button {display:flex;align-items:center;justify-content:center;min-height:56px;border:1px solid var(--line);border-radius:10px;background:var(--surface);cursor:pointer;}
  .shapes button.chosen,.colors button.chosen {border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);}
  .colors {display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
  .colors button {display:flex;align-items:center;justify-content:center;min-height:44px;border:1px solid var(--line);border-radius:8px;background:var(--surface);cursor:pointer;}
  .colors span {display:grid;place-items:center;width:30px;height:30px;border-radius:50%;font-family:var(--display);font-weight:700;font-size:15px;}
  .custom {display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:end;}
  .custom input[type='text'] {min-height:44px;width:100%;min-width:0;}
  .color-label {display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:var(--muted);}
  input[type='color'] {width:44px;height:44px;padding:3px;border:1px solid var(--line);border-radius:8px;background:var(--surface);cursor:pointer;}
  .upload {width:100%;min-height:44px;}
  .hint {margin:0;}
  .error {color:var(--bad);}
  footer {display:flex;gap:8px;padding:12px 16px calc(12px + var(--safe-b));border-top:1px solid var(--line);flex:none;}
  footer .btn {flex:1;min-height:44px;font-size:14px;}
  @media(min-width:600px) {dialog {margin:auto;border-radius:18px;}}
</style>
