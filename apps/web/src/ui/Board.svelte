<script lang="ts">
  // T-10-011 소식 화면 — 공지사항·릴리즈 노트 게시판. 읽기는 누구나, 글은 관리자만(수정·삭제 포함),
  // 댓글은 구글로 로그인하고 닉네임을 정한 사람만(T-10-028). 게임과 무관해 메인 번들과 떼어 처음 열 때 불러온다.
  import { onMount, untrack } from 'svelte';
  import {
    ADMIN_NICKNAME,
    COMMENT_BODY_MAX,
    POST_BODY_MAX,
    POST_TITLE_MAX,
    POST_VERSION_MAX,
    BOARD_KEYS,
  } from '@offside/contracts/board-limits';
  import * as api from '../api/boards.js';
  import type { BoardViewerResponse, Comment, Post, PostSummary } from '../api/boards.js';
  import { appState } from './state.svelte.js';
  import { openBoard } from './nav.js';
  import { startGoogleLogin } from './login.js';
  import { toast } from './helpers.js';
  import { markNewsSeen, touchedAt } from './news.svelte.js';
  import { loadKey, saveKey } from '../game/season.js';
  import { BOARD_LABEL, dateOf, parseBody, postMeta } from './boardText.js';
  import Topbar from './Topbar.svelte';
  import NicknameForm from './NicknameForm.svelte';
  import LoadState, { type LoadStatus } from './LoadState.svelte';

  // 게시판 하나를 보여 준다. 위의 공지사항 · 릴리즈 노트 버튼으로 바꾸면 App이 이 화면을 새로 그린다.
  const board = appState.board;
  /** 관리자 여부와 댓글 자격(구글 로그인·닉네임). 불러오기 전엔 null(댓글 폼을 그리지 않는다). */
  let viewer = $state<BoardViewerResponse | null>(null);
  const admin = $derived(!!viewer?.admin);
  let posts = $state<PostSummary[]>([]);
  let hasMore = $state(false);
  let status = $state<LoadStatus>('loading');
  let detail = $state<{ post: Post; comments: Comment[]; liked: boolean } | null>(null);
  let liking = $state(false);
  /** 관리자 편집기. id가 없으면 새 글. */
  let editing = $state<{ id?: string; title: string; body: string; version: string; pinned: boolean } | null>(null);
  let commentText = $state('');
  let busy = $state(false);

  onMount(() => {
    void api.fetchBoardViewer().then((r) => (viewer = r.ok ? r.data : { admin: false, google: false, nickname: null }));
    void load();
  });

  async function load(more = false) {
    if (!more) status = 'loading';
    const last = posts.filter((p) => !p.pinned).at(-1);
    const r = await api.fetchPosts(board, more ? last?.createdAt : undefined);
    if (!r.ok) {
      if (more) toast(r.error.message);
      else status = 'error';
      return;
    }
    posts = more ? [...posts, ...r.data.posts] : r.data.posts;
    hasMore = r.data.hasMore;
    status = 'ready';
  }

  /** 불러오는 중인 글 — 아래 $effect가 같은 글을 두 번 부르지 않게. */
  let loadingId: string | null = null;
  async function open(id: string) {
    appState.boardOpenId = loadingId = id;
    const r = await api.fetchPost(id);
    if (loadingId === id) loadingId = null;
    if (appState.boardOpenId !== id) return; // 기다리는 사이 다른 글·목록으로 옮겼다.
    if (!r.ok) {
      appState.boardOpenId = null;
      return toast(r.error.message);
    }
    detail = { ...r.data, liked: !!r.data.liked }; // 옛 서버 응답엔 liked가 없다.
    markNewsSeen(touchedAt(r.data.post));
    if (firstView(id)) {
      detail.post.viewCount++;
      void api.addView(id);
    }
    window.scrollTo(0, 0);
  }
  // T-10-058 조회수는 기기마다 글 하나에 한 번만 센다. 최근 VIEWED_MAX개만 기억한다.
  const VIEWED_KEY = 'ft_board_viewed';
  const VIEWED_MAX = 300;
  function firstView(id: string): boolean {
    const seen = loadKey<string[]>(VIEWED_KEY) ?? [];
    if (seen.includes(id)) return false;
    saveKey(VIEWED_KEY, [...seen, id].slice(-VIEWED_MAX));
    return true;
  }
  async function toggleLike() {
    if (!detail || liking) return;
    const d = detail;
    const prev = { liked: d.liked, likeCount: d.post.likeCount };
    // 먼저 화면에 반영하고, 서버 값으로 맞추거나 실패하면 되돌린다.
    d.liked = !prev.liked;
    d.post.likeCount += d.liked ? 1 : -1;
    liking = true;
    const r = await api.setLike(d.post.id, d.liked);
    liking = false;
    const next = r.ok ? r.data : prev;
    d.liked = next.liked;
    d.post.likeCount = next.likeCount;
    if (!r.ok) toast(r.error.message);
  }
  function backToList() {
    detail = editing = null;
    appState.boardOpenId = null;
    void load();
  }
  // T-10-114 펼친 글은 appState.boardOpenId를 따른다 — 홈에서 글을 바로 열 때, 뒤로·앞으로 가기로 바뀔 때.
  $effect(() => {
    const want = appState.boardOpenId;
    untrack(() => {
      if (want === (detail?.post.id ?? null) || (want && want === loadingId)) return;
      if (want) void open(want);
      else if (detail || editing) backToList();
    });
  });
  // T-10-113 하단 '소식'을 다시 누르면 목록 맨 위로(쓰던 글이 있으면 먼저 묻는다).
  let seenTop = appState.boardTop;
  $effect(() => {
    if (appState.boardTop === seenTop) return;
    seenTop = appState.boardTop;
    if (editing && !confirm('작성 중인 글을 두고 목록으로 갈까요?')) return;
    if (detail || editing) backToList();
    window.scrollTo(0, 0);
  });

  function startEdit(post?: Post) {
    editing = post
      ? { id: post.id, title: post.title, body: post.body, version: post.version ?? '', pinned: post.pinned }
      : { title: '', body: '', version: '', pinned: false };
    window.scrollTo(0, 0);
  }
  async function savePost() {
    if (!editing || busy) return;
    const e = editing;
    const input = { title: e.title, body: e.body, pinned: e.pinned, ...(e.version.trim() ? { version: e.version } : {}) };
    busy = true;
    const r = e.id ? await api.updatePost(e.id, input) : await api.createPost(board, input);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    markNewsSeen(touchedAt(r.data)); // 내가 쓰거나 고친 글은 알리지 않는다.
    editing = null;
    toast(e.id ? '글을 고쳤어요' : '글을 올렸어요');
    await open(r.data.id);
  }
  async function removePost(post: Post) {
    if (!confirm(`'${post.title}' 글을 지울까요? 댓글도 함께 숨겨집니다.`)) return;
    const r = await api.deletePost(post.id);
    if (!r.ok) return toast(r.error.message);
    toast('글을 지웠어요');
    backToList();
  }

  async function sendComment() {
    if (!detail || busy) return;
    const post = detail.post;
    busy = true;
    const r = await api.addComment(post.id, { body: commentText });
    busy = false;
    if (!r.ok) return toast(r.error.message);
    commentText = '';
    if (detail?.post.id === post.id) detail.comments = [...detail.comments, r.data];
  }
  // 로그인을 마치고 돌아오면 보던 글로 다시 연다.
  const login = () => startGoogleLogin({ board, postId: detail?.post.id ?? null });
  async function removeComment(c: Comment) {
    if (!confirm('이 댓글을 지울까요?')) return;
    const r = await api.deleteComment(c.id);
    if (!r.ok) return toast(r.error.message);
    if (detail) detail.comments = detail.comments.filter((x) => x.id !== c.id);
  }
