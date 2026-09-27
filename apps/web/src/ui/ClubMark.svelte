<script lang="ts">
  // T-10-064. 기록에 이름으로만 남은 클럽의 엠블럼(clubs.ts clubByName). 못 찾으면(다른 유저가 바꿔 부른 이름·대표팀) 그리지 않는다.
  import { clubByName } from '../game/clubs.js';
  import { clubCustom } from './clubCustom.svelte.js';
  import ClubBadge from './ClubBadge.svelte';
  const { name, size = 16 }: { name: string | null | undefined; size?: number } = $props();
  // 유저가 이름을 바꾸면 CLUBS[].name이 바뀐다 — clubCustom.map을 의존성에 건다.
  const club = $derived((void clubCustom.map, name ? clubByName(name) : null));
</script>

{#if club}<ClubBadge {club} {size} />{/if}
