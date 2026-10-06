<script lang="ts">
  // T-11-120 도트 선수(24×32칸) 한 명. 장식 그림이라 화면 읽기에서는 숨긴다. 크기는 부르는 쪽 CSS가 정한다(정수배만).
  import { avatarPixels, avatarRects, type AvatarSpec } from '@offside/game/avatar';

  const { spec, class: cls = '' }: { spec: AvatarSpec; class?: string } = $props();
  const rects = $derived(avatarRects(avatarPixels(spec)));
</script>

<svg class="avatar {cls}" viewBox="0 0 24 32" shape-rendering="crispEdges" aria-hidden="true">{#each rects as r, i (i)}<rect x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} fill-opacity={r.opacity} />{/each}</svg>
