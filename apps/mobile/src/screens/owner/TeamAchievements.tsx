// 시즌 업적 탭(웹 team/Team.svelte 의 [data-club-achievements]) — 맨 위 시즌 등급 · 점수 · 업적 랭킹 · 다음 등급 막대, 다음 목표,
// 분류(선수·팀·구단주·감독) 탭, 고른 분류의 단계별 묶음은 접었다 펴고(다 채우지 못한 첫 단계만 펼쳐 둔다), 감독 분류는
// 잠금 카드로 예고한다. T-11-028 업적마다 점수가 있고 점수 합이 등급이 된다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { AchCategory } from '@offside/contracts/owner-team';
import type { ClubAchievementsResponse } from '@offside/app-core/api/team';
import { hofStart } from '@offside/app-core/state';
import {
  achDone,
  achGradeView,
  achNear,
  achOpenGroup,
  achPoints,
  achRankText,
  achSections,
  achState,
  achTotal,
} from '@offside/app-core/teamOwner';
import { num } from '@offside/app-core/teamText';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { go } from '../../game/nav';
import { appState } from '../../store';
import { mix } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Card, Press, Txt } from '../../ui';
import { SelectField } from '../settings/parts';
import { AchGradeBadge, TmTitle } from './TeamParts';

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

/** 진행 막대(웹 .tm-bar). sm은 다음 목표 줄 아래 전체 폭(웹 .tm-bar.sm). */
function Bar({ ratio, sm, label }: { ratio: number; sm?: boolean; label?: string }) {
  const c = useColors();
  const pct = Math.round(ratio * 100);
  return (
    <View
      {...(label
        ? {
            accessible: true,
            accessibilityRole: 'progressbar' as const,
            accessibilityLabel: label,
            accessibilityValue: { min: 0, max: 100, now: pct },
          }
        : { importantForAccessibility: 'no-hide-descendants' as const })}
      style={{
        height: sm ? 6 : 8,
        borderRadius: 99,
        overflow: 'hidden',
        backgroundColor: sm ? c.line : c.surface2,
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 99,
          backgroundColor: c.accent,
        }}
      />
    </View>
  );
}

/** 업적 점수(웹 .tm-pts) — 얻은 점수(또는 다음 목표)는 accent, 아직이면 muted. */
function Pts({ children, got }: { children: string; got: boolean }) {
  return (
    <Txt
      tone={got ? 'accent' : 'muted'}
      style={{
        flexShrink: 0,
        fontFamily: DISPLAY[700],
        fontSize: rem(0.8125),
        fontVariant: ['tabular-nums'],
      }}
    >
      {children}
    </Txt>
  );
}

function Group({
  g,
  initialOpen,
  newIds,
}: {
  g: ClubAchievementsResponse['groups'][number];
  initialOpen: boolean;
  newIds: ReadonlySet<string>;
}) {
  const c = useColors();
  const [open, setOpen] = useState(initialOpen);
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
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: c.surface2,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Txt style={{ flexShrink: 1 }}>{i.label}</Txt>
                  {newIds.has(i.id) ? <NewChip /> : null}
                </View>
                <Txt
                  tone={i.done ? 'accent' : 'muted'}
                  style={{ fontSize: rem(0.75), fontWeight: i.done ? '700' : '400' }}
                >
                  {achState(i)}
                </Txt>
              </View>
              <Pts got={i.points > 0}>{achPoints(i)}</Pts>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** T-11-034 지난번 업적 탭을 본 뒤 새로 오른 업적 표시(웹 .tm-ach-new). */
function NewChip() {
  const c = useColors();
  return (
    <View
      testID="ach-new"
      style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: c.bad }}
    >
      <Txt
        style={{
          color: '#fff',
          fontSize: rem(0.625),
          lineHeight: rem(0.625) * 1.3,
          fontWeight: '800',
          letterSpacing: 0.04 * rem(0.625),
        }}
      >
        NEW
      </Txt>
    </View>
  );
}

