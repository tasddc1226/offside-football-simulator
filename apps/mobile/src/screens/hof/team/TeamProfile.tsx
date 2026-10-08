// T-10-092 팀 프로필(웹 team/TeamProfile.svelte, 라이브 랭킹에서 연다) — 시즌 순위 · 감독 · 레이팅 · 선발 그라운드 · 줄 힘 ·
// 좋아요/조회수 · 팀 히스토리 배지. 누구나 본다. 남의 팀을 열면 조회수를 한 번 올린다(내 팀은 세지 않는다).
// 웹의 '← 랭킹'(BackBar)은 화면(Hof)이 아래 고정 막대로 그린다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { requestFriend, type FriendState } from '@offside/app-core/api/friends';
import {
  fetchTeamProfile,
  likeTeam,
  viewTeam,
  type TeamProfile as TeamProfileData,
} from '@offside/app-core/api/team';
import { teamSeasonClosed } from '@offside/contracts/service-seasons';
import { num as n, recordText } from '@offside/app-core/teamText';
import { localCareerNames } from '@offside/game/hof-store';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { NameReport } from '../../../components/NameReport';
import { TeamLogo } from '../../../components/TeamLogo';
import { TeamLines, TeamPitch } from '../../../components/TeamPitch';
import { friendRequestText } from '@offside/app-core/friendText';
import { friendText as LF } from '@offside/app-core/i18n/ko/friend';
import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';
import { cupTrophy, plateText, trophyStage } from '@offside/app-core/cupTrophy';
import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
import { stageLabel } from '../../owner/cupText';
import { toast } from '../../../game/host';
import { DISPLAY, rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Card } from '../../../ui/Card';
import { ChampBadge } from '../../../components/ChampBadge';
import { CupTrophy } from '../../../ui/CupTrophy';
import { Press } from '../../../ui/Press';
import { Txt } from '../../../ui/Txt';
import { useOnPull } from '../../../ui/refresh';
import { AutoGrid } from '../../board/parts';

