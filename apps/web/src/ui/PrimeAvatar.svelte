<script lang="ts">
  // T-11-124 명예의 전당 시상대의 전성기 도트 선수. 시상대(HofPodium)가 홈 첫 화면 청크에 있어서, 이 컴포넌트와
  // 그림 모듈(유니폼 표 포함)은 시상대가 뜰 때 따로 불러온다.
  import { primeAvatarSpec } from '@offside/game/avatar';
  import PixelAvatar from './PixelAvatar.svelte';

  const { entry }: { entry: Parameters<typeof primeAvatarSpec>[0] } = $props();
  const spec = $derived(primeAvatarSpec(entry));
</script>

<PixelAvatar {spec} />
