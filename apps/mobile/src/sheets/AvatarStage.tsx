import { memo, useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import type { AvatarSpec } from '@offside/game/avatar';
import { MOTIONS, type MotionFrame, type MotionId } from '@offside/game/avatar-motion';
import { canRun } from '@offside/app-core/avatarStage';
import { prefs } from '../store';
import { ImageAvatar } from '../ui/ImageAvatar';

export const AvatarStage = memo(function AvatarStage({
  spec,
  active = true,
  onReady,
  motion = 'run',
  frame = 0,
}: {
  spec: AvatarSpec;
  active?: boolean;
  onReady?: ((ready: boolean) => void) | undefined;
  motion?: MotionId;
  frame?: number;
}) {
  const [ready, setReady] = useState(false);
  const onImageReady = useCallback((value: boolean) => setReady(value), []);
  const still = !canRun(spec, active && prefs.motionOK),
    shown = still ? 'idle' : motion;
  const body: MotionFrame = {
    ...(MOTIONS[shown].frames[still ? 0 : frame] ?? MOTIONS[shown].frames[0]),
  };
  delete body.ball; // ProgressRunner owns the travelling ball on both platforms.
  useEffect(() => onReady?.(!still && ready), [still, ready, onReady]);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: '100%', height: '100%' }}
    >
      <ImageAvatar
        spec={spec}
        width="100%"
        motionFrame={body}
        onReady={onImageReady}
        preloadMotion={!still}
      />
    </View>
  );
});
