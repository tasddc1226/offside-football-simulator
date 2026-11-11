// T-11-150 구단주 프로필(웹 ui/owner/OwnerProfile.svelte) — 팀 프로필의 '구단주 프로필'에서 연다(팀 id로). 시즌을 넘어 쌓이는
// 기록을 한곳에: 대표 칭호와 지난 시즌 등급, 지금 팀, 영구결번 · 은퇴 선수 · 최고 팀 순위, 컵 트로피, 시즌별 업적 점수와 팀 순위.
// '← 이전으로'는 화면(Hof)이 아래 막대로 그린다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  fetchOwnerProfileByTeam,
  type OwnerProfile as Owner,
} from '@offside/app-core/api/ownerProfile';
import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
import { gradeEmblem } from '@offside/app-core/gradeEmblem';
import { tierTitle } from '@offside/app-core/ownerTier';
import { seasonLabel } from '@offside/app-core/seasonName';
import { num } from '@offside/app-core/teamText';
import { CupHonors } from '../../../components/CupHonors';
import { LeagueHonors } from '../../../components/LeagueHonors';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { OwnerAvatar } from '../../../components/OwnerAvatar';
import { TeamLogo } from '../../../components/TeamLogo';
import { TitleBadge } from '../../../components/TitleBadge';
import { go, openOwnerHallVisit } from '../../../game/nav';
import { appState } from '../../../store';
import { DISPLAY, rem } from '../../../theme/type';
import { useColors, useIsDark } from '../../../theme/useColors';
import { Card } from '../../../ui/Card';
import { GradeEmblem } from '../../../ui/GradeEmblem';
import { Press } from '../../../ui/Press';
import { Txt } from '../../../ui/Txt';
import { useOnPull } from '../../../ui/refresh';

const rank = (n: number | null) => (n ? L.rank({ n }) : L.none);

