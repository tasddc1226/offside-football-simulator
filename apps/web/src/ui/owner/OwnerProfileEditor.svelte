<script lang="ts">
  import { tick } from 'svelte';
  import { lockScroll } from '../scrollLock.js';
  import { teamHomeText as T } from '@offside/app-core/i18n/ko/teamHome';
  import type { Profile } from '@offside/app-core/api/client';
  import { putAvatar } from '@offside/app-core/api/client';
  import { ownerText as L } from '@offside/app-core/i18n/ko/owner';
  import { accountText as A } from '@offside/app-core/i18n/ko/account';
  import { accountCache } from '../account-state.svelte.js';
  import { toast } from '../helpers.js';
  import NicknameForm from '../NicknameForm.svelte';
  import OwnerAvatar from '../OwnerAvatar.svelte';
  let { profile, admin = false }: { profile: Profile; admin?: boolean } = $props();
  let input = $state<HTMLInputElement>();
  let dialog: HTMLDialogElement;
  let closeButton: HTMLButtonElement;
  let open = $state(false);
  $effect(() => { if (open) return lockScroll(); });
  async function edit() {
    open = true;
    await tick();
    dialog.showModal();
    closeButton.focus();
  }
  function close() { if (!busy) dialog.close(); }
  function closed() { open = false; draft = undefined; error = ''; }

  let busy = $state(false);
  let draft = $state<string | undefined>();
  let error = $state('');
  async function upload(e: Event) {
    const field = e.currentTarget as HTMLInputElement;
    const file = field.files?.[0]; field.value = '';
    if (!file || busy) return;
    busy = true; error = '';
    try { const { teamLogoImage } = await import('../team/teamLogoImage.js'); draft = await teamLogoImage(file); }
    catch (e) { error = e instanceof Error && e.name === 'LogoImageError' ? e.message : L.profileImageError; }
    finally { busy = false; }
  }
  async function save(image: string | null) {
    if (busy) return;
    busy = true; error = '';
    try {
      const r = await putAvatar(image);
      if (!r.ok) { error = r.error.message; return; }
      accountCache.value = r.data; accountCache.fetchedAt = Date.now();
      draft = undefined; toast(L.profileSaved);
    } finally { busy = false; }
  }
</script>
<div class="profile-editor" data-owner-profile-editor>
  <button class="edit-button" data-owner-profile-edit aria-label={L.profileEdit} title={L.profileEdit} aria-haspopup="dialog" onclick={() => void edit()}>
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 3.5 4 4M3 17l4.5-1L17 6.5a2.8 2.8 0 0 0-4-4L3.5 12Z" /></svg>
  </button>
  <dialog bind:this={dialog} aria-labelledby="owner-edit-title" onclose={closed} oncancel={(e) => { if (busy) e.preventDefault(); }} data-owner-profile-dialog>
    <header><h2 id="owner-edit-title">{L.profileEdit}</h2><button class="close-button" bind:this={closeButton} disabled={busy} aria-label={T.close} onclick={close}>×</button></header>
    {#if open}
  <div class="editor-body">
    <p class="muted hint">{L.profileHint}</p>
    <div class="photo-row">
      {#if draft}<img class="preview" src={draft} alt={L.profilePreview} width="64" height="64" />{:else}<OwnerAvatar name={profile.nickname ?? L.avatarInitial} avatarId={profile.avatarId} size={64} />{/if}
      <div class="photo-actions">
        <input hidden type="file" accept="image/png,image/jpeg,image/webp" bind:this={input} onchange={upload} data-avatar-upload />
        <button class="btn" disabled={busy} onclick={() => input?.click()}>{busy ? L.profileBusy : L.profileImagePick}</button>
        {#if profile.avatarId}<button class="btn" disabled={busy} data-avatar-reset onclick={() => void save(null)}>{L.profileImageReset}</button>{/if}
      </div>
    </div>
    {#if draft}<div class="draft-actions"><button class="btn" disabled={busy} onclick={() => draft = undefined}>{L.profileCancel}</button><button class="btn btn-primary" disabled={busy} data-avatar-save onclick={() => void save(draft!)}>{L.profileImageSave}</button></div>{/if}
    <p class="muted hint">{L.profileImageHint}</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="name-edit"><span class="name-label">{L.profileName}</span>{#if admin}<b>{A.nicknameFixed({ nickname: profile.nickname })}</b>{:else}{#key profile.nickname}<NicknameForm current={profile.nickname} />{/key}{/if}</div>
  </div>
    {/if}
  </dialog>
</div>
<style>
  .profile-editor{flex:none;align-self:flex-start;margin-left:auto;}
  .edit-button{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:0;border-radius:10px;background:transparent;color:var(--muted);cursor:pointer;}
  .edit-button:hover{background:var(--surface-2);color:var(--ink);}
  .edit-button svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;}
  dialog{position:fixed;inset:0;max-width:100%;width:min(100% - 24px,440px);max-height:85dvh;box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;margin:auto;padding:20px;border:1px solid var(--line);border-radius:18px;background:var(--surface);color:var(--ink);box-shadow:0 16px 64px #0008;}
  dialog::backdrop{background:#0009;}
  header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;}
  h2{font-size:20px;margin:0;}
  .close-button{display:grid;place-items:center;flex:none;width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:inherit;font-size:28px;cursor:pointer;}
  button:focus-visible{outline:2px solid var(--accent, #d4b66a);outline-offset:3px;}
  @media(max-width:600px){dialog{width:100%;max-height:90dvh;margin:auto 0 0;border-radius:20px 20px 0 0;padding:18px 18px max(24px,env(safe-area-inset-bottom));}}
.editor-body{display:flex;flex-direction:column;gap:12px;padding:4px 0 16px;}.hint{font-size:12px;line-height:1.6;margin:0;}.photo-row{display:flex;gap:14px;align-items:center;}.preview{border-radius:50%;object-fit:cover;flex:none;}.photo-actions{display:flex;flex:1;flex-wrap:wrap;gap:8px;}.photo-actions .btn{min-height:44px;font-size:13px;}.draft-actions{display:flex;gap:8px;}.draft-actions .btn{flex:1;min-height:44px;}.name-edit{display:flex;flex-direction:column;gap:8px;}.name-label{font-size:13px;font-weight:700;}.error{color:var(--bad);font-size:13px;margin:0;}
</style>
