// T-11-150 구단주 프로필(웹 ui/owner/OwnerProfile.svelte) — 팀 프로필의 '구단주 프로필'에서 연다(팀 id로). 시즌을 넘어 쌓이는
// 기록을 한곳에: 대표 칭호와 지난 시즌 등급, 지금 팀, 영구결번 · 은퇴 선수 · 최고 팀 순위, 컵 트로피, 시즌별 업적 점수와 팀 순위.
// '← 이전으로'는 화면(Hof)이 아래 막대로 그린다.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  fetchOwnerProfileByTeam,
  type OwnerProfile as Owner,
} from '@offside/app-core/api/ownerProfile';
import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
import { tierTitle } from '@offside/app-core/ownerTier';
import { seasonLabel } from '@offside/app-core/seasonName';
import { num } from '@offside/app-core/teamText';
import { CupHonors } from '../../../components/CupHonors';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { OwnerAvatar } from '../../../components/OwnerAvatar';
import { TeamLogo } from '../../../components/TeamLogo';
import { TitleBadge } from '../../../components/TitleBadge';
import { go } from '../../../game/nav';
import { appState } from '../../../store';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Card } from '../../../ui/Card';
import { GradeEmblem } from '../../../ui/GradeEmblem';
import { Press } from '../../../ui/Press';
import { Txt } from '../../../ui/Txt';
import { useOnPull } from '../../../ui/refresh';
import { Stats } from '../../owner/TeamParts';

const rank = (n: number | null) => (n ? L.rank({ n }) : L.none);

export default function OwnerProfile({ teamId }: { teamId: string }) {
  const c = useColors();
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
  return (
    <LoadState status={status} failText={L.loadFail} retry={() => void load()}>
      {owner ? (
        <>
          <Card gap={12} testID="owner-profile">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <OwnerAvatar name={name} size={56} />
              <View style={{ flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start' }}>
                <Txt v="eyebrow">{`Owner profile${mine ? ` · ${L.mine}` : ''}`}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {owner.tier ? (
                    <View accessible accessibilityLabel={tierTitle(owner.tier)}>
                      <GradeEmblem id={owner.tier.tier} size={26} />
                    </View>
                  ) : null}
                  <Txt v="h1" accessibilityRole="header" style={{ flexShrink: 1 }}>
                    {name}
                  </Txt>
                </View>
                {owner.title ? <TitleBadge title={owner.title} /> : null}
                {owner.tier ? (
                  <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                    {tierTitle(owner.tier)}
                  </Txt>
                ) : null}
              </View>
            </View>
            {team ? (
              <Press
                testID="owner-team"
                accessibilityRole="button"
                onPress={() => (appState.hof = { ...appState.hof, team: team.id, owner: false })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: c.surface2,
                }}
              >
                <TeamLogo name={team.name} logo={team.logo} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt bold numberOfLines={1}>
                    {team.name}
                  </Txt>
                  <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(0.75) }}>
                    {L.teamLine({
                      season: seasonLabel(team.season, team.seasonName),
                      manager: team.manager,
                    })}
                  </Txt>
                </View>
                <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                  {`${L.openTeam} ›`}
                </Txt>
              </Press>
            ) : null}
            <Stats
              small
              items={[
                [L.statRn, num(owner.stats.retiredNumbers)],
                [L.statRetired, num(owner.stats.retired)],
                [L.statBestRank, rank(owner.stats.bestTeamRank)],
              ]}
            />
            {mine ? (
              <Btn sm testID="owner-hall" onPress={() => go('honors')}>
                {L.manage}
              </Btn>
            ) : null}
          </Card>

          {owner.cupHonors.length ? (
            <CupHonors honors={owner.cupHonors} />
          ) : (
            <Card gap={6}>
              <Txt v="eyebrow">Offside Cup</Txt>
              <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
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
                  <Txt tone="muted" style={{ flex: 1.2, fontSize: rem(0.75) }}>
                    {L.colSeason}
                  </Txt>
                  <Txt tone="muted" style={{ flex: 1.4, fontSize: rem(0.75) }}>
                    {L.colTeam}
                  </Txt>
                  <Txt tone="muted" style={{ flex: 1, fontSize: rem(0.75), textAlign: 'right' }}>
                    {L.colAch}
                  </Txt>
                  <Txt tone="muted" style={{ width: 52, fontSize: rem(0.75), textAlign: 'right' }}>
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
                    <Txt numberOfLines={1} style={{ flex: 1.2, fontSize: rem(0.875) }}>
                      {seasonLabel(s.season, s.name)}
                      {s.closed ? '' : ` · ${L.ongoing}`}
                    </Txt>
                    <Txt numberOfLines={1} style={{ flex: 1.4, fontSize: rem(0.875) }}>
                      {s.teamName ?? L.none}
                    </Txt>
                    <Txt num style={{ flex: 1, fontSize: rem(0.875), textAlign: 'right' }}>
                      {s.achScore === null ? L.none : num(s.achScore)}
                    </Txt>
                    <Txt num style={{ width: 52, fontSize: rem(0.875), textAlign: 'right' }}>
                      {rank(s.teamRank)}
                    </Txt>
                  </View>
                ))}
              </View>
            ) : (
              <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
                {L.seasonsEmpty}
              </Txt>
            )}
          </Card>
        </>
      ) : null}
    </LoadState>
  );
}
