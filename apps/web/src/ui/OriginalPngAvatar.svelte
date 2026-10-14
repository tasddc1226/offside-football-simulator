<script lang="ts">
  import { ORIGINAL_AVATARS, originalAvatarFrame, type OriginalAvatarStyle, type OriginalAvatarPose } from './originalAvatar';

  const { artwork, pose = 'standing', portrait = false, onload, onerror }: {
    artwork: OriginalAvatarStyle;
    pose?: OriginalAvatarPose;
    portrait?: boolean;
    onload?: () => void;
    onerror?: () => void;
  } = $props();
  const frame = $derived(originalAvatarFrame(artwork, portrait ? 'standing' : pose, portrait));
  const clipId = $props.id();
</script>

<!-- SVG is only a clipping viewport for the original bitmap, not a vector/dot conversion. -->
<svg class="avatar original-png-avatar" data-avatar-renderer="original-png" data-artwork={artwork} data-pose={portrait ? 'portrait' : pose}
  viewBox="{frame.x} {frame.y} {frame.width} {frame.height}" preserveAspectRatio="xMidYMax meet" aria-hidden="true"
  style="image-rendering:auto; shape-rendering:auto; aspect-ratio:{frame.width}/{frame.height}">
  <defs><clipPath id={clipId}><rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} /></clipPath></defs>
  <image href={ORIGINAL_AVATARS[artwork]} width="1774" height="887" clip-path="url(#{clipId})" {onload} {onerror} />
</svg>

<style>
  svg { display: block; overflow: hidden; }
</style>