/** 아직 열리지 않은 감독 분류 예고 카드(웹 .tm-ach-locked.tm-ach-soon). */
function ManagerSoon() {
  const c = useColors();
  return (
    <View
      testID="ach-group-manager"
      accessible
      accessibilityLabel="감독 커리어 업적, 곧 열려요. 감독 시뮬레이션이 열리면 감독으로 거둔 성적도 업적이 돼요."
      style={{
        gap: 6,
        padding: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: c.line,
        borderRadius: 12,
        backgroundColor: c.surface2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Stage>SOON</Stage>
        <Txt bold style={{ flex: 1 }}>
          감독 커리어
        </Txt>
      </View>
      <Txt tone="muted" v="sm">
        감독 시뮬레이션이 열리면 감독으로 거둔 성적도 업적이 돼요. 선수·팀·구단주 업적처럼 시즌마다
        새로 쌓여요.
      </Txt>
    </View>
  );
}

export function TeamAchievements({
  ach,
  status,
  newIds,
  load,
}: {
  ach: ClubAchievementsResponse | null;
  status: LoadStatus;
  /** T-11-034 새로 오른 업적(NEW) — 그 분류·단계를 먼저 펼친다. */
  newIds: ReadonlySet<string>;
  load: (season?: number) => void;
}) {
  const c = useColors();
  const [cat, setCat] = useState<AchCategory>('player');
  useEffect(() => {
    const first = ach?.groups.find((g) => g.items.some((i) => newIds.has(i.id)));
    if (first) setCat(first.category);
  }, [ach, newIds]);
  const seasonName = ach?.seasons.find((o) => o.id === ach.season)?.name ?? '';
  const tot = ach ? achTotal(ach.groups) : null;
  const gv = ach ? achGradeView(ach.score) : null;
  const sections = ach ? achSections(ach.groups) : [];
  const sec = sections.find((x) => x.id === cat) ?? sections[0];
  const near = ach ? achNear(ach.groups) : [];
  const openId = sec
    ? (sec.groups.find((g) => g.items.some((i) => newIds.has(i.id)))?.id ??
      achOpenGroup(sec.groups))
    : null;
  /** 기록실 업적 랭킹 탭을 연다. */
  function openAchRanking() {
    appState.hof = { ...hofStart(), tab: 'ach' };
    go('hof');
  }
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
        {ach && tot && gv && sec ? (
          <>
            <View style={{ gap: 8 }} testID="ach-summary">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AchGradeBadge grade={gv.grade} large />
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 4,
                  }}
                  accessible
                  accessibilityLabel={`시즌 업적 점수 ${num(ach.score)}점`}
                >
                  <Txt
                    numberOfLines={1}
                    tone="accent"
                    style={{ fontFamily: DISPLAY[700], fontSize: rem(2), lineHeight: rem(2) * 1.1 }}
                  >
                    {num(ach.score)}
                  </Txt>
                  <Txt tone="muted">점</Txt>
                </View>
                <Press
                  scale={0.97}
                  testID="ach-ranking"
                  onPress={openAchRanking}
                  accessibilityLabel={`업적 랭킹 ${achRankText(ach.rank, ach.ranked)}`}
                  style={{
                    maxWidth: '50%',
                    minHeight: 44,
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: 1,
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderWidth: 1,
                    borderColor: c.line,
                    borderRadius: 10,
                    backgroundColor: c.surface,
                  }}
                >
                  <Txt tone="muted" style={{ fontSize: rem(0.6875), fontWeight: '600' }}>
                    업적 랭킹
                  </Txt>
                  <Txt style={{ fontSize: rem(0.8125), fontWeight: '700', textAlign: 'right' }}>
                    {achRankText(ach.rank, ach.ranked)}
                  </Txt>
                </Press>
              </View>
              <Bar ratio={gv.ratio} label="다음 등급까지" />
              <Txt tone="muted" v="sm">
                {`${gv.next ? `${gv.next.name}까지 ${num(gv.toNext)}점` : '최고 등급이에요'} · 업적 ${tot.done}/${tot.total} 달성`}
              </Txt>
              <Txt
                tone="muted"
                v="xs"
              >{`${seasonName}에 처음 뛰어 은퇴한 내 선수 ${ach.players}명과 이 시즌 팀·구단 활동으로 채워요. 시즌마다 처음부터 다시 쌓아요.`}</Txt>
            </View>
            {near.length ? (
              <View style={{ gap: 6 }} testID="ach-near">
                <Txt v="eyebrow">다음 목표</Txt>
                {near.map((n) => (
                  <View
                    key={n.item.id}
                    style={{
                      gap: 6,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: c.surface2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Txt bold>{n.item.label}</Txt>
                        <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                          {`${n.group} · ${achState(n.item)}`}
                        </Txt>
                      </View>
                      <Pts got>{`+${num(n.item.worth)}점`}</Pts>
                    </View>
                    <Bar ratio={n.ratio} sm />
                  </View>
                ))}
              </View>
            ) : null}
            <View
              accessibilityRole="tablist"
              accessibilityLabel="업적 분류"
              style={{ flexDirection: 'row', gap: 6 }}
            >
              {sections.map((x) => {
                const on = sec.id === x.id;
                return (
                  <Press
                    key={x.id}
                    scale={0.97}
                    testID={`ach-cat-${x.id}`}
                    onPress={() => setCat(x.id)}
                    accessibilityRole="tab"
                    accessibilityLabel={`${x.name} ${x.locked ? '잠김' : `${num(x.score)}점`}`}
                    accessibilityState={{ selected: on }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      paddingVertical: 6,
                      paddingHorizontal: 4,
                      borderWidth: 1,
                      borderColor: on ? c.accent : c.line,
                      borderRadius: 10,
                      backgroundColor: on ? mix(c.accent, c.surface, 0.12) : c.surface,
                    }}
                  >
                    <Txt
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                      style={{ fontSize: rem(0.875), fontWeight: '700' }}
                    >
                      {x.name.replace(' 업적', '')}
                    </Txt>
                    <Txt num={400} tone={on ? 'accent' : 'muted'} style={{ fontSize: rem(0.75) }}>
                      {x.locked ? '🔒︎' : num(x.score)}
                    </Txt>
                  </Press>
                );
              })}
            </View>
            {sec.locked ? (
              <ManagerSoon />
            ) : (
              sec.groups.map((g) => (
                <Group
                  key={`${ach.season}-${g.id}`}
                  g={g}
                  initialOpen={g.id === openId}
                  newIds={newIds}
                />
              ))
            )}
          </>
        ) : null}
      </LoadState>
    </Card>
  );
}
