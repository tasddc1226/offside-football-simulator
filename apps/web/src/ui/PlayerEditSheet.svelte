<script lang="ts">
  // T-11-804 첫 시즌 선수 정보 고치기 창. 첫 시즌 결산 전(career.length === 0, 은퇴 전)에 선수 탭의 '고치기'와 이름 옆 연필에서
  // 연다. 이름 · 주발 · 체격을 무료로, 몇 번이든 고친다. 서버를 부르지 않는다(첫 시즌 업로드가 고친 값으로 처음 들어간다).
  // 첫 화면 번들 밖 지연 청크(여는 쪽이 import()로 부른다).
  import type { GameState } from '@offside/game/types';
  import { BODY_LIMITS } from '@offside/contracts/body';
  import {
    FEET,
    PLAYER_NAME_MAX,
    applyPlayerEdit,
    bodyEditable,
    bodyMessage,
    bodyPreview,
    bodyWaiting,
    playerEditDraft,
    playerEditInput,
  } from '@offside/app-core/player-edit-view';
  import { playerEditText as L } from '@offside/app-core/i18n/ko/playerEdit';
  import { createText as C } from '@offside/app-core/i18n/ko/create';
  import PopSheet from './PopSheet.svelte';
  import { save, toast } from './helpers.js';

  const { s, onclose }: { s: GameState; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const start = playerEditInput(s);
  let name = $state(start.name);
  let h = $state<number | null>(start.h);
  let w = $state<number | null>(start.w);
  let foot = $state(start.foot);
  let message = $state('');
  const canBody = $derived(bodyEditable(s));
  const played = $derived(s.season.played > 0);
  const bodyMsg = $derived(canBody ? bodyMessage({ h, w }) : null);
  const preview = $derived(canBody && !bodyMsg && (h !== s.body?.h || w !== s.body?.w) ? bodyPreview(s, { h: h!, w: w! }) : null);
  const LIM = BODY_LIMITS;

  const num = (v: string) => (v === '' ? null : Math.round(+v));

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const d = playerEditDraft(s, { name, h, w, foot });
    if (!d.ok) {
      // 체격 오류는 체격 칸 아래 안내가 이미 보여 준다(알림으로 한 번 더 읽지 않는다).
      message = d.field === 'body' ? '' : d.message;
      return;
    }
    if (!d.changed) {
      message = L.same;
      return;
    }
    if (applyPlayerEdit(s, d.edit)) save();
    toast(L.done);
    onclose();
  }
</script>

<PopSheet label={L.title} {onclose}>
  <form class="pe" data-player-edit onsubmit={submit}>
    <h2>{L.title}</h2>
    <p class="muted fs-sm">{L.lead}</p>
    <div class="pe-field">
      <label class="fs-sm" for="pe-name">{L.name}</label>
      <input id="pe-name" type="text" maxlength={PLAYER_NAME_MAX} autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" bind:value={name} oninput={() => (message = '')} aria-describedby="pe-name-rule" data-pe-name />
      <small id="pe-name-rule" class="muted">{L.nameRule({ max: PLAYER_NAME_MAX })}</small>
    </div>

    <fieldset class="pe-field">
      <legend class="fs-sm">{L.foot}</legend>
      <div class="pe-opts" role="group" aria-label={L.foot}>
        {#each FEET as f (f)}
          <button type="button" class="opt" data-pe-foot={f} aria-pressed={foot === f} onclick={() => ((foot = f), (message = ''))}><b>{C.foot({ v: f })}</b></button>
        {/each}
      </div>
      <small class="muted" data-pe-foot-note>{L.footNote}</small>
    </fieldset>

    <fieldset class="pe-field">
      <legend class="fs-sm">{L.body}</legend>
      {#if canBody}
        <div class="pe-body">
          <label>
            <span class="fs-sm">{L.height}</span>
            <span class="pe-unit"><input type="number" inputmode="numeric" min={LIM.height.min} max={LIM.height.max} value={h ?? ''} oninput={(e) => ((h = num(e.currentTarget.value)), (message = ''))} aria-invalid={!!bodyMsg} aria-describedby="pe-body-note" data-pe-height /> cm</span>
          </label>
          <label>
            <span class="fs-sm">{L.weight}</span>
            <span class="pe-unit"><input type="number" inputmode="numeric" min={LIM.weight.min} max={LIM.weight.max} value={w ?? ''} oninput={(e) => ((w = num(e.currentTarget.value)), (message = ''))} aria-invalid={!!bodyMsg} aria-describedby="pe-body-note" data-pe-weight /> kg</span>
          </label>
        </div>
        <p id="pe-body-note" class="fs-sm" class:muted={!bodyMsg} class:pe-err={!!bodyMsg} aria-live="polite" data-pe-body-note>
          {#if bodyMsg}{bodyMsg}{:else if preview && preview.ovr.from !== preview.ovr.to}{L.ovrMove(preview.ovr)}{:else}{played ? `${L.bodyNote} ${L.bodyPlayed}` : L.bodyNote}{/if}
        </p>
        {#if preview}
          <div class="pe-preview" data-pe-preview>
            <span class="fs-sm">{L.preview}</span>
            {#if preview.rows.length}
              <span class="muted fs-sm num">{preview.rows.map((r) => r.text).join(' · ')}</span>
            {:else}
              <span class="muted fs-sm">{L.previewNone}</span>
            {/if}
          </div>
        {/if}
      {:else}
        <p class="muted fs-sm" data-pe-body-none>{bodyWaiting(s) ? L.bodyWaiting : L.bodyNone}</p>
      {/if}
    </fieldset>

    {#if message}<p class="pe-err fs-sm" role="alert">{message}</p>{/if}
    <button type="submit" class="btn btn-accent btn-block" data-act="player-edit-save">{L.save}</button>
    <button type="button" class="btn btn-block" data-act="player-edit-close" onclick={onclose}>{L.close}</button>
  </form>
</PopSheet>

<style>
  .pe {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .pe h2 {
    margin: 0;
    font-size: var(--fs-title3);
  }
  .pe p {
    margin: 0;
  }
  .pe-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .pe-field legend {
    padding: 0;
    margin-bottom: 6px;
  }
  .pe-field input[type='text'] {
    min-height: 44px;
    font-size: var(--fs-body);
  }
  .pe-opts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .pe-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .pe-body label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pe-unit {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pe-unit input {
    min-height: 44px;
    width: 100%;
    min-width: 0;
    font-size: var(--fs-body);
  }
  .pe-preview {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--surface-2);
  }
  .pe-err {
    color: var(--bad);
  }
</style>
