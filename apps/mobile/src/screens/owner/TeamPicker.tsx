// 선수 고르기 시트(웹 team/Team.svelte 의 .tm-sheet) — 고른 자리에 넣을 은퇴 선수. 정렬 셋 · 유스 선수(자리 비우기).
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { DETAIL_LABEL, YOUTH_NAME, YOUTH_OVR, type DetailPos } from '@offside/contracts/owner-team';
import type { TeamPlayer } from '@offside/app-core/api/team';
import {
  PICK_SORTS,
  attrLine,
  pct,
  type PickCandidate,
  type PickSort,
} from '@offside/app-core/teamOwner';
import { POS_LABEL } from '@offside/game/pos-label';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Press, Txt } from '../../ui';
import { Seg, SegBtn } from './TeamParts';

export function TeamPicker({
  slot,
  slotCodes,
  current,
  sort,
  setSort,
  candidates,
  nameOf,
  onAssign,
  onClose,
}: {
  /** 고르는 자리(포메이션 자리 코드). null이면 닫힘. */
  slot: DetailPos | null;
  slotCodes: readonly DetailPos[];
  /** 그 자리에 지금 편성된 선수(빈 자리면 null). */
  current: string | null;
  sort: PickSort;
  setSort: (s: PickSort) => void;
  candidates: PickCandidate[];
  nameOf: (p: TeamPlayer) => string;
  onAssign: (id: string | null) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { motionOK } = useSnapshot(prefs);
  const row = (selected: boolean) =>
    ({
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: c.line,
      minHeight: 52,
      backgroundColor: selected ? c.surface2 : 'transparent',
    }) as const;
  const ovr = {
    minWidth: rem(1.375) * 1.6,
    fontFamily: DISPLAY[700],
    fontSize: rem(1.375),
    textAlign: 'center',
  } as const;
  return (
    <Modal
      visible={slot !== null}
      transparent
      animationType={motionOK ? 'slide' : 'none'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityLabel="닫기"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        />
        {slot ? (
          <View
            accessibilityViewIsModal
            accessibilityLabel={`${DETAIL_LABEL[slot]} 자리 선수 고르기`}
            style={{
              maxHeight: '78%',
              paddingTop: 16,
              paddingHorizontal: 16,
              paddingBottom: 12 + insets.bottom,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              backgroundColor: c.surface,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                paddingBottom: 8,
              }}
            >
              <View>
                <Txt v="eyebrow">{slot}</Txt>
                <Txt v="h2" accessibilityRole="header">
                  {DETAIL_LABEL[slot]}
                </Txt>
              </View>
              <Btn sm onPress={onClose} testID="pick-close">
                닫기
              </Btn>
            </View>
            <View style={{ marginBottom: 6 }}>
              <Seg label="정렬">
                {PICK_SORTS.map(([k, label]) => (
                  <SegBtn
                    key={k}
                    selected={sort === k}
                    onPress={() => setSort(k)}
                    testID={`pick-sort-${k}`}
                  >
                    <Txt style={{ fontWeight: '600' }}>{label}</Txt>
                  </SegBtn>
                ))}
              </Seg>
            </View>
            <ScrollView nestedScrollEnabled>
              <Press
                testID="pick-youth"
                scale={0.985}
                accessibilityState={{ selected: current === null }}
                onPress={() => onAssign(null)}
                style={row(current === null)}
              >
                <Txt tone="accent" style={ovr}>
                  {YOUTH_OVR}
                </Txt>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Txt>{YOUTH_NAME}</Txt>
                  <Txt tone="muted" v="xs">
                    자리를 비워 두면 유스 선수가 뛰어요
                  </Txt>
                </View>
              </Press>
              {candidates.length ? (
                candidates.map((cd) => {
                  const line = attrLine(cd.p);
                  const picked = current === cd.p.careerId;
                  return (
                    <Press
                      key={cd.p.careerId}
                      testID={`pick-${cd.p.careerId}`}
                      scale={0.985}
                      accessibilityState={{ selected: picked }}
                      onPress={() => onAssign(cd.p.careerId)}
                      style={row(picked)}
                    >
                      <Txt tone="accent" style={ovr}>
                        {cd.rating}
                      </Txt>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Txt>{nameOf(cd.p)}</Txt>
                        <Txt tone="muted" v="xs">
                          {`${cd.p.dpos ? DETAIL_LABEL[cd.p.dpos] : POS_LABEL[cd.p.pos]} · 최고 ${cd.p.peak} · 적합 ${pct(cd.fit)}${cd.at >= 0 && slotCodes[cd.at] && current !== cd.p.careerId ? ` · ${slotCodes[cd.at]} 자리에서 바꿈` : ''}`}
                        </Txt>
                        {line ? (
                          <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
                            {line}
                          </Txt>
                        ) : null}
                      </View>
                    </Press>
                  );
                })
              ) : (
                <Txt tone="muted">넣을 수 있는 은퇴 선수가 없어요.</Txt>
              )}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
