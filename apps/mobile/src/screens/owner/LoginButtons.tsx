import { GoogleLoginButton } from '../../ui/GoogleLoginButton';
// 로그인 버튼 묶음 — 웹은 '구글로 로그인' 하나(구단주 화면·내 팀 안내). 앱은 iOS에서 Sign in with Apple이 가능하면
// 'Apple로 로그인'도 함께 둔다(앱 스토어 심사 지침: 다른 소셜 로그인을 두면 애플도 제공).
import { View } from 'react-native';
import type { LoginPlace } from '@offside/app-core/funnelEvents';
import { startAppleLogin, startGoogleLogin, type LoginReturn } from '../../platform/auth';
import { AppleLoginButton, useAppleLogin } from '../../ui/AppleLoginButton';

export function LoginButtons({
  block = true,
  back = null,
  place = 'owner',
  onDone,
}: {
  block?: boolean;
  /** 로그인을 마치고 돌아갈 곳(없으면 구단주 화면). */
  back?: LoginReturn | null;
  /** T-11-781 이 버튼이 있는 곳(로그인 시도 계측). 안 넘기면 구단주 화면의 로그인 카드다. */
  place?: LoginPlace;
  /** 로그인 시도가 끝나면(성공·취소 모두) 부른다. */
  onDone?: () => void;
}) {
  const apple = useAppleLogin();
  return (
    <View style={{ gap: 8, alignSelf: block ? 'stretch' : 'flex-start' }}>
      <GoogleLoginButton
        testID="google-login"
        onPress={() => void startGoogleLogin(back, place).then(onDone)}
        block={block}
      />
      {apple ? (
        <AppleLoginButton
          testID="apple-login"
          onPress={() => void startAppleLogin(back, place).then(onDone)}
        />
      ) : null}
    </View>
  );
}
