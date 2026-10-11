<script lang="ts">
  import LoginButtons from './LoginButtons.svelte';
  // T-11-015 라운지 채팅 — 모두가 보는 실시간 공개 채팅. 누구나 읽고, 구글로 로그인하고 닉네임을 정하면 쓴다.
  // 남의 메시지는 신고하고 작성자를 차단한다(앱스토어 UGC 정책) — 여럿이 신고하면 모두의 화면에서 가려진다.
  // 운영자는 메시지를 가리고 작성자를 정지한다. 게임과 무관해 메인 번들과 떼어 처음 열 때 불러온다.
  import { onMount, tick } from 'svelte';
  import { ADMIN_NICKNAME, COMMENT_REPORT_REASONS, type CommentReportReason } from '@offside/contracts/board-limits';
  import { CHAT_BODY_MAX, CHAT_MUTE_DAYS } from '@offside/contracts/chat';
  import * as api from '@offside/app-core/api/chat';
  import { unblock as unblockApi } from '@offside/app-core/api/boards';
  import type { ChatBlockResponse } from '@offside/contracts';
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
  import { chatText as L } from '@offside/app-core/i18n/ko/chat';
  import { goBack } from './history.svelte.js';
  import { lastClosedSeason } from '@offside/contracts/service-seasons';
  import TierBadge from './TierBadge.svelte';
  import TitleBadge from './cup/TitleBadge.svelte';
  import OwnerAvatar from './OwnerAvatar.svelte';

  /** 채팅 티어는 보낸 때의 지난 시즌 티어 — 시즌 이름(툴팁)은 지금 기준 지난 시즌으로 보인다. */
  const tierSeason = lastClosedSeason(new Date().toISOString()) ?? 0;
  import NicknameForm from './NicknameForm.svelte';
  import { toast } from './helpers.js';
  import { createTranslations } from './translations.svelte.js';
  import { canTranslate } from '@offside/app-core/userTranslate';
  import { getLocale } from '@offside/contracts/i18n';
  import { goHome } from './nav.js';
  import { trackViewport } from './viewport.js';
  import { chatSession, listenChat, markChatRead } from './chat-state.svelte.js';

  // 상태는 통째로 바꿔 끼우므로 깊은 반응성이 필요 없다.
  let view = $state.raw<ChatView>(EMPTY_CHAT);
  let text = $state('');
  let selected = $state<string | null>(null);
  let busy = $state(false);
  /** T-11-146 번역 보기. */
  const tr = createTranslations();
  let list: HTMLOListElement | undefined = $state();
  let wrap: HTMLDivElement | undefined = $state();
  let input: HTMLTextAreaElement | undefined = $state();

  const mine = (m: ChatMessage) => !!view.me && m.author === view.me.author;
  /** 맨 아래 가까이 보고 있을 때만 새 줄을 따라 내려간다(위로 올려 읽는 중이면 그대로 둔다). */
  const nearBottom = () => !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80;

  function onListScroll() {
    if (nearBottom()) markChatRead();
    // T-11-180 맨 위 가까이 올리면 이전 줄을 부른다.
    if (list && list.scrollTop < 120) chatSession().older();
  }

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
        // T-11-180 이전 줄이 위에 붙으면 보던 줄이 그 자리에 머물게 늘어난 높이만큼 내린다.
        const prepended = !follow && view.loadingOlder && !v.loadingOlder;
        const before = prepended ? (list?.scrollHeight ?? 0) : 0;
        view = v;
        if (follow) void tick().then(() => {
          list?.scrollTo({ top: list.scrollHeight });
          markVisible();
        });
        else if (prepended) void tick().then(() => {
          if (list) list.scrollTop += list.scrollHeight - before;
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
    if (!chatSession().send(body)) return toast(L.sendWait);
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
    if (await run(api.reportChat(m.id, { reason }), L.reportedToast)) chatSession().drop(m.id);
  }
  async function block(m: ChatMessage) {
    if (!confirm(`${L.blockTitle({ nick: m.nickname })} ${L.blockBody}`)) return;
    const r = await run(api.blockChatAuthor(m.id), L.blockedToast({ nick: m.nickname }));
    if (r) chatSession().block(r.data.author);
  }
  /** T-11-167 차단한 사용자 — 안내 창을 열 때만 불러온다(로그인한 사람만). null이면 아직, 'error'면 실패. */
  let blocks = $state<ChatBlockResponse[] | null | 'error'>(null);
  async function loadBlocks(open: boolean) {
    if (!open || !view.me?.author) return;
    const r = await api.fetchChatBlocks();
    blocks = r.ok ? r.data.blocks : 'error';
  }
  async function unblock(b: ChatBlockResponse) {
    const r = await unblockApi(b.id);
    if (!r.ok) return toast(r.error.message);
    chatSession().unblock(b.author);
    if (Array.isArray(blocks)) blocks = blocks.filter((x) => x.id !== b.id);
    toast(L.unblockedToast({ nick: b.nickname }));
  }
  const hide = (m: ChatMessage) => run(api.adminHideChat(m.id), L.hiddenToast);
  function mute(m: ChatMessage, days: (typeof CHAT_MUTE_DAYS)[number]) {
    if (!confirm(`${L.muteTitle({ nick: m.nickname, days })} ${L.muteBody}`)) return;
    void run(api.adminMuteChat(m.id, { days }), L.mutedToast({ nick: m.nickname, days }));
  }
</script>

<div class="wrap chat-wrap" bind:this={wrap}>
  <section class="card chat-card" data-chat>
    <header class="chat-head">
      <button class="icon-btn chat-back" data-act="home" aria-label={L.back} onclick={() => goBack(goHome)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m14 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <div class="chat-heading">
        <h1>{L.title}</h1>
        <span class="muted fs-xs" data-chat-status>
          {#if view.status === 'open'}<span class="chat-dot" aria-hidden="true"></span>{L.online({ n: view.online })}{:else if view.status === 'retrying'}{L.reconnecting}{:else}{L.connecting}{/if}
        </span>
      </div>
      <details class="chat-rules" ontoggle={(e) => void loadBlocks((e.currentTarget as HTMLDetailsElement).open)}>
        <summary aria-label={L.rulesLabel}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M12 11v6M12 7v1" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </summary>
        <div class="chat-rules-pop">
          <p class="muted fs-xs">{L.rulesBody} <a href="/legal/terms/">{L.terms}</a></p>
          {#if view.me?.author}
            <div class="board-blocks" data-chat-blocks>
              <b class="fs-sm">{L.blockedTitle}</b>
              {#if blocks === 'error'}
                <p class="muted fs-xs">{L.blockedLoadFail}</p>
              {:else if blocks && !blocks.length}
                <p class="muted fs-xs">{L.blockedEmpty}</p>
              {:else if blocks}
                <ul>
                  {#each blocks as b (b.id)}
                    <li class="row" style="justify-content:space-between;align-items:center">
                      <span class="fs-sm">{b.nickname}</span>
                      <button class="icon-btn" data-act="chat-unblock" onclick={() => unblock(b)}>{L.unblock}</button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </div>
      </details>
    </header>

    <ol class="chat-list" bind:this={list} onscroll={onListScroll} data-chat-list>
      {#if view.loadingOlder}<li class="muted fs-sm chat-older">{L.loadingOlder}</li>{/if}
      {#each view.messages as m (m.id)}
        <li class="chat-msg" class:mine={mine(m)} data-chat-msg={m.id}>
          <div class="chat-meta">
            <OwnerAvatar avatarId={m.avatarId} name={m.nickname} />{#if m.admin}<b class="pill good">{ADMIN_NICKNAME}</b>{:else}<b>{m.nickname}</b>{#if m.tier}<TierBadge tag={{ tier: m.tier, season: tierSeason }} />{/if}{#if m.title}<TitleBadge title={m.title} size="sm" />{/if}{/if}
            {#if !mine(m) && (!m.admin || view.me?.admin)}
              <button class="chat-more" aria-expanded={selected === m.id} aria-label={L.moreLabel({ nick: m.nickname })} data-act="chat-more" onclick={() => (selected = selected === m.id ? null : m.id)}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>
              </button>
            {/if}
          </div>
          <!-- 보낸 시각은 말풍선 옆 아래(남의 말은 오른쪽, 내 말은 왼쪽). -->
          <div class="chat-body-row">
            <p class="chat-bubble" lang={tr.translated(m.id) ? getLocale() : undefined}>{tr.text(m.id, m.body)}</p>
            <time class="muted chat-time num" datetime={new Date(m.at).toISOString()}>{chatTime(m.at)}</time>
          </div>
          {#if !mine(m) && canTranslate(m.body)}
            <button class="translate-btn" data-act="translate" disabled={tr.busy(m.id)} onclick={() => void tr.toggle(m.id, m.body)}>{tr.label(m.id)}</button>
          {/if}
          {#if selected === m.id}
            <div class="report-panel stack" style="gap:8px" data-report-panel>
              {#if view.me?.admin}
                <div class="row" style="gap:6px;flex-wrap:wrap;align-items:center">
                  <span class="fs-sm">{L.adminLabel}</span>
                  <button class="btn btn-sm" data-act="chat-hide" disabled={busy} onclick={() => hide(m)}>{L.hide}</button>
                  {#if !m.admin}
                    {#each CHAT_MUTE_DAYS as d (d)}
                      <button class="btn btn-sm" data-act="chat-mute" disabled={busy} onclick={() => mute(m, d)}>{L.muteDays({ days: d })}</button>
                    {/each}
                  {/if}
                </div>
              {/if}
              {#if !m.admin}
                <span class="fs-sm">{L.reportPrompt}</span>
                <div class="row" style="gap:6px;flex-wrap:wrap">
                  {#each COMMENT_REPORT_REASONS as reason (reason)}
                    <button class="btn btn-sm" data-report-reason={reason} disabled={busy} onclick={() => report(m, reason)}>{REPORT_REASON_LABEL[reason]}</button>
                  {/each}
                </div>
                <div class="row" style="gap:8px;justify-content:space-between;align-items:center">
                  <span class="muted fs-xs">{L.blockHint({ nick: m.nickname })}</span>
                  <button class="btn btn-sm" data-act="chat-block" disabled={busy} onclick={() => block(m)}>{L.blockAuthor}</button>
                </div>
              {/if}
            </div>
          {/if}
        </li>
      {:else}
        <li class="muted fs-sm chat-empty">{view.status === 'open' ? L.emptyOpen : L.loading}</li>
      {/each}
    </ol>

    <div class="chat-composer">
      {#if view.write}
        <form class="chat-form" onsubmit={(e) => (e.preventDefault(), send())}>
          <textarea
            rows="1"
            aria-label={L.messageLabel}
            placeholder={L.placeholder}
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
          <button class="btn btn-primary chat-send" aria-label={L.send} data-act="chat-send" disabled={!text.trim()} onpointerdown={(e) => { if (document.activeElement === input) e.preventDefault(); }}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </form>
      {:else if view.status !== 'open'}
        <!-- 연결하는 중 -->
      {:else if view.me?.reason === 'login' || !view.me}
        <div class="comment-gate" data-chat-gate="login">
          <p class="muted">{L.gateLogin}</p>
          <LoginButtons act="chat-login" back={{ chat: true }} />
        </div>
      {:else if view.me.reason === 'nickname'}
        <div class="comment-gate" data-chat-gate="nickname">
          <p class="muted">{L.gateNicknameWeb}</p>
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
