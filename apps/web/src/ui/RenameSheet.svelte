<script lang="ts">
  // T-11-377 선수 이름 변경권 창 — 진행 중 선수(Game.svelte 이름 옆)와 내 선수 목록(owner/PlayerRelease.svelte)에서 연다.
  // 로그인한 구단주는 변경권 1장으로 이름을 바꾸고, 로그인하지 않은 기기는 로그인 버튼을 본다. 웹은 변경권을 팔지 않아
  // 없으면 출석 보상 안내만 한다(사기는 앱). 첫 화면 번들 밖 지연 청크(여는 쪽이 import()로 부른다).
  import { untrack } from 'svelte';
  import { fetchItems } from '@offside/app-core/api/cup';
  import { hasSessionHint } from '@offside/app-core/api/client';
  import { PLAYER_NAME_MAX, applyRename, renameDraft, renamePlayer } from '@offside/app-core/rename';
  import { renameText as L } from '@offside/app-core/i18n/ko/rename';
  import LoginButtons from './LoginButtons.svelte';
  import PopSheet from './PopSheet.svelte';
  import { save, toast } from './helpers.js';
  import { appState } from './state.svelte.js';

  const {
    careerId,
    name,
    onclose,
    ondone,
  }: { careerId: string; name: string; onclose: () => void; ondone?: (name: string) => void } = $props();

  // undefined = 묻는 중, null = 로그인 필요.
  let have = $state<number | null | undefined>(hasSessionHint() ? undefined : null);
  // svelte-ignore state_referenced_locally
  let input = $state(name);
  let busy = $state(false);
  let message = $state('');
  // 응답을 못 받아 다시 누르면 같은 키로 보내 서버가 두 장을 쓰지 않는다. 성공하거나 거절되면 새 키.
  let key = crypto.randomUUID();

  $effect(() => {
    if (untrack(() => have) === null) return;
    void fetchItems().then((r) => {
      have = r.ok ? (r.data.rename ?? 0) : r.error.reason === 'GOOGLE_LOGIN_REQUIRED' ? null : 0;
    });
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy || !have) return;
    const d = renameDraft(input, name);
    if (!d.ok) {
      message = d.message;
      return;
    }
    busy = true;
    message = '';
    const r = await renamePlayer(careerId, d.name, key);
    busy = false;
    if (!r.ok) {
      if (!r.error.retryable) key = crypto.randomUUID();
      if (r.error.reason === 'GOOGLE_LOGIN_REQUIRED') have = null;
      else message = r.error.message || L.fail;
      return;
    }
    if (applyRename(careerId, r.data.name, appState.G)) save();
    toast(L.done({ name: r.data.name }));
    ondone?.(r.data.name);
    onclose();
  }
</script>

<PopSheet label={L.title} {onclose}>
  <form class="rename" data-rename-sheet={have === null ? 'guest' : 'owner'} onsubmit={submit}>
    <h2>{L.title}</h2>
    {#if have === null}
      <p class="fs-sm">{L.guest}</p>
      <LoginButtons act="rename-google-login" />
    {:else}
      <p class="muted fs-sm">{L.lead}</p>
      <label class="rn-field">
        <span class="fs-sm">{L.label}</span>
        <input type="text" maxlength={PLAYER_NAME_MAX} autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" bind:value={input} disabled={busy || !have} data-rename-input />
      </label>
      {#if have !== undefined}<p class="fs-sm num" data-rename-have={have}>{L.have({ n: have })}</p>{/if}
      {#if have === 0}<p class="muted fs-sm" data-rename-none>{L.none}</p>{/if}
      {#if message}<p class="rn-msg fs-sm" role="alert">{message}</p>{/if}
      <button type="submit" class="btn btn-accent btn-block" disabled={busy || !have} data-act="rename-submit">{busy ? L.busy : L.btn}</button>
    {/if}
    <button type="button" class="btn btn-block" data-act="rename-close" onclick={onclose}>{L.close}</button>
  </form>
</PopSheet>

<style>
  .rename {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .rename h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  .rename p {
    margin: 0;
  }
  .rn-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .rn-field input {
    min-height: 44px;
    font-size: 1rem;
  }
  .rn-msg {
    color: var(--bad);
  }
</style>
