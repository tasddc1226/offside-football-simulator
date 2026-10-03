// T-10-092 팀 프로필(웹 team/TeamProfile.svelte, 라이브 랭킹에서 연다) — 시즌 순위 · 감독 · 레이팅 · 선발 그라운드 · 줄 힘 ·
// 좋아요/조회수 · 팀 히스토리 배지. 누구나 본다. 남의 팀을 열면 조회수를 한 번 올린다(내 팀은 세지 않는다).
// 웹의 '← 랭킹'(BackBar)은 화면(Hof)이 아래 고정 막대로 그린다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  fetchTeamProfile,
  likeTeam,
  viewTeam,
  type TeamProfile as TeamProfileData,
} from '@offside/app-core/api/team';
import { teamSeasonClosed } from '@offside/contracts/service-seasons';
import { num as n, recordText } from '@offside/app-core/teamText';
import { localCareerNames } from '@offside/game/season';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { NameReport } from '../../../components/NameReport';
import { TeamLogo } from '../../../components/TeamLogo';
import { TeamLines, TeamPitch } from '../../../components/TeamPitch';
import { toast } from '../../../game/host';
import { DISPLAY, rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Card } from '../../../ui/Card';
import { Press } from '../../../ui/Press';
import { Txt } from '../../../ui/Txt';
import { AutoGrid } from '../../board/parts';