export default function OwnerProfile({ teamId }: { teamId: string }) {
  const c = useColors();
  const dark = useIsDark();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [owner, setOwner] = useState<Owner | null>(null);
  const [mine, setMine] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setStatus('loading');
      const r = await fetchOwnerProfileByTeam(teamId);
      if (!r.ok) {
        if (!silent) setStatus('error');
        return;
      }
      setOwner(r.data.owner);
      setMine(r.data.mine);
      setStatus('ready');
    },
    [teamId],
  );
  useEffect(() => void load(), [load]);
  useOnPull(() => load(true));

  const name = owner?.nickname ?? L.noNickname;
  const team = owner?.team;
  // T-11-694 최고 순위를 낸 가장 최근 시즌. 칸 이름에 붙여 아래 시즌 표와 겹치지 않게 한다.
  const best = owner?.stats.bestTeamRank;
  const bestLine = best
    ? [...(owner?.seasons ?? [])].reverse().find((x) => x.teamRank === best)
    : undefined;
  const bestSeason = bestLine ? seasonLabel(bestLine.season, bestLine.name) : null;
  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 14,
  };
  // T-11-694 등급 엠블럼 색을 카드 물들이기 · 아바타 테두리에 쓴다.
  const tier = owner?.tier ? gradeEmblem(owner.tier.tier).palette : null;
  // 밝은 테마에서는 연한 등급 색이 흰 바탕에 묻혀서 진한 색을 쓴다.
  const tierText = tier ? (dark ? tier.light : tier.base) : null;
  return (
    <LoadState status={status} failText={L.loadFail} retry={() => void load()}>
      {owner ? (
        <>
          {/* T-11-694 머리 카드: 등급 색으로 위쪽을 물들이고, 엠블럼은 아바타 배지로, 숫자는 한 줄 띠로, 팀 · 명예관은 한 묶음 목록으로. */}
          <Card gap={16} testID="owner-profile">
            {tier ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: RADIUS.lg,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    width: 280,
                    height: 280,
                    borderRadius: 140,
                    left: -110,
                    top: -150,
                    backgroundColor: `${tier.base}38`,
                  }}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View
                style={
                  tier
                    ? { borderRadius: 999, borderWidth: 2, borderColor: tier.base, padding: 3 }
                    : undefined
                }
              >
                <OwnerAvatar avatarId={owner.avatarId} name={name} size={72} />
                {owner.tier ? (
                  <View
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                    style={{ position: 'absolute', right: -8, bottom: -6 }}
                  >
                    <GradeEmblem id={owner.tier.tier} size={30} />
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 6, alignItems: 'flex-start' }}>
                <Txt v="eyebrow" style={tierText ? { color: tierText } : undefined}>
                  {[
                    'Owner profile',
                    owner.tier ? tierTitle(owner.tier) : null,
                    mine ? L.mine : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Txt>
                <Txt v="h1" accessibilityRole="header">
                  {name}
                </Txt>
                {owner.title ? <TitleBadge title={owner.title} /> : null}
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                paddingVertical: 12,
                borderRadius: RADIUS.md,
                backgroundColor: c.surface2,
              }}
            >
              {(
                [
                  [num(owner.stats.retiredNumbers), L.statRn, null],
                  [num(owner.stats.retired), L.statRetired, null],
                  [rank(owner.stats.bestTeamRank), L.statBestRank, bestSeason],
                ] as const
              ).map(([v, k, sub], i) => (
                <View
                  key={k}
                  accessible
                  accessibilityLabel={[k, v, sub].filter(Boolean).join(' ')}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    alignItems: 'center',
                    gap: 2,
                    paddingHorizontal: 6,
                    ...(i ? { borderLeftWidth: 1, borderLeftColor: c.line } : null),
                  }}
                >
                  <Txt
                    style={{
                      fontFamily: DISPLAY[700],
                      fontSize: rem(1.5),
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {v}
                  </Txt>
                  <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(FONT.caption) }}>
                    {k}
                  </Txt>
                  {sub ? (
                    <Txt
                      numberOfLines={1}
                      style={{ fontSize: rem(0.6875), color: tierText ?? c.muted }}
                    >
                      {sub}
                    </Txt>
                  ) : null}
                </View>
              ))}
            </View>
            <View
              style={{ borderRadius: RADIUS.md, backgroundColor: c.surface2, overflow: 'hidden' }}
            >
              {team ? (
                <Press
                  testID="owner-team"
                  accessibilityRole="button"
                  accessibilityLabel={`${team.name} · ${L.openTeam}`}
                  onPress={() => (appState.hof = { ...appState.hof, team: team.id, owner: false })}
                  style={rowStyle}
                >
                  <TeamLogo name={team.name} logo={team.logo} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt bold numberOfLines={1}>
                      {team.name}
                    </Txt>
                    <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(FONT.caption) }}>
                      {L.teamLine({
                        season: seasonLabel(team.season, team.seasonName),
                        manager: team.manager,
                      })}
                    </Txt>
                  </View>
                  <Txt tone="muted" style={{ fontSize: rem(1.25) }} importantForAccessibility="no">
                    ›
                  </Txt>
                </Press>
              ) : null}
              <Press
                testID={mine ? 'owner-hall' : 'owner-hall-visit'}
                accessibilityRole="button"
                onPress={() => (mine ? go('honors') : openOwnerHallVisit(teamId))}
                style={[rowStyle, team ? { borderTopWidth: 1, borderTopColor: c.line } : null]}
              >
                <Txt bold numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
                  {mine ? L.manage : L.openHall}
                </Txt>
                <Txt tone="muted" style={{ fontSize: rem(1.25) }} importantForAccessibility="no">
                  ›
                </Txt>
              </Press>
            </View>
          </Card>

          <LeagueHonors honors={owner.leagueHonors ?? []} />
          {owner.cupHonors.length ? (
            <CupHonors honors={owner.cupHonors} />
          ) : (
            <Card gap={6}>
              <Txt v="eyebrow">Offside Cup</Txt>
              <Txt tone="muted" style={{ fontSize: rem(FONT.body2) }}>
                {L.trophiesEmpty}
              </Txt>
            </Card>
          )}

          <Card gap={10} testID="owner-seasons">
            <View>
              <Txt v="eyebrow">Seasons</Txt>
              <Txt v="h2" accessibilityRole="header">
                {L.seasons}
              </Txt>
            </View>
            {owner.seasons.length ? (
              <View>
                <View style={{ flexDirection: 'row', paddingBottom: 6 }}>
                  <Txt tone="muted" style={{ flex: 1.2, fontSize: rem(FONT.caption) }}>
                    {L.colSeason}
                  </Txt>
                  <Txt tone="muted" style={{ flex: 1.4, fontSize: rem(FONT.caption) }}>
                    {L.colTeam}
                  </Txt>
                  <Txt
                    tone="muted"
                    style={{ flex: 1, fontSize: rem(FONT.caption), textAlign: 'right' }}
                  >
                    {L.colAch}
                  </Txt>
                  <Txt
                    tone="muted"
                    style={{ width: 52, fontSize: rem(FONT.caption), textAlign: 'right' }}
                  >
                    {L.colRank}
                  </Txt>
                </View>
                {[...owner.seasons].reverse().map((s) => (
                  <View
                    key={s.season}
                    testID={`owner-season-${s.season}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 8,
                      borderTopWidth: 1,
                      borderTopColor: c.line,
                    }}
                  >
                    <Txt numberOfLines={1} style={{ flex: 1.2, fontSize: rem(FONT.body2) }}>
                      {seasonLabel(s.season, s.name)}
                      {s.closed ? '' : ` · ${L.ongoing}`}
                    </Txt>
                    <Txt numberOfLines={1} style={{ flex: 1.4, fontSize: rem(FONT.body2) }}>
                      {s.teamName ?? L.none}
                    </Txt>
                    <Txt num style={{ flex: 1, fontSize: rem(FONT.body2), textAlign: 'right' }}>
                      {s.achScore === null ? L.none : num(s.achScore)}
                    </Txt>
                    <Txt num style={{ width: 52, fontSize: rem(FONT.body2), textAlign: 'right' }}>
                      {rank(s.teamRank)}
                    </Txt>
                  </View>
                ))}
              </View>
            ) : (
              <Txt tone="muted" style={{ fontSize: rem(FONT.body2) }}>
                {L.seasonsEmpty}
              </Txt>
            )}
          </Card>
        </>
      ) : null}
    </LoadState>
  );
}
