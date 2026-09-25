<script lang="ts">
  // T-10-016 댓글 관리: 전체 게시판의 최근 댓글을 보고 지운다. 도배·욕설은 작성자(프로필) 단위로 모아 보고
  // 한 번에 지울 수 있다(감사 로그가 남는다).
  import { onMount } from 'svelte';
  import * as api from '../../api/admin.js';
  import type { AdminComment } from '../../api/admin.js';
  import { deleteComment } from '../../api/boards.js';
  import { toast } from '../helpers.js';

  const BOARD: Record<string, string> = { notice: '공지', release: '릴리즈' };

  let comments = $state<AdminComment[]>([]);
  let hasMore = $state(false);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  /** 한 작성자만 볼 때 그 프로필과 닉네임. */
  let author = $state<{ id: string; nickname: string } | null>(null);
  let busy = $state(false);

  onMount(() => void load());

  async function load(more = false) {
    if (!more) status = 'loading';
    const r = await api.fetchAdminComments({
      ...(more && comments.length ? { before: comments.at(-1)!.createdAt } : {}),
      ...(author ? { profile: author.id } : {}),
    });
    if (!r.ok) {
      if (more) toast(r.error.message);
      else status = 'error';
      return;
    }
    comments = more ? [...comments, ...r.data.comments] : r.data.comments;
    hasMore = r.data.hasMore;
    status = 'ready';
  }
  function filterBy(c: AdminComment | null) {
    author = c && { id: c.profileId, nickname: c.nickname };
    void load();
  }

  async function remove(c: AdminComment) {
    if (!confirm(`이 댓글을 지울까요?\n\n${c.nickname}: ${c.body}`)) return;
    busy = true;
    const r = await deleteComment(c.id);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    comments = comments.filter((x) => x.id !== c.id);
  }
  async function purge(c: AdminComment) {
    if (!confirm(`'${c.nickname}' 작성자(${short(c.profileId)})의 댓글을 모두 지울까요?\n되돌릴 수 없습니다.`)) return;
    busy = true;
    const r = await api.purgeComments(c.profileId);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    toast(`댓글 ${r.data.deleted}개를 지웠어요`);
    comments = comments.filter((x) => x.profileId !== c.profileId);
  }

  const short = (profileId: string) => profileId.slice(4, 12);
  const kst = (iso: string) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' });
</script>

<div class="stack" style="gap:12px" data-admin="comments">
  <div class="row" style="justify-content:space-between">
    <h2 style="margin:0">댓글 관리</h2>
    <button class="icon-btn" onclick={() => load()}>새로고침</button>
  </div>
  {#if author}
    <div class="row author-filter" style="gap:8px">
      <span><b>{author.nickname}</b> <span class="muted">({short(author.id)})</span>의 댓글만 보는 중</span>
      <button class="icon-btn" data-act="clear-filter" onclick={() => filterBy(null)}>전체 보기</button>
    </div>
  {/if}

  {#if status === 'loading'}
    <p class="muted" aria-live="polite">불러오는 중…</p>
  {:else if status === 'error'}
    <div class="stack" style="gap:8px">
      <p class="muted" style="margin:0">댓글을 불러오지 못했어요.</p>
      <button class="icon-btn" style="align-self:flex-start" onclick={() => load()}>다시 시도</button>
    </div>
  {:else}
    <ul class="admin-comments">
      {#each comments as c (c.id)}
        <li data-admin-comment={c.id}>
          <div class="row" style="gap:6px">
            <b>{c.nickname}</b>
            {#if c.admin}<span class="pill good">운영자</span>{/if}
            <span class="muted" style="font-size:12px">{short(c.profileId)} · {kst(c.createdAt)}</span>
          </div>
          <p>{c.body}</p>
          <span class="muted" style="font-size:12px">[{BOARD[c.board] ?? c.board}] {c.postTitle}</span>
          <div class="row" style="gap:6px">
            <button class="icon-btn" data-act="delete-comment" disabled={busy} onclick={() => remove(c)}>삭제</button>
            {#if !author}<button class="icon-btn" data-act="filter-author" onclick={() => filterBy(c)}>이 작성자 댓글</button>{/if}
            {#if !c.admin}<button class="icon-btn" data-act="purge-author" disabled={busy} onclick={() => purge(c)}>작성자 댓글 모두 삭제</button>{/if}
          </div>
        </li>
      {:else}
        <li class="muted">댓글이 없어요.</li>
      {/each}
    </ul>
    {#if hasMore}<button class="icon-btn" onclick={() => load(true)}>더 보기</button>{/if}
  {/if}
</div>

<style>
  .admin-comments { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .admin-comments li { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .admin-comments p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .author-filter { padding: 8px 10px; border-radius: 10px; background: var(--surface-2); justify-content: space-between; }
  .icon-btn { white-space: nowrap; }
</style>
