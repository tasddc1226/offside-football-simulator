// Sign in with Apple 버튼 — 애플 디자인 지침(로고·문구·색)을 지키도록 시스템 버튼을 그대로 쓴다. iOS에서
// Sign in with Apple을 쓸 수 있을 때만 그린다(useAppleLogin).
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { appleLoginAvailable } from '../platform/auth';
import { useIsDark } from '../theme/useColors';

/** 이 기기에서 Apple 로그인 버튼을 보일지. */
export function useAppleLogin(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    void appleLoginAvailable().then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}

export function AppleLoginButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const dark = useIsDark();
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={
        dark
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={14}
      style={{ height: 50, alignSelf: 'stretch' }}
      onPress={onPress}
      testID={testID}
    />
  );
}
