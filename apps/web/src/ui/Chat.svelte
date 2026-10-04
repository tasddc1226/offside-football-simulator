<script lang="ts">
  // T-11-015 라운지 채팅 — 모두가 보는 실시간 공개 채팅. 누구나 읽고, 구글로 로그인하고 닉네임을 정하면 쓴다.
  // 남의 메시지는 신고하고 작성자를 차단한다(앱스토어 UGC 정책) — 여럿이 신고하면 모두의 화면에서 가려진다.
  // 운영자는 메시지를 가리고 작성자를 정지한다. 게임과 무관해 메인 번들과 떼어 처음 열 때 불러온다.
  import { onMount, tick } from 'svelte';
  import { ADMIN_NICKNAME, COMMENT_REPORT_REASONS, type CommentReportReason } from '@offside/contracts/board-limits';
  import { CHAT_BODY_MAX, CHAT_MUTE_DAYS } from '@offside/contracts/chat';
  import * as api from '@offside/app-core/api/chat';
  import {
    CHAT_REJECT_TEXT,
    EMPTY_CHAT,
    chatMutedText,
    chatTime,
    type ChatMessage,
    type ChatView,
  } from '@offside/app-core/api/chat';
  import type { ApiResult } from '@offside/app-core/api/client';
  import { REPORT_REASON_LABEL } from '@offside/app-core/boardText';
  import { goBack } from './history.svelte.js';
  import NicknameForm from './NicknameForm.svelte';
  import { toast } from './helpers.js';
  import { startGoogleLogin } from './login.js';
  import { goHome } from './nav.js';
  import { trackViewport } from './viewport.js';
  import { chatSession, listenChat, markChatRead } from './chat-state.svelte.js';

  // 상태는 통째로 바꿔 끼우므로 깊은 반응성이 필요 없다.
  let view = $state.raw<ChatView>(EMPTY_CHAT);
  let text = $state('');
  let selected = $state<string | null>(null);
  let busy = $state(false);
  let list: HTMLOListElement | undefined = $state();
  let wrap: HTMLDivElement | undefined = $state();
  let input: HTMLTextAreaElement | undefined = $state();

  const mine = (m: ChatMessage) => !!view.me && m.author === view.me.author;
  /** 맨 아래 가까이 보고 있을 때만 새 줄을 따라 내려간다(위로 올려 읽는 중이면 그대로 둔다). */
  const nearBottom = () => !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80;

  function connect() {
    chatSession();
  }
  onMount(() => {
    chatSession();
    let entering = true;
    const markVisible = () => { if (nearBottom()) markChatRead(); };
    const stop = listenChat(
      (v) => {
        const grew = v.messages !== view.messages;
        const initial = entering && v.status === 'open';
        const follow = initial || (grew && (nearBottom() || v.messages.at(-1)?.author === v.me?.author));
        if (initial) entering = false;
        view = v;
        if (follow) void tick().then(() => {
          list?.scrollTo({ top: list.scrollHeight });
          markVisible();
        });
      },
      (code, restore) => {
        toast(CHAT_REJECT_TEXT[code]);
        if (restore) text ||= restore;
      },
    );
    void tick().then(markVisible);
    document.addEventListener('visibilitychange', markVisible);
    return () => { stop(); document.removeEventListener('visibilitychange', markVisible); };
  });

  // T-11-019 키보드가 떠도 채팅 화면을 보이는 영역에 맞춘다(style.css .chat-wrap). 키보드가 오르내리는 동안 입력 중이면
  // 마지막 줄을 붙잡는다.
  $effect(() => {
    if (wrap)
      return trackViewport(wrap, () => {
        if (wrap?.contains(document.activeElement) && document.activeElement?.matches('input, textarea'))
          void tick().then(() => requestAnimationFrame(() => list?.scrollTo({ top: list.scrollHeight })));
      });
  });

  function fitInput(el: HTMLTextAreaElement) {
    const follow = nearBottom();
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
    if (follow) list?.scrollTo({ top: list.scrollHeight });
  }
  $effect(() => {
    const el = input;
    void text;
    if (el) void tick().then(() => fitInput(el));
  });
  function focusInput() {
    void tick().then(() => requestAnimationFrame(() => {
      list?.scrollTo({ top: list.scrollHeight });
      markChatRead();
    }));
  }

  function send() {
    const body = text.trim();
    if (!body) return;
    if (!chatSession().send(body)) return toast('연결 중이에요. 잠시 뒤 다시 보내 주세요.');
    text = '';
  }

  /** 요청 하나를 보내고 성공하면 패널을 닫고 알린다. 성공 여부와 응답을 돌려준다. */
  async function run<T>(p: Promise<ApiResult<T>>, done: string) {
    busy = true;
    const r = await p;
    busy = false;
    if (!r.ok) return toast(r.error.message), null;
    selected = null;
    toast(done);
    return r;
  }
  async function report(m: ChatMessage, reason: CommentReportReason) {
    if (await run(api.reportChat(m.id, { reason }), '신고했어요. 운영자가 확인할게요.')) chatSession().drop(m.id);
  }
  async function block(m: ChatMessage) {
    if (!confirm(`${m.nickname}님을 차단할까요? 이 사람의 메시지와 댓글이 더는 보이지 않아요.`)) return;
    const r = await run(api.blockChatAuthor(m.id), `${m.nickname}님을 차단했어요`);
    if (r) chatSession().block(r.data.author);
  }
  const hide = (m: ChatMessage) => run(api.adminHideChat(m.id), '메시지를 가렸어요');
  function mute(m: ChatMessage, days: (typeof CHAT_MUTE_DAYS)[number]) {
    if (!confirm(`${m.nickname}님의 채팅을 ${days}일 정지할까요? 이 메시지도 가려져요.`)) return;
    void run(api.adminMuteChat(m.id, { days }), `${m.nickname}님을 ${days}일 정지했어요`);
  }
