// T-10-011 게시판 API. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type { BoardListResponse, Comment, CommentInput, Post, PostDetailResponse, PostInput } from '@offside/contracts';
import type { BoardKey } from '@offside/contracts/board-limits';
import { apiFetch } from './client.js';

export type { BoardKey, Comment, Post, PostInput };
export type PostSummary = BoardListResponse['posts'][number];

export const fetchBoardViewer = () => apiFetch<{ admin: boolean }>('/v1/boards/viewer');
export const fetchPosts = (board: BoardKey, before?: string) =>
  apiFetch<BoardListResponse>(`/v1/boards/${board}/posts${before ? `?before=${encodeURIComponent(before)}` : ''}`);
export const fetchPost = (id: string) => apiFetch<PostDetailResponse>(`/v1/boards/posts/${id}`);
export const createPost = (board: BoardKey, input: PostInput) =>
  apiFetch<Post>(`/v1/boards/${board}/posts`, { method: 'POST', body: JSON.stringify(input) });
export const updatePost = (id: string, input: PostInput) => apiFetch<Post>(`/v1/boards/posts/${id}`, { method: 'PUT', body: JSON.stringify(input) });
export const deletePost = (id: string) => apiFetch<undefined>(`/v1/boards/posts/${id}`, { method: 'DELETE' });
export const addComment = (postId: string, input: CommentInput) =>
  apiFetch<Comment>(`/v1/boards/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify(input) });
export const deleteComment = (id: string) => apiFetch<undefined>(`/v1/boards/comments/${id}`, { method: 'DELETE' });
