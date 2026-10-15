import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SvgXml } from 'react-native-svg';
import { avatarImagePlan } from '@offside/game/avatar-image';
import type { AvatarSpec } from '@offside/game/avatar';
import { useComposedAvatar } from './avatarCompose';

/**
 * 선수 그림은 JS에서 한 번 합성한 PNG로 보여 준다(avatarCompose).
 * 그림 계획이 같으면 같은 그림이라 모든 화면이 같은 합성 결과를 쓴다. 구단 엠블럼은 SVG라 그림 위에 얹는다.
 */
export const ImageAvatar = memo(function ImageAvatar({
  spec,
  width,
  portrait = false,
}: {
  spec: AvatarSpec;
  width: number;
  portrait?: boolean;
}) {
  const plan = useMemo(() => avatarImagePlan(spec, portrait), [spec, portrait]);
  const { uri } = useComposedAvatar(plan);
  const unit = width / plan.width;
  const size = { width, height: unit * plan.height };
  const crest = plan.crest;
  return (
    <View style={size} accessible={false} pointerEvents="none">
      {uri ? (
        <>
          <ExpoImage
            source={{ uri }}
            style={size}
            contentFit="fill"
            cachePolicy="memory"
            transition={0}
            accessible={false}
          />
          {crest ? (
            <SvgXml
              xml={crest.svg}
              width={crest.size * unit}
              height={crest.size * unit}
              style={{ position: 'absolute', left: crest.x * unit, top: crest.y * unit }}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
});
