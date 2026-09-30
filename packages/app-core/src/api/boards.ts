// T-10-011 게시판 API. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  BoardBlock,
  BoardListResponse,
  BoardViewerResponse,
  Comment,
  CommentInput,
  CommentReportInput,
  NameReportInput,
  Post,
  PostDetailResponse,
  PostInput,
  PostLikeResponse,
} from '@offside/contracts';
import type { BoardKey } from '@offside/contracts/board-limits';
import { apiFetch, cachedGet, renewSession, type ApiResult } from './client.js';

export type { BoardBlock, BoardKey, BoardViewerResponse, Comment, Post, PostInput };
export type PostSummary = BoardListResponse['posts'][number];

export const fetchBoardViewer = () => cachedGet<BoardViewerResponse>('/v1/boards/viewer', 600_000);
export const fetchPosts = (board: BoardKey, before?: string) =>
  cachedGet<BoardListResponse>(
    `/v1/boards/${board}/posts${before ? `?before=${encodeURIComponent(before)}` : ''}`,
    60_000,
  );
export const fetchPost = (id: string) => apiFetch<PostDetailResponse>(`/v1/boards/posts/${id}`);
export const createPost = (board: BoardKey, input: PostInput) =>
  apiFetch<Post>(`/v1/boards/${board}/posts`, { method: 'POST', body: JSON.stringify(input) });
export const updatePost = (id: string, input: PostInput) =>
  apiFetch<Post>(`/v1/boards/posts/${id}`, { method: 'PUT', body: JSON.stringify(input) });
export const deletePost = (id: string) =>
  apiFetch<undefined>(`/v1/boards/posts/${id}`, { method: 'DELETE' });
export const addComment = (postId: string, input: CommentInput) =>
  apiFetch<Comment>(`/v1/boards/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const deleteComment = (id: string) =>
  apiFetch<undefined>(`/v1/boards/comments/${id}`, { method: 'DELETE' });

/** 아직 프로필이 없거나 세션이 무효인 기기면 새 익명 세션을 받은 뒤 한 번 더 보낸다(좋아요·신고·차단). */
async function withProfile<T>(send: () => Promise<ApiResult<T>>) {
  const r = await send();
  if (!r.ok && r.error.code === 'PROFILE_REQUIRED' && (await renewSession())) return send();
  return r;
}
/** 댓글 신고(앱스토어 UGC 정책). 신고한 댓글은 내 화면에서 빠진다. */
export const reportComment = (id: string, input: CommentReportInput) =>
  withProfile(() =>
    apiFetch<undefined>(`/v1/boards/comments/${id}/report`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
/** 댓글 작성자 차단 — 그 사람의 댓글이 내 화면에서 모두 빠진다. */
export const blockAuthor = (commentId: string) =>
  withProfile(() =>
    apiFetch<BoardBlock>(`/v1/boards/comments/${commentId}/block`, { method: 'POST' }),
  );
export const unblock = (id: string) =>
  apiFetch<undefined>(`/v1/boards/blocks/${id}`, { method: 'DELETE' });
/** 명예의 전당 선수 이름·구단 이름 신고(운영자가 가리거나 기각한다). */
export const reportName = (input: NameReportInput) =>
  withProfile(() =>
    apiFetch<undefined>('/v1/reports/names', { method: 'POST', body: JSON.stringify(input) }),
  );

/** T-10-058 조회수 +1(웹이 기기마다 글 하나에 한 번만 보낸다). */
export const addView = (id: string) =>
  apiFetch<undefined>(`/v1/boards/posts/${id}/views`, { method: 'POST', keepCache: true });
/** T-10-058 좋아요를 누르거나 거둔다. */
export const setLike = (id: string, like: boolean) =>
  withProfile(() =>
    apiFetch<PostLikeResponse>(`/v1/boards/posts/${id}/like`, { method: like ? 'PUT' : 'DELETE' }),
  );
