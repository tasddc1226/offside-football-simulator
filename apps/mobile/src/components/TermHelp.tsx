// T-11-732 용어 설명 "?" 버튼(웹 TermHelp.svelte). 누르면 아래에서 설명 창이 올라와 그 화면에 나오는 용어만 풀어 준다.
// more가 false면(선수 만들기처럼 화면을 떠나면 안 되는 곳) 용어 사전으로 가는 버튼을 숨긴다.
import { useState } from 'react';
import { View } from 'react-native';
import { TERM_HELP, term, type TermHelpKey } from '@offside/app-core/glossary';
import { glossaryText as L } from '@offside/app-core/i18n/ko/glossary';
import { goGlossary } from '../game/nav';
import { useColors } from '../theme/useColors';
import { Btn } from '../ui/Btn';
import { PopSheet } from '../ui/PopSheet';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';

export function TermHelp({ of, more = true }: { of: TermHelpKey; more?: boolean }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const terms = TERM_HELP[of].map(term);
  return (
    <>
      <Press
        testID={`term-help-${of}`}
        accessibilityRole="button"
        accessibilityLabel={L.help({ term: terms.map((t) => t.term).join(' · ') })}
        hitSlop={12}
        onPress={() => setOpen(true)}
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt tone="muted" style={{ fontSize: 12, lineHeight: 14, fontWeight: '700' }}>
          ?
        </Txt>
      </Press>
      {open ? (
        <PopSheet label={L.sheetLabel} testID={`term-sheet-${of}`} onClose={() => setOpen(false)}>
          <View style={{ gap: 12 }}>
            {terms.map((t) => (
              <View key={t.id} style={{ gap: 4 }}>
                <Txt bold>{t.term}</Txt>
                <Txt v="sm" tone="muted">
                  {t.desc}
                </Txt>
              </View>
            ))}
          </View>
          <View style={{ gap: 8 }}>
            {more ? (
              <Btn
                block
                testID="glossary-all"
                onPress={() => {
                  setOpen(false);
                  goGlossary();
                }}
              >
                {L.more}
              </Btn>
            ) : null}
            <Btn block kind="tonal" testID="term-close" onPress={() => setOpen(false)}>
              {L.close}
            </Btn>
          </View>
        </PopSheet>
      ) : null}
    </>
  );
}
