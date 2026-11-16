// T-11-732 용어 사전(웹 Glossary.svelte). 확률 도감의 접는 칸이고, 항목 · 순서는 app-core glossary가 정한다.
import { FONT } from '@offside/app-core/design-tokens';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { glossaryGroups } from '@offside/app-core/glossary';
import { glossaryText as L } from '@offside/app-core/i18n/ko/glossary';
import { rem } from '../../theme/type';
import { Txt } from '../../ui/Txt';
import { Fold, Terms, foldLine } from './Fold';

export function Glossary({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const groups = useMemo(() => glossaryGroups(), []);
  return (
    <Fold title={L.title} open={open} onToggle={() => setOpen((v) => !v)} testID="glossary">
      <Txt tone="muted" style={foldLine}>
        {L.intro}
      </Txt>
      {groups.map((g) => (
        <View key={g.id} testID={`glossary-${g.id}`} style={{ marginTop: 10 }}>
          <Txt bold accessibilityRole="header" style={{ fontSize: rem(FONT.label) }}>
            {g.name}
          </Txt>
          <Terms list={g.terms.map((t) => [t.term, t.desc] as const)} />
        </View>
      ))}
    </Fold>
  );
}
