<script lang="ts">
  // T-11-120 도트 선수(24×32칸) 한 명. 장식 그림이라 화면 읽기에서는 숨긴다. 크기는 부르는 쪽 CSS가 정한다(정수배만).
  import { avatarPixels, avatarRects, avatarPortraitRects, AVATAR_PORTRAIT_H, type AvatarSpec } from '@offside/game/avatar';

  const { spec, portrait = false }: { spec: AvatarSpec; portrait?: boolean } = $props();
  const rects = $derived(portrait ? avatarPortraitRects(spec) : avatarRects(avatarPixels(spec)));
</script>

<svg class="avatar" viewBox={`0 0 24 ${portrait ? AVATAR_PORTRAIT_H : 32}`} shape-rendering="crispEdges" aria-hidden="true">{#each rects as r, i (i)}<rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} fill-opacity={r.opacity} />{/each}</svg>
