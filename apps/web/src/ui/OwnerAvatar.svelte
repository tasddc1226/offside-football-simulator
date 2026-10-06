<script lang="ts">
  // 구단주 프로필 이미지 — 닉네임 첫 글자 동그라미. 구단주 화면 · 댓글 · 채팅이 같은 모양을 쓴다(장식이라 스크린 리더에는 숨긴다).
  let { name, size = 24 }: { name: string; size?: number } = $props();
</script>

<span class="owner-avatar" aria-hidden="true" style="--avatar-size: {size}px">{name.slice(0, 1)}</span>

<style>
  .owner-avatar {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: var(--avatar-size);
    height: var(--avatar-size);
    border-radius: 50%;
    background: var(--pitch);
    color: var(--pitch-accent);
    font-family: var(--display);
    font-size: calc(var(--avatar-size) * 0.46);
    font-weight: 700;
    line-height: 1;
  }
</style>
