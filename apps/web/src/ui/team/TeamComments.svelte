<script lang="ts">
  // T-11-290 팀 프로필의 스쿼드 댓글 — 소식 글 댓글(Board.svelte)과 같은 규칙·같은 모양. 읽기는 누구나, 쓰기는 구글로 로그인하고
  // 닉네임을 정한 사람만. 남의 댓글은 신고하고 작성자를 차단한다(앱스토어 UGC 정책) — 신고한 댓글·차단한 사람의 댓글은 서버가 빼고 준다.
  // 지우기·신고·차단·차단 해제는 게시판 댓글 API를 그대로 쓴다(서버가 tcm_ 접두사로 팀 댓글 표에 돌린다). 전역 .board-comment 스타일 공유.
  import { onMount } from 'svelte';
  import { ADMIN_NICKNAME, COMMENT_BODY_MAX } from '@offside/contracts/board-limits';
  import type { CommentReportReason } from '@offside/contracts/board-limits';
  import { addTeamComment, fetchTeamComments } from '@offside/app-core/api/team';
  import * as boards from '@offside/app-core/api/boards';
  import type { BoardBlock, BoardViewerResponse, Comment } from '@offside/app-core/api/boards';
  import { REPORT_REASON_LABEL, dateOf } from '@offside/app-core/boardText';
  import { canTranslate } from '@offside/app-core/userTranslate';
  import { getLocale } from '@offside/contracts/i18n';
  import { boardText as LB } from '@offside/app-core/i18n/ko/board';
  import { boardLabelText } from '@offside/app-core/i18n/ko/boardLabel';
  import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';
  import { toast } from '../helpers.js';
  import { createTranslations } from '../translations.svelte.js';
  import LoginButtons from '../LoginButtons.svelte';
  import NicknameForm from '../NicknameForm.svelte';
  import OwnerAvatar from '../OwnerAvatar.svelte';
  import TierBadge from '../TierBadge.svelte';
  import TitleBadge from '../cup/TitleBadge.svelte';

  let { teamId }: { teamId: string } = $props();

  let comments = $state<Comment[] | null>(null);
  let blocks = $state<BoardBlock[]>([]);
  let failed = $state(false);
  /** 댓글 자격(구글 로그인·닉네임). 불러오기 전엔 null(댓글 폼을 그리지 않는다). */
  let viewer = $state<BoardViewerResponse | null>(null);
  let text = $state('');
  let busy = $state(false);
  /** 신고·차단 패널을 펼친 댓글. */
  let reporting = $state<string | null>(null);
  const tr = createTranslations();

  async function load() {
    const r = await fetchTeamComments(teamId);
    if (!r.ok) {
      failed = comments === null;
      return;
    }
    failed = false;
    comments = r.data.comments ?? [];
    blocks = r.data.blocks ?? [];
  }
  onMount(() => {
    void load();
    void boards.fetchBoardViewer().then((r) => (viewer = r.ok ? r.data : { admin: false, google: false, nickname: null }));
  });

  async function send() {
    if (busy || !text.trim()) return;
    busy = true;
    const r = await addTeamComment(teamId, { body: text });
    busy = false;
    if (!r.ok) return toast(r.error.message);
    text = '';
    comments = [...(comments ?? []), r.data];
  }
  async function remove(c: Comment) {
    if (!confirm(LB.deleteCommentConfirm)) return;
    const r = await boards.deleteComment(c.id);
    if (!r.ok) return toast(r.error.message);
    comments = (comments ?? []).filter((x) => x.id !== c.id);
  }
  async function report(c: Comment, reason: CommentReportReason) {
    busy = true;
    const r = await boards.reportComment(c.id, { reason });
    busy = false;
    if (!r.ok) return toast(r.error.message);
    reporting = null;
    comments = (comments ?? []).filter((x) => x.id !== c.id);
    toast(LB.reportedToast);
  }
  async function block(c: Comment) {
    if (!confirm(`${LB.blockTitle({ nick: c.nickname })} ${LB.blockBody}`)) return;
    busy = true;
    const r = await boards.blockAuthor(c.id);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    reporting = null;
    toast(LB.blockedToast({ nick: r.data.nickname }));
    await load();
  }
  async function unblock(b: BoardBlock) {
    const r = await boards.unblock(b.id);
    if (!r.ok) return toast(r.error.message);
    toast(LB.unblockedToast({ nick: b.nickname }));
    await load();
  }
</script>

