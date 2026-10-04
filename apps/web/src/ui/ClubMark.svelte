<script lang="ts">
  // T-10-064. 기록에 남은 클럽의 엠블럼. T-10-066부터 기록이 클럽 id도 남긴다 — id가 있으면 id로 찾고(구단명이
  // 바뀌거나 다른 유저가 바꾼 이름이 다른 클럽의 기본 이름과 같아도 제 클럽), id 없는 옛 기록만 이름으로 찾는다(clubByName).
  // 못 찾으면(모르는 id · 다른 유저가 바꿔 부른 이름 · 대표팀) 그리지 않는다 — 모르는 id를 이름으로 다시 찾으면 엉뚱한 클럽이 붙을 수 있다.
  import { clubById, clubByName } from '@offside/game/clubs';
  import { clubCustom } from './clubCustom.svelte.js';
  import ClubBadge from './ClubBadge.svelte';
  const {
    name,
    id = null,
    size = 16,
  }: { name: string | null | undefined; id?: string | null | undefined; size?: number } = $props();
  // 유저가 이름을 바꾸면 CLUBS[].name이 바뀐다 — clubCustom.map을 의존성에 건다.
  const club = $derived(
    (void clubCustom.map, id ? clubById(id) : name ? clubByName(name) : null),
  );
</script>

{#if club}<ClubBadge {club} {size} />{/if}
