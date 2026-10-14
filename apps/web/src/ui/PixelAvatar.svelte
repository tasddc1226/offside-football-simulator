<script lang="ts">
  // 선수 그림(원본 PNG 레이어). 장식 그림이라 화면 읽기에서는 숨긴다. 크기는 부르는 쪽 CSS가 정한다.
  // 그림을 못 불러오면 그 자리만 비운다(ImageAvatar). 로컬 개발에서는 ?avatarPng=<시안>으로 새 시안을 대신 볼 수 있다.
  import type { AvatarSpec } from '@offside/game/avatar';
  import OriginalPngAvatar from './OriginalPngAvatar.svelte';
  import ImageAvatar from './ImageAvatar.svelte';
  import { originalAvatarPreview, type OriginalAvatarStyle } from './originalAvatar';

  const { spec, portrait = false, artwork }: { spec: AvatarSpec; portrait?: boolean; artwork?: OriginalAvatarStyle | undefined } = $props();
  // 은퇴 상세 화면의 정장 모습(retiredAvatarSpec)은 개발용 시안으로도 바꾸지 않는다.
  const png = $derived(spec.acc.includes('suit') ? undefined : (artwork ?? originalAvatarPreview()));
  let broken = $state<OriginalAvatarStyle>();
  const showPng = $derived(png && png !== broken);
</script>

{#if showPng && png}
  <OriginalPngAvatar artwork={png} {portrait} onerror={() => broken = png} />
{:else}
  <ImageAvatar {spec} {portrait} />
{/if}
