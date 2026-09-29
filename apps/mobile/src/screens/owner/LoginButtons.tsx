// 로그인 버튼 묶음 — 웹은 '구글로 로그인' 하나(구단주 화면·내 팀 안내). 앱은 iOS에서 Sign in with Apple이 가능하면
// 'Apple로 로그인'도 함께 둔다(앱 스토어 심사 지침: 다른 소셜 로그인을 두면 애플도 제공).
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { appleLoginAvailable, startAppleLogin, startGoogleLogin } from '../../platform/auth';
import { useIsDark } from '../../theme/useColors';
import { Btn, Txt } from '../../ui';

export function LoginButtons({ block = true }: { block?: boolean }) {
  const dark = useIsDark();
  const [apple, setApple] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    void appleLoginAvailable().then((ok) => alive && setApple(ok));
    return () => {
      alive = false;
    };
  }, []);
  // 애플 로그인 버튼은 애플 디자인 지침대로 검정(다크에서는 흰색) 바탕.
  const bg = dark ? '#ffffff' : '#000000';
  const fg = dark ? '#000000' : '#ffffff';
  return (
    <View style={{ gap: 8, alignSelf: block ? 'stretch' : 'flex-start' }}>
      <Btn
        kind="primary"
        block={block}
        testID="google-login"
        accessibilityLabel="구글로 로그인"
        onPress={() => void startGoogleLogin(null)}
      >
        구글로 로그인
      </Btn>
      {apple ? (
        <Btn
          block={block}
          testID="apple-login"
          accessibilityLabel="Apple로 로그인"
          style={{ backgroundColor: bg, borderColor: bg }}
          onPress={() => void startAppleLogin(null)}
        >
          <Txt style={{ color: fg, fontWeight: '600', textAlign: 'center' }}>Apple로 로그인</Txt>
        </Btn>
      ) : null}
    </View>
  );
}
