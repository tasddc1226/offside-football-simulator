// T-11-733 은퇴 리포트의 '은퇴 유산' 장면(웹 LegacyCredit.svelte) — 종류와 등급만(금액은 보이지 않는다).
import { View } from 'react-native';
import { legacyCredit } from '@offside/app-core/legacy-view';
import { gameLegacyText as L } from '@offside/app-core/i18n/ko/gameLegacy';
import type { LegacyKind } from '@offside/game/types';
import { Reveal } from './credit';
import { FilmPill, FText, H2, Kicker } from './film';

export function LegacyCredit({ legacy }: { legacy: { k: LegacyKind; t: number } }) {
  const c = legacyCredit(legacy);
  return (
    <Reveal testID="credit-legacy">
      <View testID={`legacy-${legacy.k}-${c.t}`} style={{ alignItems: 'center', gap: 10 }}>
        <View style={{ alignItems: 'center' }}>
          <Kicker>Legacy</Kicker>
          <H2>{L.creditTitle}</H2>
        </View>
        <FText tone={c.t >= 3 ? 'gold' : undefined} bold size={1.5} testID="legacy-name">
          {c.kind}
        </FText>
        <FilmPill>{c.tier}</FilmPill>
        <FText tone="muted" size={0.9375} center>
          {c.line}
        </FText>
      </View>
    </Reveal>
  );
}
