<script lang="ts">
  // T-11-802 게임 안 '의견 보내기' 시트(설정 → 도움말 맨 위 · 홈 맨 아래에서 연다). 첫 화면 번들 밖 지연 청크(여는 쪽이 import()로
  // 부른다). 열 때는 요청하지 않고, 보낼 때 POST /v1/voices 한 번만 나간다. 고른 종류와 쓴 글은 app-core 모듈 변수(voiceDraft)에
  // 남아 닫았다 열어도 그대로 보이고, 보내기에 성공하면 비운다. 키보드가 떠도 보내기 버튼이 보이게 채팅(.chat-wrap)처럼 시트를
  // 보이는 뷰포트에 맞춘다.
  import { onMount } from 'svelte';
  import { voiceText as VT } from '@offside/app-core/i18n/ko/voice';
  import {
    pickVoiceKind,
    submitVoice,
    VOICE_BODY_MAX,
    VOICE_KINDS,
    voiceDraft,
    voiceKindLabel,
    voicePlaceholder,
    webVoiceDevice,
    type VoiceKind,
    type VoiceScreen,
  } from '@offside/app-core/voice';
  import { APP_VERSION } from './helpers.js';
  import { detectInApp, osOf } from './inapp.js';
  import PopSheet from './PopSheet.svelte';
  import { trackViewport } from './viewport.js';

  const { screen, onclose }: { screen: VoiceScreen; onclose: () => void } = $props();

  let kind = $state<VoiceKind | null>(voiceDraft.kind);
  let text = $state(voiceDraft.text);
  let busy = $state(false);
  let message = $state('');
  let done = $state(false);

  onMount(() => trackViewport(document.documentElement));

  /** 기기 대략값: OS · 앱 안 브라우저 이름 · 홈 화면 앱이면 pwa. 전체 UA는 보내지 않는다. */
  function device(): string | null {
    const ua = navigator.userAgent;
    const standalone = matchMedia('(display-mode: standalone)').matches;
    return webVoiceDevice(osOf(ua), detectInApp(ua, standalone)?.app, standalone);
  }

  function pick(k: VoiceKind) {
    kind = pickVoiceKind(k);
  }

  function edit(e: Event & { currentTarget: HTMLTextAreaElement }) {
    text = e.currentTarget.value;
    voiceDraft.text = text;
    message = '';
  }

  async function send(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    message = '';
    busy = true;
    const r = await submitVoice({ screen, platform: 'web', version: APP_VERSION, device: device() });
    busy = false;
    if (!r.ok) {
      message = r.message;
      return;
    }
    kind = null;
    text = '';
    done = true;
  }
</script>

<PopSheet label={VT.title} step={done ? 'done' : ''} {onclose}>
  <div class="voice-sheet" data-voice-sheet={done ? 'done' : 'form'}>
    {#if done}
      <!-- PopSheet가 단계가 바뀌면 초점을 닫기 버튼으로 옮겨 새 live region을 읽지 않을 수 있어, 닫기 버튼의 설명으로도 건다. -->
      <div class="vs-done" role="status">
        <h2 id="vs-done-title">{VT.doneTitle}</h2>
        <p id="vs-done-body">{VT.doneBody}</p>
      </div>
      <button type="button" class="btn btn-block" aria-describedby="vs-done-title vs-done-body" data-act="voice-close" onclick={onclose}>{VT.close}</button>
    {:else}
      <div class="vs-head">
        <h2>{VT.title}</h2>
        <button type="button" class="icon-btn vs-x" aria-label={VT.close} data-act="voice-close" onclick={onclose}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <form class="vs-form" onsubmit={send}>
        <p class="vs-lead fs-sm">{VT.lead}</p>
        <div class="vs-field">
          <small class="fs-sm vs-kind" id="vs-kind">{VT.kindLabel}</small>
          <div class="seg three" role="group" aria-labelledby="vs-kind">
            {#each VOICE_KINDS as k (k)}
              <button type="button" class="opt" aria-pressed={kind === k} data-voice-kind={k} onclick={() => pick(k)}><b>{voiceKindLabel(k)}</b></button>
            {/each}
          </div>
        </div>
        <div class="vs-field">
          <textarea
            rows="5"
            maxlength={VOICE_BODY_MAX}
            aria-label={VT.bodyLabel}
            placeholder={voicePlaceholder(kind)}
            value={text}
            oninput={edit}
            data-voice-body
          ></textarea>
          <small class="vs-count muted num" aria-hidden="true" data-voice-count>{VT.count({ n: text.length, max: VOICE_BODY_MAX })}</small>
        </div>
        <div class="vs-notes muted fs-xs">
          <p>{VT.noteReply}</p>
          <p>{VT.noteContext} <a href="/legal/privacy/" target="_blank" rel="noopener">{VT.privacy}</a></p>
        </div>
        {#if message}<p class="vs-msg fs-sm" role="alert" data-voice-error>{message}</p>{/if}
        <button type="submit" class="btn btn-accent btn-block" disabled={busy} data-act="voice-submit">{busy ? VT.busy : VT.submit}</button>
      </form>
    {/if}
  </div>
</PopSheet>

<style>
  /* 키보드가 떠도 시트가 보이는 뷰포트 안에 머문다(채팅 .chat-wrap과 같은 방식, viewport.ts가 --vvh · --vvtop을 건다).
     max-height만 줄이면 iOS에서 보내기 버튼이 키보드 뒤에 남는다. */
  :global(.modal:has(.voice-sheet)) {
    top: var(--vvtop, 0px);
    bottom: auto;
    height: var(--vvh, 100dvh);
  }
  :global(.sheet:has(.voice-sheet)) {
    max-height: calc(var(--vvh, 100dvh) - 16px);
  }
  .voice-sheet,
  .vs-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .voice-sheet h2 {
    margin: 0;
    font-size: var(--fs-title3);
  }
  .voice-sheet p {
    margin: 0;
  }
  .vs-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .vs-x {
    flex: none;
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .vs-x path {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .vs-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .vs-field textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    min-height: 120px;
    /* 글자 크기는 전역 textarea 규칙(16px 이상, iOS 초점 확대 방지)에 맡긴다. font: inherit는 그 규칙을 덮는다. */
    font-family: inherit;
    line-height: 1.5;
  }
  /* 흐린 색(muted)은 시트가 열리는 움직임 중에 대비 검사를 넘지 못해 본문 색 · 굵기로 구분한다. */
  .vs-kind {
    font-weight: 600;
  }
  .vs-count {
    align-self: flex-end;
  }
  .vs-notes {
    display: flex;
    flex-direction: column;
    gap: 4px;
    line-height: 1.5;
  }
  .vs-notes a {
    color: inherit;
    text-decoration: underline;
  }
  .vs-msg {
    color: var(--bad);
  }
  .vs-done {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
