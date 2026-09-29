// 내 은퇴 선수 아래 로그인 권유(웹 KeepLoginCard.svelte, T-10-029). 공유는 로그인 없이도 되고(ShareBar, T-10-067), 로그인하면
// 이 기록이 계정에 남아 다른 기기에서도 볼 수 있다. 로그인을 마치면 이 선수 상세로 돌아온다. 로그인했거나 서버에 연결하지
// 못하면 숨긴다. 앱은 iOS에서 Sign in with Apple이 가능하면 'Apple로 로그인'도 함께 둔다.
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { refreshAccount } from '../../game/host';
import { appleLoginAvailable, startAppleLogin, startGoogleLogin } from '../../platform/auth';
import { accountCache } from '../../store';
import { useIsDark } from '../../theme/useColors';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';

export function KeepLoginCard({ id }: { id: string }) {
  const { value: profile } = useSnapshot(accountCache);
  const dark = useIsDark();
  const [apple, setApple] = useState(false);

  useEffect(() => {
    if (accountCache.value === undefined || accountCache.value === 'error') void refreshAccount();
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    void appleLoginAvailable().then((ok) => alive && setApple(ok));
    return () => {
      alive = false;
    };
  }, []);

  if (!profile || profile === 'error' || profile.linked.google) return null;
  // 애플 로그인 버튼은 애플 디자인 지침대로 검정(다크에서는 흰색) 바탕.
  const bg = dark ? '#ffffff' : '#000000';
  const fg = dark ? '#000000' : '#ffffff';
  return (
    <Card>
      <View>
        <Txt v="eyebrow">Account</Txt>
        <Txt v="h2" accessibilityRole="header">
          로그인하고 기록 지키기
        </Txt>
      </View>
      <Txt v="sm" tone="muted">
        구글로 로그인하면 이 은퇴 기록이 계정에 남아 다른 기기에서도 볼 수 있어요. 공유 링크는
        로그인하지 않아도 아래 버튼으로 만들 수 있어요.
      </Txt>
      <Btn block testID="share-login" onPress={() => void startGoogleLogin({ career: id })}>
        구글로 로그인
      </Btn>
      {apple ? (
        <Btn
          block
          testID="share-login-apple"
          accessibilityLabel="Apple로 로그인"
          style={{ backgroundColor: bg, borderColor: bg }}
          onPress={() => void startAppleLogin({ career: id })}
        >
          <Txt style={{ color: fg, fontWeight: '600', textAlign: 'center' }}>Apple로 로그인</Txt>
        </Btn>
      ) : null}
    </Card>
  );
}
