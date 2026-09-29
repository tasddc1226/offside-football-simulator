// 시즌 업적 탭(웹 team/Team.svelte 의 [data-club-achievements]) — 단계별 묶음을 접었다 펴고, 아직 못 찾은 단계는 LOCKED.
import { useState } from 'react';
import { View } from 'react-native';
import type { ClubAchievementsResponse } from '@offside/app-core/api/team';
import { achDone, achState } from '@offside/app-core/teamOwner';
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

function Group({ g }: { g: ClubAchievementsResponse['groups'][number] }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  if (g.locked)
    return (
      <View
        testID={`ach-group-${g.id}`}
        accessible
        accessibilityLabel={`${g.stage} 잠김, 아직 발견하지 못했어요`}
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
        <Stage>{g.stage}</Stage>
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
        accessibilityLabel={`${g.stage} ${g.title} ${achDone(g.items)} / ${g.items.length}`}
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
          {`${achDone(g.items)} / ${g.items.length}`}
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
  const seasonName = ach?.seasons.find((o) => o.id === ach.season)?.name ?? '';
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
        {ach ? (
          <>
            <Txt
              tone="muted"
              v="sm"
            >{`${seasonName}에 처음 뛰어 은퇴한 내 선수 ${ach.players}명의 기록으로 채워요.`}</Txt>
            {ach.groups.map((g) => (
              <Group key={g.id} g={g} />
            ))}
          </>
        ) : null}
      </LoadState>
    </Card>
  );
}
