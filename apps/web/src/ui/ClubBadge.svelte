<script lang="ts">
  // 클럽 엠블럼(T-10-009). 유저 로고가 있으면 그걸, 없으면 이름 첫 글자 + 클럽 고유색 기본 엠블럼.
  import { logoOf } from '../game/clubs.js';
  import { clubCustom } from './clubCustom.svelte.js';
  const { club, size = 22 }: { club: { id: string; name: string }; size?: number } = $props();
  const logo = $derived(logoOf(club, clubCustom.map));
</script>

{#if logo.img}
  <img class="club-badge" src={logo.img} alt="" width={size} height={size} style:width="{size}px" style:height="{size}px" />
{:else}
  <span class="club-badge" aria-hidden="true" style:width="{size}px" style:height="{size}px" style:background={logo.bg} style:color={logo.fg} style:font-size="{Math.round(size * (logo.text.length > 1 ? 0.36 : 0.5))}px">{logo.text}</span>
{/if}