export default function TeamProfile({ id }: { id: string }) {
  const c = useColors();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [team, setTeam] = useState<TeamProfileData | null>(null);
  const [liked, setLiked] = useState(false);
  const [mine, setMine] = useState(false);
  const [liking, setLiking] = useState(false);
  // T-11-098 친구 신청. null이면 버튼을 그리지 않는다(로그인 전 · 내 팀 · 구버전 응답).
  const [friend, setFriend] = useState<FriendState | null>(null);
  const [requesting, setRequesting] = useState(false);
  // T-11-029 끝난 시즌의 팀은 좋아요가 굳는다(서버가 409로 거절한다).
  const closed = !!team && teamSeasonClosed(team.season, new Date().toISOString());

  // 내 팀이면 이 기기에 남은 (비공개) 이름으로 보여 준다.
  const localNames = useMemo(() => localCareerNames(), []);

  // silent: T-11-111 당겨서 새로고침 — 화면을 비우지 않고 값만 바꾼다. 조회수를 다시 올리지 않고, 실패해도 보던 프로필을 둔다.
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setStatus('loading');
      const r = await fetchTeamProfile(id);
      if (!r.ok) {
        if (!silent) setStatus('error');
        return;
      }
      setLiked(r.data.liked);
      setMine(r.data.mine);
      setFriend(r.data.friend ?? null);
      if (!r.data.mine) {
        setTeam({ ...r.data.team, views: r.data.team.views + (silent ? 0 : 1) });
        if (!silent) void viewTeam(id);
      } else setTeam(r.data.team);
      setStatus('ready');
    },
    [id],
  );
  useEffect(() => void load(), [load]);
  useOnPull(() => (liking || requesting ? undefined : load(true)));

  async function toggleLike() {
    if (!team || liking) return;
    setLiking(true);
    const r = await likeTeam(team.id, !liked);
    setLiking(false);
    if (!r.ok) return toast(r.error.message);
    setLiked(r.data.liked);
    setTeam((t) => (t ? { ...t, likes: r.data.likes } : t));
  }

  async function askFriend() {
    if (!team || requesting) return;
    setRequesting(true);
    const r = await requestFriend({ teamId: team.id });
    setRequesting(false);
    if (!r.ok) return toast(r.error.message);
    setFriend(r.data.state === 'sent' ? 'sent' : 'accepted');
    toast(friendRequestText(r.data));
  }

  // 가장 최근 우승 — 팀 이름 아래 챔피언 배지.
  const champ = team?.cupHonors?.find((h) => h.stage === 'champion');
  const cells =
    team?.slots.map((s) => ({
      rating: s.rating,
      nation: s.nation,
      season: s.season,
      name: (mine && s.careerId && localNames.get(s.careerId)) || s.name,
      youth: s.careerId === null,
    })) ?? [];

  return (
    <LoadState status={status} failText={L.profLoadFail} retry={() => void load()}>
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
                {champ ? (
                  <View style={{ marginTop: 2, marginBottom: 4, alignItems: 'flex-start' }}>
                    <ChampBadge edition={champ.edition} />
                  </View>
                ) : null}
                <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                  {L.profManager}
                  <Txt bold style={{ fontSize: rem(0.8125) }}>
                    {team.manager}
                  </Txt>
                  {mine ? L.profMine : ''}
                </Txt>
              </View>
              <View
                accessible
                accessibilityLabel={L.profRatingAria({ n: team.rating })}
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
                  [L.profStatOvr, String(team.ovr)],
                  [L.profStatRecord, recordText(team.record)],
                  [L.profStatGoals, `${team.goals.for} : ${team.goals.against}`],
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
                accessibilityLabel={L.profLikeAria({ n: team.likes })}
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
                {L.profViews}
                <Txt bold tone="muted">
                  {n(team.views)}
                </Txt>
              </Txt>
              <Txt tone="muted" style={{ fontSize: rem(0.75), marginLeft: 'auto' }}>
                {team.formation}
              </Txt>
            </View>
          </Card>

          {friend && !mine ? (
            <Btn
              block
              kind={friend === 'none' || friend === 'received' ? 'primary' : 'default'}
              testID="team-friend"
              disabled={requesting || friend === 'sent' || friend === 'accepted'}
              onPress={() => void askFriend()}
            >
              {friend === 'none'
                ? LF.reqNone
                : friend === 'sent'
                  ? LF.reqSent
                  : friend === 'received'
                    ? LF.reqReceived
                    : LF.reqAccepted}
            </Btn>
          ) : null}

          <Card gap={10}>
            <View testID="team-history">
              <Txt v="eyebrow">Team history</Txt>
              <Txt v="h2" accessibilityRole="header">
                {L.profHistoryTitle}
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
                      flexGrow: 1,
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
                {L.profHistoryEmpty}
              </Txt>
            )}
          </Card>
          {team.cupHonors?.length ? (
            <Card gap={10} testID="team-cup-honors">
              <View>
                <Txt v="eyebrow">Offside Cup</Txt>
                <Txt v="h2" accessibilityRole="header">
                  {CL.honorsTitle}
                </Txt>
              </View>
              <View style={{ gap: 8 }}>
                {team.cupHonors.map((h) => {
                  const trophy = trophyStage(h.stage);
                  return (
                    <View
                      key={`${h.cupId}`}
                      testID={`cup-honor-${h.cupId}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: trophy ? 8 : 10,
                        paddingHorizontal: trophy ? 10 : 12,
                        borderRadius: 12,
                        backgroundColor: c.surface2,
                        borderWidth: trophy ? 2 : 0,
                        borderColor: trophy ? cupTrophy(trophy).palette.base : c.pitchAccent,
                      }}
                    >
                      {trophy ? (
                        <CupTrophy stage={trophy} name={plateText(h.owner, h.season)} size={56} />
                      ) : null}
                      <View style={{ gap: 2, flexShrink: 1 }}>
                        <Txt bold>
                          {h.stage === 'champion'
                            ? CL.champTitle({ n: h.edition })
                            : CL.honorResult({ edition: h.edition, stage: stageLabel(h.stage) })}
                        </Txt>
                        <Txt tone="muted" style={{ fontSize: rem(0.8333) }}>
                          {CL.honorTeam({ team: h.teamName })}
                        </Txt>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : null}
          {mine ? null : <NameReport kind="team" id={team.id} name={team.name} />}
        </>
      ) : null}
    </LoadState>
  );
}
