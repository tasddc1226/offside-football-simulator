<script lang="ts">
  // 기본 도트 선수와 원본 PNG 미리보기. 장식 그림이라 화면 읽기에서는 숨긴다. 크기는 부르는 쪽 CSS가 정한다.
  import { avatarPixels, avatarRects, avatarPortraitRects, AVATAR_PORTRAIT_H, type AvatarSpec } from '@offside/game/avatar';
  import OriginalPngAvatar from './OriginalPngAvatar.svelte';
  import ImageAvatar from './ImageAvatar.svelte';
  import { originalAvatarPreview, type OriginalAvatarStyle } from './originalAvatar';

  const { spec, portrait = false, artwork }: { spec: AvatarSpec; portrait?: boolean; artwork?: OriginalAvatarStyle | undefined } = $props();
  const png = $derived(artwork ?? originalAvatarPreview());
  let broken = $state<OriginalAvatarStyle>();
  let imageBroken = $state(false);
  const showPng = $derived(png && png !== broken);
  const rects = $derived(!imageBroken || showPng ? [] : portrait ? avatarPortraitRects(spec) : avatarRects(avatarPixels(spec)));
</script>

{#if showPng && png}
  <OriginalPngAvatar artwork={png} {portrait} onerror={() => broken = png} />
{:else if !imageBroken}
  <ImageAvatar {spec} {portrait} onerror={() => imageBroken = true} />
{:else}
<svg class="avatar" viewBox={`0 0 24 ${portrait ? AVATAR_PORTRAIT_H : 32}`} shape-rendering="crispEdges" aria-hidden="true">{#each rects as r, i (i)}<rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} fill-opacity={r.opacity} />{/each}</svg>
{/if}