export default function TeamProfile({ id }: { id: string }) {
  const c = useColors();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [team, setTeam] = useState<TeamProfileData | null>(null);
  const [liked, setLiked] = useState(false);
  const [mine, setMine] = useState(false);
  const [liking, setLiking] = useState(false);
  // T-11-029 끝난 시즌의 팀은 좋아요가 굳는다(서버가 409로 거절한다).
  const closed = !!team && teamSeasonClosed(team.season, new Date().toISOString());

  // 내 팀이면 이 기기에 남은 (비공개) 이름으로 보여 준다.
  const localNames = useMemo(() => localCareerNames(), []);

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await fetchTeamProfile(id);
    if (!r.ok) {
      setStatus('error');
      return;
    }
    setLiked(r.data.liked);
    setMine(r.data.mine);
    if (!r.data.mine) {
      setTeam({ ...r.data.team, views: r.data.team.views + 1 });
      void viewTeam(id);
    } else setTeam(r.data.team);
    setStatus('ready');
  }, [id]);
  useEffect(() => void load(), [load]);

  async function toggleLike() {
    if (!team || liking) return;
    setLiking(true);
    const r = await likeTeam(team.id, !liked);
    setLiking(false);
    if (!r.ok) return toast(r.error.message);
    setLiked(r.data.liked);
    setTeam((t) => (t ? { ...t, likes: r.data.likes } : t));
  }

  const cells =
    team?.slots.map((s) => ({
      rating: s.rating,
      name: (mine && s.careerId && localNames.get(s.careerId)) || s.name,
      youth: s.careerId === null,
    })) ?? [];

  return (
    <LoadState status={status} failText="팀을 불러오지 못했어요." retry={() => void load()}>
      {team ? (
        <>
          <Card gap={10}>
            <View testID={`team-profile-${team.id}`}>
              <Txt v="eyebrow">{`Team profile${team.rank ? ` · #${team.rank}` : ''}`}</Txt>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <TeamLogo name={team.name} logo={team.logo} size={48} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt tone="muted" style={{ fontSize: rem(0.8333) }}>
                  {`${team.seasonName}${team.rank ? ` · RANK #${team.rank}` : ''}`}
                </Txt>
                <Txt v="h1" accessibilityRole="header">
                  {team.name}
                </Txt>
                <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                  {'감독 '}
                  <Txt bold style={{ fontSize: rem(0.8125) }}>
                    {team.manager}
                  </Txt>
                  {mine ? ' · 내 팀' : ''}
                </Txt>
              </View>
              <View
                accessible
                accessibilityLabel={`팀 레이팅 ${team.rating}`}
                style={{
                  minWidth: 76,
                  alignItems: 'center',
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  backgroundColor: c.pitch,
                }}
              >
                <Txt
                  style={{
                    fontFamily: DISPLAY[400],
                    fontSize: rem(0.6875),
                    lineHeight: rem(0.6875) * 1.1 * 1.3,
                    letterSpacing: 0.12 * rem(0.6875),
                    color: c.onPitch,
                  }}
                >
                  RATING
                </Txt>
                <Txt
                  style={{
                    fontFamily: DISPLAY[700],
                    fontVariant: ['tabular-nums'],
                    fontSize: rem(1.5),
                    lineHeight: rem(1.5) * 1.1,
                    color: c.pitchAccent,
                  }}
                >
                  {n(team.rating)}
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(
                [
                  ['팀 OVR', String(team.ovr)],
                  ['전적', recordText(team.record)],
                  ['득실', `${team.goals.for} : ${team.goals.against}`],
                ] as const
              ).map(([dt, dd]) => (
                <View
                  key={dt}
                  accessible
                  accessibilityLabel={`${dt} ${dd}`}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 6,
                    paddingHorizontal: 2,
                    borderRadius: 10,
                    backgroundColor: c.surface2,
                  }}
                >
                  <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                    {dt}
                  </Txt>
                  <Txt bold style={{ textAlign: 'center' }}>
                    {dd}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>

          <TeamPitch layout={team.layout} formation={team.formation} cells={cells} />

          <Card gap={12}>
            <TeamLines lines={team.lines} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Press
                testID="team-like"
                accessibilityLabel={`좋아요 ${team.likes}`}
                accessibilityState={{ selected: liked, disabled: mine || liking || closed }}
                disabled={mine || liking || closed}
                onPress={() => void toggleLike()}
                style={{
                  minHeight: 40,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: 999,
                  backgroundColor: c.surface,
                  opacity: mine || liking || closed ? 0.7 : 1,
                }}
              >
                <Txt style={{ fontWeight: '700', color: liked ? c.bad : c.ink }}>
                  {liked ? '♥' : '♡'}
                </Txt>
                <Txt bold>{n(team.likes)}</Txt>
              </Press>
              <Txt tone="muted">
                {'조회수 '}
                <Txt bold tone="muted">
                  {n(team.views)}
                </Txt>
              </Txt>
              <Txt tone="muted" style={{ fontSize: rem(0.75), marginLeft: 'auto' }}>
                {team.formation}
              </Txt>
            </View>
          </Card>

          <Card gap={10}>
            <View testID="team-history">
              <Txt v="eyebrow">Team history</Txt>
              <Txt v="h2" accessibilityRole="header">
                팀 히스토리
              </Txt>
            </View>
            {team.badges.length ? (
              <AutoGrid
                min={140}
                items={team.badges.map((b) => (
                  <View
                    key={b.id}
                    testID={`badge-${b.id}`}
                    style={{
                      gap: 2,
                      paddingVertical: b.id.startsWith('final-') ? 8 : 10,
                      paddingHorizontal: b.id.startsWith('final-') ? 10 : 12,
                      borderRadius: 12,
                      backgroundColor: c.surface2,
                      borderWidth: b.id.startsWith('final-') ? 2 : 0,
                      borderColor: c.pitchAccent,
                      height: '100%',
                    }}
                  >
                    <Txt bold>{b.label}</Txt>
                    <Txt tone="muted" style={{ fontSize: rem(0.8333) }}>
                      {b.desc}
                    </Txt>
                  </View>
                ))}
              />
            ) : (
              <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
                아직 기록이 없어요. 팀 경기와 시즌 순위 배지가 여기에 쌓여요.
              </Txt>
            )}
          </Card>
          {mine ? null : <NameReport kind="team" id={team.id} name={team.name} />}
        </>
      ) : null}
    </LoadState>
  );
}
