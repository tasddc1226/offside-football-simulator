// T-11-146 댓글·채팅 "번역 보기"(앱, 웹 translations.svelte.ts). 번역을 펼친 글만 기억하고, 서버 호출·세션 메모는
// app-core userTranslate가 한다.
import { useState } from 'react';
import { canTranslate, translateUserText } from '@offside/app-core/userTranslate';
import { translateText as T } from '@offside/app-core/i18n/ko/translate';
import { toast } from '../game/host';
import { rem } from '../theme/type';
import { Press } from './Press';
import { Txt } from './Txt';

export function useTranslations() {
  const [shown, setShown] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  async function toggle(id: string, body: string) {
    if (id in shown)
      return setShown((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== id)));
    if (busy) return;
    setBusy(id);
    const r = await translateUserText(body);
    setBusy(null);
    if (!r.ok) return toast(r.error.message);
    setShown((s) => ({ ...s, [id]: r.data }));
  }
  return {
    text: (id: string, body: string) => shown[id] ?? body,
    /** 다른 글자로 쓴 글에만 버튼을 그린다. */
    button: (id: string, body: string, align: 'flex-start' | 'flex-end' = 'flex-start') =>
      canTranslate(body) ? (
        <Press
          testID="translate"
          accessibilityRole="button"
          disabled={busy === id}
          onPress={() => void toggle(id, body)}
          style={{
            alignSelf: align,
            minHeight: 32,
            justifyContent: 'center',
            paddingHorizontal: 2,
          }}
        >
          <Txt tone="muted" style={{ fontSize: rem(0.75), textDecorationLine: 'underline' }}>
            {id in shown ? T.original : busy === id ? T.working : T.show}
          </Txt>
        </Press>
      ) : null,
  };
}
