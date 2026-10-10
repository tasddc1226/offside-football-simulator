// T-11-191 도트 선수 꾸미기(웹 AvatarLook.svelte와 같다). 커리어 화면의 도트 선수를 누르면 열린다. 항목을 선수 자금으로
// 한 번 사면 이 커리어 동안 언제든 바꿀 수 있고(무료), 은퇴하면 굳는다. 사기 전에는 고른 모양을 미리보기로만 보여 준다.
import { useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { avatarSpec } from '@offside/game/avatar';
import { buyLook, lookEditable, setLook } from '@offside/game/look';
import { fmtMoney } from '@offside/game/player';
import type { GameState, LookItem } from '@offside/game/types';
import { lookPreview, lookRows } from '@offside/app-core/avatarLook';
import { appFormatText as W } from '@offside/app-core/i18n/ko/appFormat';
import { avatarLookText as L } from '@offside/app-core/i18n/ko/avatarLook';
import { TeamDialog } from '../../components/TeamDialog';
import { save, toast } from '../../game/host';
import { appState } from '../../store';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Press, Txt } from '../../ui';
import { PixelAvatar } from '../../ui/PixelAvatar';

export function AvatarLook({ close }: { close: () => void }) {
  const c = useColors();
  const s = useSnapshot(appState).G as GameState;
  const [pending, setPending] = useState<{ item: LookItem; value: number } | null>(null);
  const editable = lookEditable(s);
  const rows = lookRows(s);
  const shown = pending ? lookPreview(s, pending.item, pending.value) : s;

  // s는 읽기 전용 스냅샷이라 스토어의 세이브를 고친다.
  const pick = (item: LookItem, value: number, owned: boolean) => {
    if (!editable) return;
    if (!owned) return setPending({ item, value });
    setPending(null);
    if (setLook(appState.G!, item, value)) save();
  };
  const buy = (name: string) => {
    if (!pending || !buyLook(appState.G!, pending.item, pending.value)) return;
    save();
    toast(L.bought({ item: name }));
    setPending(null);
  };

  return (
    <TeamDialog title={L.title} close={close}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }} testID="avatar-look">
        <View style={{ padding: 8, borderRadius: 14, backgroundColor: c.pitch }}>
          <PixelAvatar spec={avatarSpec(shown)} width={72} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt bold testID="look-money">
            {L.money({ money: W.won({ v: fmtMoney(s.money) }) })}
          </Txt>
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
            {editable ? L.intro : L.locked}
          </Txt>
        </View>
      </View>
      {rows.map((r) => (
        <View
          key={r.item}
          testID={`look-${r.item}`}
          style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 14 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt bold>{r.name}</Txt>
            <Txt
              style={{
                fontSize: rem(0.8),
                fontWeight: '600',
                color: r.owned ? c.good : c.muted,
              }}
            >
              {r.owned ? L.owned : r.costText}
            </Txt>
          </View>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={r.name}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          >
            {r.options.map((o) => {
              const on =
                pending?.item === r.item ? pending.value === o.value : r.current === o.value;
              return (
                <Press
                  key={o.value}
                  testID={`look-${r.item}-${o.value}`}
                  disabled={!editable}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: !editable }}
                  accessibilityLabel={o.label ?? L.pickAria({ item: r.name, n: o.value + 1 })}
                  onPress={() => pick(r.item, o.value, r.owned)}
                  style={{
                    minHeight: 36,
                    minWidth: 36,
                    paddingHorizontal: o.swatch ? 4 : 10,
                    borderRadius: 999,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? c.accent : c.line,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: editable ? 1 : 0.6,
                  }}
                >
                  {o.swatch ? (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: o.swatch,
                        borderWidth: 1,
                        borderColor: '#00000033',
                      }}
                    />
                  ) : (
                    <Txt style={{ fontSize: rem(0.8), fontWeight: on ? '700' : '400' }}>
                      {o.label}
                    </Txt>
                  )}
                </Press>
              );
            })}
          </View>
          {pending?.item === r.item && !r.owned ? (
            s.money >= r.cost ? (
              <Btn kind="primary" block testID="look-buy" onPress={() => buy(r.name)}>
                {L.buy({ item: r.name, cost: r.costText })}
              </Btn>
            ) : (
              <Txt tone="bad" accessibilityRole="alert" style={{ fontWeight: '600' }}>
                {L.short({ cost: r.costText })}
              </Txt>
            )
          ) : null}
        </View>
      ))}
    </TeamDialog>
  );
}
