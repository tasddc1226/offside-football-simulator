// T-11-802 홈 맨 아래(소식 아래 · 푸터 위) '의견 보내기' 한 줄(웹 HomeVoice.svelte). 누르면 시트를 연다 — 여는 것만으로는
// 요청하지 않는다. 눈썹 글자 'Feedback'은 웹과 같이 영어로 둔다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useState } from 'react';
import { View } from 'react-native';
import { voiceText as VT } from '@offside/app-core/i18n/ko/voice';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Press, Txt, useShadow } from '../../ui';
import { VoiceSheet } from '../voice/VoiceSheet';

export function HomeVoice() {
  const c = useColors();
  const shadow = useShadow();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Press
        scale={0.985}
        testID="home-voice"
        accessibilityRole="button"
        accessibilityLabel={`Feedback, ${VT.homeTitle}, ${VT.homeSub}`}
        onPress={() => setOpen(true)}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: c.surface,
            borderRadius: RADIUS.md,
            padding: 14,
          },
          shadow,
        ]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="eyebrow">Feedback</Txt>
          <Txt bold style={{ fontSize: rem(FONT.body1) }}>
            {VT.homeTitle}
          </Txt>
          <Txt v="sm" tone="muted">
            {VT.homeSub}
          </Txt>
        </View>
        <Txt tone="accent" accessible={false}>
          ›
        </Txt>
      </Press>
      {open ? <VoiceSheet screen="home" close={() => setOpen(false)} /> : null}
    </>
  );
}