</script>

<div class="wrap chat-wrap" bind:this={wrap}>
  <section class="card chat-card" data-chat>
    <header class="chat-head">
      <button class="icon-btn chat-back" data-act="home" aria-label="← 이전으로" onclick={() => goBack(goHome)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m14 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <div class="chat-heading">
        <h1>라운지 채팅</h1>
        <span class="muted fs-xs" data-chat-status>
          {#if view.status === 'open'}<span class="chat-dot" aria-hidden="true"></span>{view.online}명 접속{:else if view.status === 'retrying'}다시 연결하는 중…{:else}연결하는 중…{/if}
        </span>
      </div>
      <details class="chat-rules">
        <summary aria-label="채팅 이용 안내">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M12 11v6M12 7v1" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </summary>
        <p class="muted fs-xs">모두가 보는 공개 채팅이에요. 링크는 보낼 수 없고, 욕설·비방·광고·개인정보는 가리고 이용을 제한해요. <a href="/legal/terms/">이용약관</a></p>
      </details>
    </header>

    <ol class="chat-list" bind:this={list} onscroll={() => { if (nearBottom()) markChatRead(); }} data-chat-list>
      {#each view.messages as m (m.id)}
        <li class="chat-msg" class:mine={mine(m)} data-chat-msg={m.id}>
          <div class="chat-meta">
            {#if m.admin}<b class="pill good">{ADMIN_NICKNAME}</b>{:else}<b>{m.nickname}</b>{/if}
          </div>
          <div class="chat-body-row">
            <p class="chat-bubble">{m.body}</p>
            {#if !mine(m) && (!m.admin || view.me?.admin)}
              <button class="icon-btn chat-more" aria-expanded={selected === m.id} aria-label="{m.nickname}님 메시지 신고·차단" data-act="chat-more" onclick={() => (selected = selected === m.id ? null : m.id)}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>
              </button>
            {/if}
          </div>
          <time class="muted chat-time num" datetime={new Date(m.at).toISOString()}>{chatTime(m.at)}</time>
          {#if selected === m.id}
            <div class="report-panel stack" style="gap:8px" data-report-panel>
              {#if view.me?.admin}
                <div class="row" style="gap:6px;flex-wrap:wrap;align-items:center">
                  <span class="fs-sm">운영</span>
                  <button class="btn btn-sm" data-act="chat-hide" disabled={busy} onclick={() => hide(m)}>가리기</button>
                  {#if !m.admin}
                    {#each CHAT_MUTE_DAYS as d (d)}
                      <button class="btn btn-sm" data-act="chat-mute" disabled={busy} onclick={() => mute(m, d)}>{d}일 정지</button>
                    {/each}
                  {/if}
                </div>
              {/if}
              {#if !m.admin}
                <span class="fs-sm">신고하는 이유를 골라 주세요. 신고한 메시지는 내 화면에서 숨겨요.</span>
                <div class="row" style="gap:6px;flex-wrap:wrap">
                  {#each COMMENT_REPORT_REASONS as reason (reason)}
                    <button class="btn btn-sm" data-report-reason={reason} disabled={busy} onclick={() => report(m, reason)}>{REPORT_REASON_LABEL[reason]}</button>
                  {/each}
                </div>
                <div class="row" style="gap:8px;justify-content:space-between;align-items:center">
                  <span class="muted fs-xs">{m.nickname}님의 메시지를 모두 숨기려면</span>
                  <button class="btn btn-sm" data-act="chat-block" disabled={busy} onclick={() => block(m)}>작성자 차단</button>
                </div>
              {/if}
            </div>
          {/if}
        </li>
      {:else}
        <li class="muted fs-sm chat-empty">{view.status === 'open' ? '아직 조용해요.' : '불러오는 중…'}</li>
      {/each}
    </ol>

    <div class="chat-composer">
      {#if view.write}
        <form class="chat-form" onsubmit={(e) => (e.preventDefault(), send())}>
          <textarea
            rows="1"
            aria-label="채팅 메시지"
            placeholder="메시지 입력"
            maxlength={CHAT_BODY_MAX}
            enterkeyhint="enter"
            autocomplete="off"
            bind:value={text}
            bind:this={input}
            data-chat-input
            onfocus={focusInput}
            onkeydown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer: fine)').matches) {
                e.preventDefault();
                send();
              }
            }}
          ></textarea>
          <button class="btn btn-primary chat-send" aria-label="보내기" data-act="chat-send" disabled={!text.trim()} onpointerdown={(e) => { if (document.activeElement === input) e.preventDefault(); }}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </form>
      {:else if view.status !== 'open'}
        <!-- 연결하는 중 -->
      {:else if view.me?.reason === 'login' || !view.me}
        <div class="comment-gate" data-chat-gate="login">
          <p class="muted">구글로 로그인하면 채팅에 참여할 수 있어요.</p>
          <button class="btn btn-primary" data-act="chat-login" onclick={() => startGoogleLogin({ chat: true })}>구글로 로그인</button>
        </div>
      {:else if view.me.reason === 'nickname'}
        <div class="comment-gate" data-chat-gate="nickname">
          <p class="muted">채팅과 댓글에 쓸 닉네임을 정해 주세요.</p>
          <NicknameForm onsaved={connect} />
        </div>
      {:else}
        <p class="muted fs-sm" data-chat-gate="muted">
          {chatMutedText(view.me.mutedUntil)}
        </p>
      {/if}
    </div>
  </section>
</div>
