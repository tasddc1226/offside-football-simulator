// 내 은퇴 선수 아래 로그인 권유(웹 KeepLoginCard.svelte, T-10-029). 공유는 로그인 없이도 되고(ShareBar, T-10-067), 로그인하면
// 이 기록이 계정에 남아 다른 기기에서도 볼 수 있다. 로그인을 마치면 이 선수 상세로 돌아온다. 로그인했거나 서버에 연결하지
// 못하면 숨긴다. 앱은 iOS에서 Sign in with Apple이 가능하면 'Apple로 로그인'도 함께 둔다.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { isMember } from '@offside/app-core/account';
import { refreshAccount } from '../../game/host';
import { startAppleLogin, startGoogleLogin } from '../../platform/auth';
import { AppleLoginButton, useAppleLogin } from '../../ui/AppleLoginButton';
import { accountCache } from '../../store';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';
import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';

export function KeepLoginCard({ id }: { id: string }) {
  const { value: profile } = useSnapshot(accountCache);
  const apple = useAppleLogin();

  useEffect(() => {
    if (accountCache.value === undefined || accountCache.value === 'error') void refreshAccount();
  }, []);

  if (!profile || profile === 'error' || isMember(profile)) return null;
  return (
    <Card>
      <View>
        <Txt v="eyebrow">Account</Txt>
        <Txt v="h2" accessibilityRole="header">
          {shellMoreText.keepLoginTitle}
        </Txt>
      </View>
      <Txt v="sm" tone="muted">
        {shellMoreText.keepLoginBody}
      </Txt>
      <Btn block testID="share-login" onPress={() => void startGoogleLogin({ career: id })}>
        {shellMoreText.keepLoginGoogle}
      </Btn>
      {apple ? (
        <AppleLoginButton
          testID="share-login-apple"
          onPress={() => void startAppleLogin({ career: id })}
        />
      ) : null}
    </Card>
  );
}
