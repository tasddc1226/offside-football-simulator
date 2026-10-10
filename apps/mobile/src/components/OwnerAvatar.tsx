// 구단주 프로필 이미지(웹 OwnerAvatar.svelte) — 닉네임 첫 글자 동그라미. 구단주 화면 · 댓글 · 채팅이 같은 모양을 쓴다.
// 장식이라 스크린 리더에는 숨긴다.
import { useState } from 'react';
import { ownerAvatarUrl } from '@offside/app-core/api/client';
import { Image, View } from 'react-native';
import { useColors } from '../theme/useColors';
import { DISPLAY } from '../theme/type';
import { Txt } from '../ui/Txt';

export function OwnerAvatar({
  name,
  size = 24,
  avatarId,
}: {
  name: string;
  size?: number;
  avatarId?: string | null | undefined;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const c = useColors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.pitch,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {avatarId && broken !== avatarId ? (
        <Image
          source={{ uri: ownerAvatarUrl(avatarId) }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setBroken(avatarId)}
        />
      ) : (
        <Txt
          style={{
            fontFamily: DISPLAY[700],
            fontSize: size * 0.46,
            lineHeight: size * 0.6,
            color: c.pitchAccent,
          }}
        >
          {name.slice(0, 1)}
        </Txt>
      )}
    </View>
  );
}
