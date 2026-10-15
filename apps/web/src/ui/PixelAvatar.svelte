<script lang="ts">
  // 선수 그림(맨몸 위에 옷·머리·꾸미기 층을 겹쳐 그린다, ImageAvatar). 장식 그림이라 화면 읽기에서는 숨긴다.
  // 크기는 부르는 쪽 CSS가 정한다.
  import type { AvatarSpec } from '@offside/game/avatar';
  import ImageAvatar from './ImageAvatar.svelte';

  const { spec, portrait = false }: { spec: AvatarSpec; portrait?: boolean } = $props();
</script>

<ImageAvatar {spec} {portrait} />
