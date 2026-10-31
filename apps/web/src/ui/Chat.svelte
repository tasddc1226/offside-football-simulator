<script lang="ts">
  import Skeleton from './Skeleton.svelte';
  import LoginButtons from './LoginButtons.svelte';
  // T-11-015 라운지 채팅 — 모두가 보는 실시간 공개 채팅. 누구나 읽고, 구글로 로그인하고 닉네임을 정하면 쓴다.
  // 남의 메시지는 신고하고 작성자를 차단한다(앱스토어 UGC 정책) — 여럿이 신고하면 모두의 화면에서 가려진다.
  // 운영자는 메시지를 가리고 작성자를 정지한다. 게임과 무관해 메인 번들과 떼어 처음 열 때 불러온다.
  import { flushSync, onMount, tick } from 'svelte';
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
  import PopSheet from './PopSheet.svelte';

  /** 채팅 티어는 보낸 때의 지난 시즌 티어 — 시즌 이름(툴팁)은 지금 기준 지난 시즌으로 보인다. */
  const tierSeason = lastClosedSeason(new Date().toISOString()) ?? 0;
  import NicknameForm from './NicknameForm.svelte';
  import { toast } from './helpers.js';
  import { createTranslations } from './translations.svelte.js';
  import { canTranslate } from '@offside/app-core/userTranslate';
  import { getLocale } from '@offside/contracts/i18n';
  import { go, goHome } from './nav.js';
  import { appState, hofStart } from './state.svelte.js';
  import { trackViewport } from './viewport.js';
  import { chatSession, chatState, listenChat, markChatRead, switchChatRoom } from './chat-state.svelte.js';
  import { CHAT_ROOMS } from '@offside/contracts/chat';
  import { LOCALE_NAMES } from '@offside/contracts/i18n';

  // T-11-600 라운지 필드(시제품) — 개발 서버나 VITE_LOUNGE_FIELD=1 빌드에서만 보인다. 같은 방을 축구장으로 본다.
  const FIELD = import.meta.env.DEV || import.meta.env.VITE_LOUNGE_FIELD === '1';
  let mode = $state<'chat' | 'field'>(FIELD ? 'field' : 'chat');
  /** 필드에서 선수를 누르면 그 사람의 가장 최근 줄로 사람 창을 연다. */
  function pickAuthor(author: string) {
    const m = view.messages.findLast((x) => x.author === author);
    if (m && canAct(m)) selected = m.id;
  }
  // 폰의 필드 보기는 입력창을 접어 두고, 필드의 쓰기 버튼을 누르면 그 자리에서 펼친다.
  // 보낸 뒤에도 이어 쓸 수 있게 펼친 채 두고, 빈 입력창에서 빠져나가면(필드를 누르는 등) 접는다.
  let fieldTyping = $state(false);
  /** 입력창을 펼치고 바로 초점을 준다. 펼침을 먼저 그려야 같은 탭 안에서 iOS 키보드가 뜬다. */
  function openComposer() {
    flushSync(() => (fieldTyping = true));
    input?.focus();
  }
  // 언어 방 메뉴: 고르거나 바깥을 누르거나 Esc면 닫는다.
  let langMenu = $state<HTMLDetailsElement>();
  function pickRoom(r: (typeof CHAT_ROOMS)[number]) {
    if (langMenu) langMenu.open = false;
    switchChatRoom(r);
  }
  function closeLangMenu(e: Event) {
    if (!langMenu?.open) return;
    if (e instanceof KeyboardEvent ? e.key === 'Escape' : !langMenu.contains(e.target as Node)) langMenu.open = false;
  }
  // 채팅 보기로 돌아오면 맨 아래 줄부터 보인다.
  $effect(() => {
    if (mode === 'chat' && list) void tick().then(() => list?.scrollTo({ top: list.scrollHeight }));
  });

  // 상태는 통째로 바꿔 끼우므로 깊은 반응성이 필요 없다.
  let view = $state.raw<ChatView>(EMPTY_CHAT);
  let text = $state('');
  let selected = $state<string | null>(null);
  /** T-11-573 답장할 원문. 원문이 화면에서 빠지면(가림·차단) 답장도 접는다. */
  let replyTo = $state<ChatMessage | null>(null);
  const replying = $derived(replyTo && view.messages.some((m) => m.id === replyTo!.id) ? replyTo : null);
  /** 거절된 줄을 되돌릴 때 답장도 되돌린다. */
  let sentReply: ChatMessage | null = null;
  let busy = $state(false);
  /** T-11-146 번역 보기. */
  const tr = createTranslations();
  let list: HTMLOListElement | undefined = $state();
  let wrap: HTMLDivElement | undefined = $state();
  let input: HTMLTextAreaElement | undefined = $state();

  const mine = (m: ChatMessage) => !!view.me && m.author === view.me.author;
  /** T-11-344 남의 줄이면 프로필 사진·이름·⋯을 눌러 그 사람 창(신고·차단, 운영자는 가리기·정지)을 연다. */
  const canAct = (m: ChatMessage) => !mine(m) && (!m.admin || !!view.me?.admin);
  const picked = $derived(selected ? view.messages.find((m) => m.id === selected) : undefined);
  const toggle = (m: ChatMessage) => (selected = selected === m.id ? null : m.id);
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
        if (restore) {
          text ||= restore;
          replyTo ??= sentReply;
        }
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
    if (!chatSession().send(body, replying?.id)) return toast(L.sendWait);
    sentReply = replying;
    replyTo = null;
    text = '';
  }
  function startReply(m: ChatMessage) {
    replyTo = m;
    if (mode === 'field') openComposer();
    else input?.focus();
  }
  const quoteName = (r: { admin: boolean; nickname: string }) => (r.admin ? ADMIN_NICKNAME : r.nickname);
  /** T-11-573 인용을 누르면 원문으로 올라가 잠깐 표시한다. 불러오지 않은 옛 줄이면 알리기만 한다. */
  function jump(id: string) {
    const el = list?.querySelector<HTMLElement>(`[data-chat-msg="${CSS.escape(id)}"]`);
    if (!el) return toast(L.replyNotLoaded);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('chat-flash');
    void el.offsetWidth;
    el.classList.add('chat-flash');
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
  /** T-11-344 작성자의 구단주 프로필(가장 최근 팀)을 기록실에서 연다. 팀이 없으면 알리기만 한다. */
  async function openProfile(m: ChatMessage) {
    busy = true;
    const r = await api.fetchChatOwner(m.id);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    if (!r.data.teamId) return toast(L.noProfile);
    selected = null;
    appState.hof = { ...hofStart(), tab: 'teams', team: r.data.teamId, owner: true };
    go('hof');
  }
  const hide = (m: ChatMessage) => run(api.adminHideChat(m.id), L.hiddenToast);
  function mute(m: ChatMessage, days: (typeof CHAT_MUTE_DAYS)[number]) {
    if (!confirm(`${L.muteTitle({ nick: m.nickname, days })} ${L.muteBody}`)) return;
    void run(api.adminMuteChat(m.id, { days }), L.mutedToast({ nick: m.nickname, days }));
  }
</script>

<svelte:window onclick={closeLangMenu} onkeydown={closeLangMenu} />

<div class="wrap chat-wrap" bind:this={wrap}>
  <section class="card chat-card" class:field-mode={mode === 'field'}
    class:field-typing={fieldTyping} data-chat>
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
      <details class="chat-lang" bind:this={langMenu}>
        <summary aria-label={L.roomsLabel} data-act="chat-lang">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
          <span lang={chatState.room}>{LOCALE_NAMES[chatState.room]}</span>
          <svg class="chat-lang-caret" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </summary>
        <div class="chat-lang-pop" role="group" aria-label={L.roomsLabel}>
          {#each CHAT_ROOMS as r (r)}
            <button class="chat-lang-opt" lang={r} aria-pressed={chatState.room === r} data-chat-room={r} onclick={() => pickRoom(r)}>
              {LOCALE_NAMES[r]}
              {#if chatState.room === r}<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
            </button>
          {/each}
        </div>
      </details>
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
    {#if FIELD}
      <div class="chat-view" role="group" aria-label={L.viewLabel}>
        <button aria-pressed={mode === 'field'} data-chat-view="field" onclick={() => (mode = 'field')}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M12 5v14" stroke="currentColor" stroke-width="1.8" /><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
          {L.viewField}
        </button>
        <button aria-pressed={mode === 'chat'} data-chat-view="chat" onclick={() => (mode = 'chat')}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
          {L.viewChat}
        </button>
      </div>
    {/if}

    {#if mode === 'field'}
      {#await import('./lounge/LoungeField.svelte') then F}
        <F.default
          messages={view.messages}
          me={view.write && view.me?.author ? { author: view.me.author, nickname: view.me.nickname ?? '' } : null}
          onpick={pickAuthor}
          onchat={openComposer}
        />
      {/await}
    {:else}
    <ol class="chat-list" bind:this={list} onscroll={onListScroll} data-chat-list>
      {#if view.loadingOlder}<li class="muted fs-sm chat-older">{L.loadingOlder}</li>{/if}
      {#each view.messages as m (m.id)}
        <li class="chat-msg" class:mine={mine(m)} data-chat-msg={m.id}>
          <div class="chat-meta">
            {#snippet who()}<OwnerAvatar avatarId={m.avatarId} name={m.nickname} />{#if m.admin}<b class="pill good">{ADMIN_NICKNAME}</b>{:else}<b>{m.nickname}</b>{/if}{/snippet}
            {#if canAct(m)}
              <button class="chat-who" aria-haspopup="dialog" aria-label={L.moreLabel({ nick: m.nickname })} data-act="chat-who" onclick={() => toggle(m)}>{@render who()}</button>
            {:else}{@render who()}{/if}{#if !m.admin}{#if m.tier}<TierBadge tag={{ tier: m.tier, season: tierSeason }} />{/if}{#if m.title}<TitleBadge title={m.title} size="sm" />{/if}{/if}
            {#if canAct(m)}
              <button class="chat-more" aria-haspopup="dialog" aria-expanded={selected === m.id} aria-label={L.moreLabel({ nick: m.nickname })} data-act="chat-more" onclick={() => toggle(m)}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>
              </button>
            {/if}
          </div>
          {#if m.replyTo}
            {#if m.reply}
              {@const r = m.reply}
              <button class="chat-quote" data-act="chat-quote" aria-label={L.replyJump({ nick: quoteName(r) })} onclick={() => jump(r.id)}><b>{quoteName(r)}</b><span>{r.body}</span></button>
            {:else}
              <span class="chat-quote gone muted" data-chat-quote-gone>{L.replyGone}</span>
            {/if}
          {/if}
          <!-- 보낸 시각은 말풍선 옆 아래(남의 말은 오른쪽, 내 말은 왼쪽). -->
          <div class="chat-body-row">
            <p class="chat-bubble" lang={tr.translated(m.id) ? getLocale() : undefined}>{tr.text(m.id, m.body)}</p>
            <time class="muted chat-time num" datetime={new Date(m.at).toISOString()}>{chatTime(m.at)}</time>
            {#if view.write && !mine(m)}
              <!-- T-11-575 답장은 시각 옆 아이콘. -->
              <button class="chat-reply" aria-label={L.replyTo({ nick: quoteName(m) })} title={L.replyTo({ nick: quoteName(m) })} data-act="chat-reply" onclick={() => startReply(m)}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 14 4 9l5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
            {/if}
          </div>
          {#if !mine(m) && canTranslate(m.body)}
            <button class="translate-btn" data-act="translate" disabled={tr.busy(m.id)} onclick={() => void tr.toggle(m.id, m.body)}>{tr.label(m.id)}</button>
          {/if}
        </li>
      {:else}
        {#if view.status === 'open'}<li class="muted fs-sm chat-empty">{L.emptyOpen}</li>{:else}<li class="chat-wait"><Skeleton rows={4} /></li>{/if}
      {/each}
    </ol>
    {/if}

    <div class="chat-composer">
      {#if view.write}
        {#if replying}
          <div class="chat-replying" data-chat-replying>
            <p class="fs-xs"><b>{L.replyTo({ nick: quoteName(replying) })}</b> <span class="muted">{replying.body}</span></p>
            <button type="button" class="icon-btn" aria-label={L.replyCancel} data-act="chat-reply-cancel" onclick={() => (replyTo = null)}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            </button>
          </div>
        {/if}
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
            onblur={() => {
              if (!text.trim() && !replyTo) fieldTyping = false;
            }}
            onkeydown={(e) => {
              if (e.key === 'Escape' && replyTo) {
                e.preventDefault();
                replyTo = null;
                return;
              }
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

{#if picked}
  <PopSheet label={L.userLabel({ nick: picked.nickname })} onclose={() => (selected = null)}>
    <div class="stack chat-user" style="gap:12px" data-report-panel>
      <div class="row chat-user-head">
        <OwnerAvatar avatarId={picked.avatarId} name={picked.nickname} size={44} />
        <div class="stack" style="gap:4px;min-width:0">
          {#if picked.admin}<b class="pill good">{ADMIN_NICKNAME}</b>{:else}<b class="chat-user-name">{picked.nickname}</b>{/if}
          {#if !picked.admin && (picked.tier || picked.title)}
            <div class="row" style="gap:6px;flex-wrap:wrap;align-items:center">{#if picked.tier}<TierBadge tag={{ tier: picked.tier, season: tierSeason }} />{/if}{#if picked.title}<TitleBadge title={picked.title} size="sm" />{/if}</div>
          {/if}
        </div>
        {#if !picked.admin}
          <button class="btn btn-sm chat-user-profile" data-act="chat-profile" disabled={busy} onclick={() => openProfile(picked)}>{L.viewProfile}</button>
        {/if}
      </div>
      {#if view.me?.admin}
        <div class="row" style="gap:6px;flex-wrap:wrap;align-items:center">
          <span class="fs-sm">{L.adminLabel}</span>
          <button class="btn btn-sm" data-act="chat-hide" disabled={busy} onclick={() => hide(picked)}>{L.hide}</button>
          {#if !picked.admin}
            {#each CHAT_MUTE_DAYS as d (d)}
              <button class="btn btn-sm" data-act="chat-mute" disabled={busy} onclick={() => mute(picked, d)}>{L.muteDays({ days: d })}</button>
            {/each}
          {/if}
        </div>
      {/if}
      {#if !picked.admin}
        <span class="fs-sm">{L.reportPrompt}</span>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          {#each COMMENT_REPORT_REASONS as reason (reason)}
            <button class="btn btn-sm" data-report-reason={reason} disabled={busy} onclick={() => report(picked, reason)}>{REPORT_REASON_LABEL[reason]}</button>
          {/each}
        </div>
        <div class="row" style="gap:8px;justify-content:space-between;align-items:center">
          <span class="muted fs-xs">{L.blockHint({ nick: picked.nickname })}</span>
          <button class="btn btn-sm" data-act="chat-block" disabled={busy} onclick={() => block(picked)}>{L.blockAuthor}</button>
        </div>
      {/if}
      <button class="btn" data-act="chat-user-close" onclick={() => (selected = null)}>{L.close}</button>
    </div>
  </PopSheet>
{/if}

<style>
  /* T-11-600 폰에서 필드를 볼 때는 입력창을 접어 두고, 필드의 쓰기 버튼을 누르면 펼친다. */
  @media (pointer: coarse) {
    .field-mode:not(.field-typing) .chat-composer {
      display: none;
    }
  }
  /* T-11-573 답장 — 말풍선 위 인용 한 줄, 입력창 위 답장 중 표시. */
  .chat-quote {
    display: flex;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
    margin: 0 0 4px;
    padding: 4px 10px;
    border: 0;
    border-left: 3px solid var(--pitch);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: inherit;
    font: inherit;
    font-size: var(--fs-caption);
    text-align: left;
    cursor: pointer;
  }
  .chat-quote span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted);
  }
  .chat-quote b {
    flex: none;
  }
  .chat-quote.gone {
    border-left-color: var(--line);
    cursor: default;
  }
  .chat-reply {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    margin-left: -4px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .chat-reply:hover,
  .chat-reply:focus-visible {
    background: var(--surface-2);
    color: var(--ink);
  }
  .chat-replying {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    padding: 4px 4px 4px 10px;
    border-left: 3px solid var(--pitch);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .chat-replying p {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.chat-msg.chat-flash) {
    border-radius: var(--radius-lg);
    animation: chat-flash 1.2s ease-out;
  }
  @keyframes chat-flash {
    from {
      background: color-mix(in srgb, var(--pitch) 22%, transparent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.chat-msg.chat-flash) {
      animation: none;
    }
  }
</style>
