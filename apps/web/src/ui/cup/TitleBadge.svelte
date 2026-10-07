<script lang="ts">
  // T-11-150 대표 칭호 알약 — 컵 트로피와 '제3회 챔피언'. 금·은·동 색은 트로피 팔레트를 따른다. 팀 프로필 · 구단주 프로필은
  // 보통(md), 댓글 · 채팅 닉네임 옆은 작게(sm), 줄이 좁은 랭킹은 트로피만(icon — 이름은 툴팁 · 스크린 리더로).
  import { cupTrophy } from '@offside/app-core/cupTrophy';
  import { parseTitle, titleLabel } from '@offside/app-core/ownerTitle';
  import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
  import CupTrophy from './CupTrophy.svelte';

  const { title, size = 'md' }: { title: string; size?: 'md' | 'sm' | 'icon' } = $props();
  const t = $derived(parseTitle(title));
  const label = $derived(titleLabel(title));
  const palette = $derived(t ? cupTrophy(t.stage).palette : null);
</script>

{#if t && label && palette}
  <span class="title-badge" class:small={size === 'sm'} class:icon={size === 'icon'} data-title={title} role="img" aria-label={L.titleAria({ title: label })} title={label} style={`--tb-base:${palette.base};--tb-light:${palette.light}`}>
    <CupTrophy stage={t.stage} edition={t.edition} size={size === 'md' ? 22 : 16} />
    {#if size !== 'icon'}<span aria-hidden="true">{label}</span>{/if}
  </span>
{/if}

<style>
  .title-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px 2px 4px;
    border-radius: 999px;
    font-size: var(--fs-xs, 12px);
    font-weight: 800;
    color: var(--ink);
    white-space: nowrap;
    background: color-mix(in srgb, var(--tb-light) 30%, var(--surface-2));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tb-base) 55%, transparent);
    vertical-align: middle;
  }
  .title-badge.small {
    gap: 2px;
    padding: 0 7px 0 2px;
    font-size: 11px;
  }
  .title-badge.icon {
    padding: 0;
    background: none;
    box-shadow: none;
    flex: none;
  }
</style>
