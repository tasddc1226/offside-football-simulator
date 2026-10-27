// T-11-545 선수 만들기에서 외형(피부 · 머리색 · 머리 모양)을 무료로 고른다(웹 ui/CreateLook.svelte와 같은 규칙).
// 고르지 않은 항목은 커리어 ID로 정하는 기본 모습이고, 미리보기는 만들 커리어의 ID(draftCid)로 그려 시작한 선수와 같은 얼굴이다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { createLookRows, withCreateLook } from '@offside/app-core/createLook';
import { avatarLookText as A } from '@offside/app-core/i18n/ko/avatarLook';
import { createText as L } from '@offside/app-core/i18n/ko/create';
import { draftCid } from '@offside/app-core/state';
import { createAvatarSpec } from '@offside/game/avatar';
import type { CreateLookItem } from '@offside/game/look';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { appState } from '../../store';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Press, Txt } from '../../ui';
import { PixelAvatar } from '../../ui/PixelAvatar';
import { Field } from './parts';

export function CreateLook() {
  const c = useColors();
  const C = useSnapshot(appState).C;
  // 그리는 중에 상태를 바꾸지 않게, 만들 커리어 ID는 화면이 뜬 뒤 정한다.
  useEffect(() => {
    draftCid(appState.C);
  }, [C.cid]);
  const set = (item: CreateLookItem, value: number | null) =>
    (appState.C.look = withCreateLook(appState.C.look, item, value));
  const rows = createLookRows(C.look);

  const chip = (on: boolean, swatch: boolean) => ({
    minHeight: 36,
    minWidth: 36,
    paddingHorizontal: swatch ? 4 : 10,
    borderRadius: RADIUS.pill,
    borderWidth: on ? 2 : 1,
    borderColor: on ? c.accent : c.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });

  return (
    <Field label={L.lookTitle}>
      <View
        testID="create-look"
        style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
      >
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={L.lookPreview}
          style={{ padding: 8, borderRadius: RADIUS.md, backgroundColor: c.pitch }}
        >
          {C.cid ? (
            <PixelAvatar spec={createAvatarSpec(C.cid, C.look)} width={72} />
          ) : (
            <View style={{ width: 72, height: 96 }} />
          )}
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          {rows.map((r) => (
            <View key={r.item} style={{ gap: 6 }} testID={`create-look-${r.item}`}>
              <Txt bold style={{ fontSize: rem(FONT.body2) }}>
                {r.name}
              </Txt>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={r.name}
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
              >
                <Press
                  testID={`create-look-${r.item}-auto`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: r.current === null }}
                  accessibilityLabel={L.lookAutoAria({ item: r.name })}
                  onPress={() => set(r.item, null)}
                  style={chip(r.current === null, false)}
                >
                  <Txt
                    style={{
                      fontSize: rem(FONT.label),
                      fontWeight: r.current === null ? '700' : '400',
                    }}
                  >
                    {L.lookAuto}
                  </Txt>
                </Press>
                {r.options.map((o) => {
                  const on = r.current === o.value;
                  return (
                    <Press
                      key={o.value}
                      testID={`create-look-${r.item}-${o.value}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={o.label ?? A.pickAria({ item: r.name, n: o.value + 1 })}
                      onPress={() => set(r.item, o.value)}
                      style={chip(on, !!o.swatch)}
                    >
                      {o.swatch ? (
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: RADIUS.md,
                            backgroundColor: o.swatch,
                            borderWidth: 1,
                            borderColor: '#00000033',
                          }}
                        />
                      ) : (
                        <Txt style={{ fontSize: rem(FONT.label), fontWeight: on ? '700' : '400' }}>
                          {o.label}
                        </Txt>
                      )}
                    </Press>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </View>
      <Txt v="sm" tone="muted">
        {L.lookNote}
      </Txt>
    </Field>
  );
}
