<script lang="ts">
  // 영구결번 도트 액자(@offside/game/rnFrame). 은퇴 세리머니·기록실 결번 벽·결번 알림이 같이 쓴다.
  import { RN_FRAME_H, RN_FRAME_W, rnFramePaths } from '@offside/game/rnFrame';

  const { clubId, number, class: cls = '' }: { clubId: string | null | undefined; number: number; class?: string } = $props();
  const paths = $derived(rnFramePaths(clubId, number));
</script>

<svg class="rn-frame {cls}" viewBox="0 0 {RN_FRAME_W} {RN_FRAME_H}" shape-rendering="crispEdges" aria-hidden="true">{#each paths as p (p.fill)}<path d={p.d} fill={p.fill} />{/each}</svg>