<section class="card stack board-comments tc" style="gap:10px" aria-label={L.profCommentsTitle} data-team-comments={teamId}>
  <div>
    <div class="eyebrow">Squad talk</div>
    <h2>{L.profCommentsTitle}{#if comments?.length} <small class="muted tc-count">{boardLabelText.commentCount({ n: comments.length })}</small>{/if}</h2>
    <p class="muted fs-sm" style="margin:4px 0 0">{L.profCommentsHint}</p>
  </div>
  {#if failed}
    <p class="muted fs-sm" style="margin:0">{L.profCommentsFail} <button class="icon-btn" onclick={() => void load()}>{LB.more}</button></p>
  {:else if comments}
    {#each comments as c (c.id)}
      <div class="board-comment" data-comment={c.id}>
        <div class="row" style="gap:6px;align-items:center">
          <!-- 관리자 댓글은 닉네임 대신 운영자 배지만. -->
          <OwnerAvatar avatarId={c.avatarId} name={c.nickname} />{#if c.admin}<b class="pill good">{ADMIN_NICKNAME}</b>{:else}<b>{c.nickname}</b>{#if c.tier}<TierBadge tag={c.tier} />{/if}{#if c.title}<TitleBadge title={c.title} size="sm" />{/if}{/if}
          <span class="muted fs-xs">{dateOf(c.createdAt)}</span>
          {#if c.deletable}<button class="icon-btn board-comment-del" onclick={() => remove(c)}>{LB.remove}</button>
          {:else if !c.admin}<button class="icon-btn board-comment-del" aria-expanded={reporting === c.id} data-act="comment-report" onclick={() => (reporting = reporting === c.id ? null : c.id)}>{LB.report}</button>{/if}
        </div>
        <p lang={tr.translated(c.id) ? getLocale() : undefined}>{tr.text(c.id, c.body)}</p>
        {#if canTranslate(c.body)}
          <button class="translate-btn" data-act="translate" disabled={tr.busy(c.id)} onclick={() => void tr.toggle(c.id, c.body)}>{tr.label(c.id)}</button>
        {/if}
        {#if reporting === c.id}
          <div class="report-panel stack" style="gap:8px" data-report-panel>
            <span class="fs-sm">{LB.reportPrompt}</span>
            <div class="row" style="gap:6px;flex-wrap:wrap">
              {#each Object.entries(REPORT_REASON_LABEL) as [reason, label] (reason)}
                <button class="btn btn-sm" data-report-reason={reason} disabled={busy} onclick={() => report(c, reason as CommentReportReason)}>{label}</button>
              {/each}
            </div>
            <div class="row" style="gap:8px;justify-content:space-between;align-items:center">
              <span class="muted fs-xs">{LB.blockHint({ nick: c.nickname })}</span>
              <button class="btn btn-sm" data-act="comment-block" disabled={busy} onclick={() => block(c)}>{LB.blockAuthor}</button>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <p class="empty" data-team-comments-empty>{L.profCommentsEmpty}</p>
    {/each}
    {#if blocks.length}
      <details class="board-blocks" data-board-blocks>
        <summary class="muted fs-sm">{LB.blockedUsers({ n: blocks.length })}</summary>
        <ul>
          {#each blocks as b (b.id)}
            <li class="row" style="justify-content:space-between;align-items:center">
              <span>{b.nickname}</span>
              <button class="icon-btn" data-act="unblock" onclick={() => unblock(b)}>{LB.unblock}</button>
            </li>
          {/each}
        </ul>
      </details>
    {/if}
  {/if}
  {#if !viewer}
    <!-- 댓글 자격을 확인하는 중 -->
  {:else if !viewer.google}
    <div class="comment-gate" data-comment-gate="login">
      <p class="muted">{LB.loginGate}</p>
      <LoginButtons act="comment-login" back={{ team: teamId }} />
    </div>
  {:else if !viewer.nickname}
    <div class="comment-gate" data-comment-gate="nickname">
      <p class="muted">{LB.nicknameGate}</p>
      <NicknameForm onsaved={(n) => viewer && (viewer.nickname = n)} />
    </div>
  {:else}
    <form class="stack" style="gap:8px" onsubmit={(e) => (e.preventDefault(), void send())}>
      <span class="muted fs-xs">{LB.commentAsBefore}<b>{viewer.nickname}</b>{LB.commentAsAfter}<a href="/legal/terms/">{LB.terms}</a>{LB.commentAsEnd}</span>
      <textarea aria-label={LB.commentLabel} placeholder={L.profCommentPlaceholder} rows="3" maxlength={COMMENT_BODY_MAX} required bind:value={text}></textarea>
      <button class="btn btn-accent" type="submit" data-act="send-team-comment" disabled={busy}>{LB.commentSend}</button>
    </form>
  {/if}
</section>

<style>
  .tc h2 {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .tc-count {
    font-size: 0.8125rem;
    font-weight: 500;
  }
</style>
