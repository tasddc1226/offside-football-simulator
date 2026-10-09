// 로그인 버튼 묶음 — 웹은 '구글로 로그인' 하나(구단주 화면·내 팀 안내). 앱은 iOS에서 Sign in with Apple이 가능하면
// 'Apple로 로그인'도 함께 둔다(앱 스토어 심사 지침: 다른 소셜 로그인을 두면 애플도 제공).
import { View } from 'react-native';
import { startAppleLogin, startGoogleLogin, type LoginReturn } from '../../platform/auth';
import { Btn } from '../../ui';
import { AppleLoginButton, useAppleLogin } from '../../ui/AppleLoginButton';
import { accountText as L } from '@offside/app-core/i18n/ko/account';

export function LoginButtons({
  block = true,
  back = null,
  onDone,
}: {
  block?: boolean;
  /** 로그인을 마치고 돌아갈 곳(없으면 구단주 화면). */
  back?: LoginReturn | null;
  /** 로그인 시도가 끝나면(성공·취소 모두) 부른다. */
  onDone?: () => void;
}) {
  const apple = useAppleLogin();
  return (
    <View style={{ gap: 8, alignSelf: block ? 'stretch' : 'flex-start' }}>
      <Btn
        kind="primary"
        block={block}
        testID="google-login"
        accessibilityLabel={L.loginGoogle}
        onPress={() => void startGoogleLogin(back).then(onDone)}
      >
        {L.loginGoogle}
      </Btn>
      {apple ? (
        <AppleLoginButton
          testID="apple-login"
          onPress={() => void startAppleLogin(back).then(onDone)}
        />
      ) : null}
    </View>
  );
}
