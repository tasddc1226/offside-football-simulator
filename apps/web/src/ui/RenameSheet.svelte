<script lang="ts">
  // T-11-377 선수 이름 변경권 창 — 진행 중 선수(Game.svelte 이름 옆)와 내 선수 목록(owner/PlayerRelease.svelte)에서 연다.
  // 로그인한 구단주는 변경권 1장으로 이름을 바꾸고, 로그인하지 않은 기기는 로그인 버튼을 본다. 변경권이 없으면 출석 보상 안내와
  // (T-11-471, 앱 스토어 묶음처럼) 웹 결제 묶음을 보인다. 웹 결제가 닫혀 있으면 묶음은 보이지 않는다. 첫 화면 번들 밖 지연
  // 청크(여는 쪽이 import()로 부른다).
  import { untrack } from 'svelte';
  import { fetchItems } from '@offside/app-core/api/cup';
  import { hasSessionHint } from '@offside/app-core/api/client';
  import { PLAYER_NAME_MAX, applyRename, renameDraft, renamePlayer } from '@offside/app-core/rename';
  import { renameText as L } from '@offside/app-core/i18n/ko/rename';
  import LoginButtons from './LoginButtons.svelte';
  import PopSheet from './PopSheet.svelte';
  import WebPayPacks from './cup/WebPayPacks.svelte';
  import type { WebPayBack } from './cup/webPay.svelte.js';
  import { save, toast } from './helpers.js';
  import { appState } from './state.svelte.js';

  const {
    careerId,
    name,
    onclose,
    ondone,
    back = 'owner',
  }: {
    careerId: string;
    name: string;
    onclose: () => void;
    ondone?: (name: string) => void;
    /** 웹 결제를 마치고 돌아갈 화면(진행 중 선수 이름 옆에서 열면 game). */
    back?: WebPayBack;
  } = $props();

  // undefined = 묻는 중, null = 로그인 필요.
  let have = $state<number | null | undefined>(hasSessionHint() ? undefined : null);
  // svelte-ignore state_referenced_locally
  let input = $state(name);
  let busy = $state(false);
  let message = $state('');
  // T-11-442 변경권을 쓰기 전에 바꿀 이름을 한 번 더 보인다. 보낼 이름이 정해지면 확인 단계.
  let confirming = $state<string | null>(null);
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
    if (confirming !== d.name) {
      confirming = d.name;
      message = '';
      return;
    }
    busy = true;
    message = '';
    const r = await renamePlayer(careerId, d.name, key);
    busy = false;
    if (!r.ok) {
      if (!r.error.retryable) key = crypto.randomUUID();
      confirming = null;
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
        <input type="text" maxlength={PLAYER_NAME_MAX} autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" bind:value={input} disabled={busy || !have || confirming !== null} aria-describedby="rn-rule" data-rename-input />
        <small id="rn-rule" class="muted" data-rename-rule>{L.rule({ max: PLAYER_NAME_MAX })}</small>
      </label>
      {#if have !== undefined}<p class="fs-sm num" data-rename-have={have}>{L.have({ n: have })}</p>{/if}
      {#if have === 0}
        <p class="muted fs-sm" data-rename-none>{L.none}</p>
        <WebPayPacks item="rename" {back} />
      {/if}
      {#if message}<p class="rn-msg fs-sm" role="alert">{message}</p>{/if}
      {#if confirming !== null}
        <div class="rn-confirm" role="group" aria-label={L.confirm({ name: confirming })} data-rename-confirm>
          <p class="fs-sm"><b>{L.confirm({ name: confirming })}</b></p>
          <p class="muted fs-sm">{L.confirmNote}</p>
        </div>
        <button type="submit" class="btn btn-accent btn-block" disabled={busy || !have} data-act="rename-submit">{busy ? L.busy : L.btn}</button>
        <button type="button" class="btn btn-block" disabled={busy} data-act="rename-edit" onclick={() => (confirming = null)}>{L.edit}</button>
      {:else}
        <button type="submit" class="btn btn-accent btn-block" disabled={busy || !have} data-act="rename-next">{L.next}</button>
      {/if}
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
    font-size: var(--fs-title3);
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
    font-size: var(--fs-body);
  }
  .rn-confirm {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
  }
  .rn-msg {
    color: var(--bad);
  }
</style>
