// 시즌 업적 탭(웹 team/Team.svelte 의 [data-club-achievements]) — 맨 위 달성 요약 · 다음 목표, 단계별 묶음은 접었다 펴고
// (다 채우지 못한 첫 단계만 펼쳐 둔다), 아직 못 찾은 단계는 LOCKED 한 줄로 묶는다.
import { useState } from 'react';
import { View } from 'react-native';
import type { ClubAchievementsResponse } from '@offside/app-core/api/team';
import {
  achDone,
  achLockedRange,
  achNear,
  achOpenGroup,
  achState,
  achTotal,
} from '@offside/app-core/teamOwner';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Card, Press, Txt } from '../../ui';
import { SelectField } from '../settings/parts';
import { TmTitle } from './TeamParts';

function Stage({ children }: { children: string }) {
  const c = useColors();
  return (
    <View
      style={{
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 6,
        backgroundColor: c.surface2,
      }}
    >
      <Txt tone="accent" style={{ fontSize: rem(0.6875), fontWeight: '700' }}>
        {children}
      </Txt>
    </View>
  );
}

/** 진행 막대(웹 .tm-bar). */
function Bar({ ratio, sm }: { ratio: number; sm?: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        height: sm ? 6 : 8,
        width: sm ? 64 : undefined,
        borderRadius: 99,
        overflow: 'hidden',
        backgroundColor: sm ? c.line : c.surface2,
      }}
    >
      <View
        style={{
          width: `${Math.round(ratio * 100)}%`,
          height: '100%',
          borderRadius: 99,
          backgroundColor: c.accent,
        }}
      />
    </View>
  );
}

function Group({
  g,
  initialOpen,
  lockedRange,
}: {
  g: ClubAchievementsResponse['groups'][number];
  initialOpen: boolean;
  lockedRange: string | null;
}) {
  const c = useColors();
  const [open, setOpen] = useState(initialOpen);
  if (g.locked)
    return (
      <View
        testID="ach-group-locked"
        accessible
        accessibilityLabel={`${lockedRange ?? g.stage} 잠김, 아직 발견하지 못했어요`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 48,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: c.line,
          borderRadius: 12,
          backgroundColor: c.surface2,
        }}
      >
        <Stage>{lockedRange ?? g.stage}</Stage>
        <Txt tone="muted" bold style={{ flex: 1 }}>
          LOCKED
        </Txt>
        <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
          아직 발견하지 못했어요
        </Txt>
      </View>
    );
  return (
    <View
      testID={`ach-group-${g.id}`}
      style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: c.surface }}
    >
      <Press
        scale={0.99}
        onPress={() => setOpen(!open)}
        accessibilityLabel={`${g.stage} ${g.title} ${achDone(g.items)}/${g.items.length} 달성`}
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 48,
          paddingVertical: 8,
          paddingHorizontal: 12,
        }}
      >
        <Stage>{g.stage}</Stage>
        <Txt bold style={{ flex: 1, minWidth: 0 }}>
          {g.title}
        </Txt>
        <Txt tone="accent" style={{ fontFamily: DISPLAY[700] }}>
          {`${achDone(g.items)}/${g.items.length}`}
        </Txt>
      </Press>
      {open ? (
        <View style={{ gap: 6, paddingHorizontal: 12, paddingBottom: 10 }}>
          {g.items.map((i) => (
            <View
              key={i.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: c.surface2,
              }}
            >
              <Txt style={{ flex: 1, minWidth: 0 }}>{i.label}</Txt>
              <Txt
                tone={i.done ? 'accent' : 'muted'}
                style={{
                  fontSize: rem(0.8125),
                  textAlign: 'right',
                  fontWeight: i.done ? '700' : '400',
                }}
              >
                {achState(i)}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function TeamAchievements({
  ach,
  status,
  load,
}: {
  ach: ClubAchievementsResponse | null;
  status: LoadStatus;
  load: (season?: number) => void;
}) {
  const c = useColors();
  const seasonName = ach?.seasons.find((o) => o.id === ach.season)?.name ?? '';
  const tot = ach ? achTotal(ach.groups) : null;
  const near = ach ? achNear(ach.groups) : [];
  const openId = ach ? achOpenGroup(ach.groups) : null;
  const lockedRange = ach ? achLockedRange(ach.groups) : null;
  const firstLocked = ach?.groups.find((g) => g.locked)?.id;
  return (
    <Card gap={12}>
      <TmTitle
        eyebrow="Season achievements"
        title="시즌 업적"
        right={
          ach && ach.seasons.length > 1 ? (
            <SelectField
              label="시즌"
              testID="ach-season"
              value={ach.season}
              options={ach.seasons.map((o) => ({ value: o.id, label: o.name }))}
              onChange={(v) => load(v)}
              style={{ maxWidth: '45%', minHeight: 40 }}
            />
          ) : null
        }
      />
      <LoadState
        status={status}
        failText="업적을 불러오지 못했어요."
        retry={() => load(ach?.season)}
      >
        {ach && tot ? (
          <>
            <View style={{ gap: 8 }} testID="ach-summary">
              <View
                style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}
                accessible
                accessibilityLabel={`시즌 업적 ${tot.total}개 중 ${tot.done}개 달성`}
              >
                <Txt
                  tone="accent"
                  style={{ fontFamily: DISPLAY[700], fontSize: rem(2), lineHeight: rem(2) * 1.1 }}
                >
                  {tot.done}
                </Txt>
                <Txt tone="muted">{`/ ${tot.total} 달성`}</Txt>
              </View>
              <Bar ratio={tot.total ? tot.done / tot.total : 0} />
              <Txt
                tone="muted"
                v="sm"
              >{`${seasonName}에 처음 뛰어 은퇴한 내 선수 ${ach.players}명의 기록으로 채워요.`}</Txt>
            </View>
            {near.length ? (
              <View style={{ gap: 6 }} testID="ach-near">
                <Txt v="eyebrow">다음 목표</Txt>
                {near.map((n) => (
                  <View
                    key={n.item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: c.surface2,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Txt bold>{n.item.label}</Txt>
                      <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                        {`${n.group} · ${achState(n.item)}`}
                      </Txt>
                    </View>
                    <Bar ratio={n.ratio} sm />
                  </View>
                ))}
              </View>
            ) : null}
            {ach.groups.map((g) =>
              g.locked && g.id !== firstLocked ? null : (
                <Group
                  key={`${ach.season}-${g.id}`}
                  g={g}
                  initialOpen={g.id === openId}
                  lockedRange={lockedRange}
                />
              ),
            )}
          </>
        ) : null}
      </LoadState>
    </Card>
  );
}
