<script lang="ts">
  // T-10-028 댓글 닉네임 정하기 — 소식 화면(첫 댓글 전)과 설정의 계정 카드가 함께 쓴다.
  // 구글 로그인한 프로필만 정할 수 있고, 다른 사람과 겹치면(대소문자 무시) 서버가 거절한다.
  import { COMMENT_NICKNAME_MAX } from '@offside/contracts/board-limits';
  import { putNickname } from '../api/client.js';
  import { accountCache } from './account-state.svelte.js';
  import { toast } from './helpers.js';

  let { current = null, onsaved }: { current?: string | null; onsaved?: (nickname: string) => void } = $props();
  // 처음 값만 받아 오고 이후엔 사용자가 고친다.
  // svelte-ignore state_referenced_locally
  let value = $state(current ?? '');
  let busy = $state(false);

  async function save() {
    if (busy) return;
    busy = true;
    const r = await putNickname(value);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    accountCache.value = r.data;
    accountCache.fetchedAt = Date.now();
    value = r.data.nickname ?? value;
    toast('닉네임을 정했어요');
    onsaved?.(value);
  }
</script>

<form class="nick-form" onsubmit={(e) => (e.preventDefault(), void save())}>
  <input
    type="text"
    aria-label="댓글 닉네임"
    placeholder="댓글 닉네임 (2~{COMMENT_NICKNAME_MAX}자)"
    minlength="2"
    maxlength={COMMENT_NICKNAME_MAX}
    required
    bind:value
  />
  <button class="btn" type="submit" data-act="save-nickname" disabled={busy || value.trim() === (current ?? '')}>
    {current ? '바꾸기' : '정하기'}
  </button>
</form>

