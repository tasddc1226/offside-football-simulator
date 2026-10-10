import { accountText as L } from '@offside/app-core/i18n/ko/account';
import { Btn, type BtnProps } from './Btn';

/** Keep presentation consistent; each caller owns its login return destination. */
export function GoogleLoginButton({
  onPress,
  testID = 'google-login',
  block = true,
}: Pick<BtnProps, 'onPress' | 'testID' | 'block'>) {
  return (
    <Btn
      kind="primary"
      block={block}
      testID={testID}
      accessibilityLabel={L.loginGoogle}
      onPress={onPress}
    >
      {L.loginGoogle}
    </Btn>
  );
}
