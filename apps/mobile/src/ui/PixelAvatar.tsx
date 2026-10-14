import { memo } from 'react';
import type { AvatarSpec } from '@offside/game/avatar';
import { ImageAvatar } from './ImageAvatar';

/** Existing call sites keep their dimensions and appearance contract; artwork is PNG. */
export const PixelAvatar = memo(function PixelAvatar({
  spec,
  width,
  portrait = false,
}: {
  spec: AvatarSpec;
  width: number;
  portrait?: boolean;
}) {
  return <ImageAvatar {...{ spec, width, portrait }} />;
});
