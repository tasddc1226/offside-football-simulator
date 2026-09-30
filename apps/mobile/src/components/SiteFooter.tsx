// 문의·SNS 링크 푸터(웹 SiteFooter.svelte) — 홈과 설정 화면 맨 아래.
import { Linking, View } from 'react-native';
import { rem } from '../theme/type';
import { Txt } from '../ui/Txt';

function Link({ href, children }: { href: string; children: string }) {
  return (
    <Txt
      accessibilityRole="link"
      tone="accent"
      onPress={() => void Linking.openURL(href)}
      style={{ fontSize: rem(0.75), fontWeight: '600' }}
    >
      {children}
    </Txt>
  );
}

export function SiteFooter() {
  return (
    <View style={{ alignItems: 'center', gap: 4, paddingTop: 8, paddingBottom: 20 }}>
      <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
        문의 <Link href="mailto:contact@offside-lab.com">contact@offside-lab.com</Link>
      </Txt>
      <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
        Instagram <Link href="https://www.instagram.com/offside.lab.kr/">@offside.lab.kr</Link> ·
        Threads <Link href="https://www.threads.com/@offside.lab.kr">@offside.lab.kr</Link>
      </Txt>
    </View>
  );
}