</script>

{#snippet tags(p: PostSummary)}
  {#if p.pinned}<span class="pill warn">고정</span>{/if}
  {#if p.version}<span class="pill">{p.version}</span>{/if}
{/snippet}

<div class="wrap">
  <Topbar />
  <section class="card stack" style="gap:14px" data-board={board}>
    <div>
      <div class="eyebrow">News</div>
      <h1>소식</h1>
    </div>
    {#if !detail && !editing}
      <div class="seg board-tabs">
        {#each BOARD_KEYS as k (k)}
          <button class="opt" aria-pressed={board === k} data-board-tab={k} onclick={() => board !== k && openBoard(k)}>{BOARD_LABEL[k]}</button>
        {/each}
      </div>
    {/if}

    {#if editing}
      <form class="stack board-editor" style="gap:10px" onsubmit={(e) => (e.preventDefault(), void savePost())}>
        <h2 style="margin:0">{editing.id ? '글 고치기' : `${BOARD_LABEL[board]} 새 글`}</h2>
        <div class="field">
          <label for="post-title">제목</label>
          <input id="post-title" type="text" maxlength={POST_TITLE_MAX} required bind:value={editing.title} />
        </div>
        {#if board === 'release'}
          <div class="field">
            <label for="post-version">버전</label>
            <input id="post-version" type="text" maxlength={POST_VERSION_MAX} placeholder="v1.4.0" bind:value={editing.version} />
          </div>
        {/if}
        <div class="field">
          <label for="post-body">본문</label>
          <textarea id="post-body" rows="12" maxlength={POST_BODY_MAX} required bind:value={editing.body}></textarea>
          <span class="muted fs-xs">"## 소제목", "- 목록" 줄을 쓸 수 있어요.</span>
        </div>
        <label class="row" style="gap:8px;align-items:center"><input type="checkbox" bind:checked={editing.pinned} /> 맨 위에 고정</label>
        <div class="row" style="gap:8px">
          <button class="btn btn-accent" type="submit" data-act="save-post" disabled={busy}>{editing.id ? '저장' : '올리기'}</button>
          <button class="icon-btn" type="button" onclick={() => (editing = null)}>취소</button>
        </div>
      </form>
    {:else if detail}
      {@const post = detail.post}
      <article class="stack board-post" style="gap:10px" data-post={post.id}>
        <div class="stack" style="gap:4px">
          <div class="row" style="gap:6px;flex-wrap:wrap">
            {@render tags(post)}
            <span class="muted fs-xs">{dateOf(post.createdAt)}{post.updatedAt !== post.createdAt ? ' · 수정됨' : ''} · 조회 {post.viewCount}</span>
          </div>
          <h2 style="margin:0">{post.title}</h2>
        </div>
        <div class="board-body">
          {#each parseBody(post.body) as b, i (i)}
            {#if b.kind === 'h'}<h3>{b.text}</h3>
            {:else if b.kind === 'ul'}<ul>{#each b.items as it, j (j)}<li>{it}</li>{/each}</ul>
            {:else}<p>{#each b.lines as line, j (j)}{#if j}<br />{/if}{line}{/each}</p>{/if}
          {/each}
        </div>
        <button class="btn btn-sm like-btn" aria-pressed={detail.liked} aria-label="좋아요 {post.likeCount}" data-act="like" onclick={toggleLike}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.3s-7.8-4.6-7.8-10.4A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.8 2.5c0 5.8-7.8 10.4-7.8 10.4Z" /></svg>
          <span class="num" data-like-count>{post.likeCount}</span>
        </button>
        {#if admin}
          <div class="row" style="gap:8px">
            <button class="icon-btn" data-act="edit-post" onclick={() => startEdit(post)}>수정</button>
            <button class="icon-btn" data-act="delete-post" onclick={() => removePost(post)}>삭제</button>
          </div>
        {/if}
      </article>
      <section class="stack board-comments" style="gap:10px" aria-label="댓글">
        <h3 style="margin:0">댓글 {detail.comments.length}</h3>
        {#each detail.comments as c (c.id)}
          <div class="board-comment" data-comment={c.id}>
            <div class="row" style="gap:6px;align-items:center">
              <!-- 관리자 댓글은 닉네임 대신 운영자 배지만(예전에 누구나 '운영자'라고 쓴 댓글과 구분된다). -->
              {#if c.admin}<b class="pill good">{ADMIN_NICKNAME}</b>{:else}<b>{c.nickname}</b>{/if}
              <span class="muted fs-xs">{dateOf(c.createdAt)}</span>
              {#if c.deletable}<button class="icon-btn board-comment-del" onclick={() => removeComment(c)}>삭제</button>{/if}
            </div>
            <p>{c.body}</p>
          </div>
        {:else}
          <p class="muted fs-sm" style="margin:0">첫 댓글을 남겨 보세요.</p>
        {/each}
        {#if !viewer}
          <!-- 댓글 자격을 확인하는 중 -->
        {:else if !viewer.google}
          <div class="comment-gate" data-comment-gate="login">
            <p class="muted">구글로 로그인하면 댓글을 쓸 수 있어요.</p>
            <button class="btn btn-primary" data-act="comment-login" onclick={login}>구글로 로그인</button>
          </div>
        {:else if !viewer.nickname}
          <div class="comment-gate" data-comment-gate="nickname">
            <p class="muted">댓글에 쓸 닉네임을 먼저 정해 주세요. 설정의 계정에서 바꿀 수 있어요.</p>
            <NicknameForm onsaved={(n) => viewer && (viewer.nickname = n)} />
          </div>
        {:else}
          <form class="stack" style="gap:8px" onsubmit={(e) => (e.preventDefault(), void sendComment())}>
            <span class="muted fs-xs"><b>{viewer.nickname}</b> 이름으로 남겨요</span>
            <textarea aria-label="댓글 내용" placeholder="댓글을 남겨 주세요" rows="3" maxlength={COMMENT_BODY_MAX} required bind:value={commentText}></textarea>
            <button class="btn btn-accent" type="submit" data-act="send-comment" disabled={busy}>댓글 달기</button>
          </form>
        {/if}
      </section>
    {:else}
      {#if admin}
        <button class="btn btn-accent" data-act="new-post" onclick={() => startEdit()}>새 글 쓰기</button>
      {/if}
      <LoadState {status} failText="소식을 불러오지 못했어요." retry={load}>
        <ul class="board-list">
          {#each posts as p (p.id)}
            <li>
              <button class="board-row" data-post-row={p.id} onclick={() => open(p.id)}>
                <span class="row" style="gap:6px;flex-wrap:wrap">
                  {@render tags(p)}
                  <b>{p.title}</b>
                </span>
                <span class="muted fs-xs">{postMeta(p)}</span>
              </button>
            </li>
          {:else}
            <li class="muted">아직 올라온 글이 없어요.</li>
          {/each}
        </ul>
        {#if hasMore}<button class="icon-btn" onclick={() => load(true)}>더 보기</button>{/if}
      </LoadState>
    {/if}
  </section>
</div>
