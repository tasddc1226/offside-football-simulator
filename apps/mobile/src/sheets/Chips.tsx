// 능력치·자금 변화 칩 줄(웹 sheets/Chips.svelte). pop이면 칩마다 70ms 간격으로 튀어 오른다(delay: 구간 리포트가 늦춰 준다).
import { View } from 'react-native';
import { fmtMoney } from '@offside/game/engine';
import type { Chip as ChipData } from '@offside/app-core/sheets';
import { Chip } from '../ui/bits';
import { Pop } from './anim';

const val = (c: ChipData) =>
  c.text || (c.money ? (c.d > 0 ? '+' : '') + fmtMoney(c.d) : (c.d > 0 ? '+' : '') + c.d);

export function Chips({
  chips,
  pop = false,
  delay = 0,
}: {
  chips: readonly ChipData[];
  pop?: boolean;
  delay?: number;
}) {
  if (!chips.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {chips.map((c, i) => {
        const chip = <Chip text={`${c.label} ${val(c)}`} dir={c.bad || c.d < 0 ? 'down' : 'up'} />;
        return pop ? (
          <Pop key={i} delay={delay + i * 70}>
            {chip}
          </Pop>
        ) : (
          <View key={i}>{chip}</View>
        );
      })}
    </View>
  );
}
