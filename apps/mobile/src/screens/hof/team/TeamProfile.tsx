// T-10-092 팀 프로필(웹 team/TeamProfile.svelte, 라이브 랭킹에서 연다) — 시즌 순위 · 감독 · 레이팅 · 선발 그라운드 · 줄 힘 ·
// 좋아요/조회수 · 팀 히스토리 배지. 누구나 본다. 남의 팀을 열면 조회수를 한 번 올린다(내 팀은 세지 않는다).
// 웹의 '← 랭킹'(BackBar)은 화면(Hof)이 아래 고정 막대로 그린다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { requestFriend, type FriendState } from '@offside/app-core/api/friends';
import {
  fetchPublicTeamStats,
  fetchTeamProfile,
  likeTeam,
  viewTeam,
  type TeamProfile as TeamProfileData,
  type TeamStatsResponse,
} from '@offside/app-core/api/team';
import { seasonLabel } from '@offside/app-core/seasonName';
import { teamMatchText as LM } from '@offside/app-core/i18n/ko/teamMatch';
import { TeamStats } from '../../owner/TeamStats';
import { teamSeasonClosed } from '@offside/contracts/service-seasons';
import { num as n, recordText } from '@offside/app-core/teamText';
import { localCareerNames } from '@offside/game/hof-store';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { NameReport, NameReports } from '../../../components/NameReport';
import { TeamLogo } from '../../../components/TeamLogo';
import { TeamLines, TeamPitch } from '../../../components/TeamPitch';
import { TeamSynergy } from '../../../components/TeamSynergy';
import { PlayerPeek, pitchPeekOrigin, type PeekOrigin } from '../../../components/PlayerPeek';
import { presetLayout, shapeOf, usesRankLadder } from '@offside/contracts/owner-team';
import { friendRequestText } from '@offside/app-core/friendText';
import { synergyFocus } from '@offside/app-core/teamOwner';
import { coachLineBonus, coachSummary } from '@offside/app-core/managerCard';
import { managerText as MG } from '@offside/app-core/i18n/ko/manager';
import { friendText as LF } from '@offside/app-core/i18n/ko/friend';
import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';
import { ownerProfileText as LO } from '@offside/app-core/i18n/ko/ownerProfile';
import { CupHonors } from '../../../components/CupHonors';
import { TeamComments } from './TeamComments';
import { TitleBadge } from '../../../components/TitleBadge';
import { toast } from '../../../game/host';
import { appState } from '../../../store';
import { DISPLAY, rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Card } from '../../../ui/Card';
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

  // T-11-358 경기 통계 — '경기 통계 보기'를 누를 때만 불러온다.
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsStatus, setStatsStatus] = useState<LoadStatus>('loading');
  const [stats, setStats] = useState<TeamStatsResponse | null>(null);
  const loadStats = useCallback(async () => {
    setStatsStatus('loading');
    const r = await fetchPublicTeamStats(id);
    if (!r.ok) return setStatsStatus('error');
    setStats(r.data);
    setStatsStatus('ready');
  }, [id]);
  function openStats() {
    setStatsOpen(true);
    if (!stats) void loadStats();
  }

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

  // T-11-290 시너지 표에서 고른 항목 — 그라운드에서 그 선수들을 잇는다(내 팀 화면과 같은 동작, 읽기 전용).
  const [synFocus, setSynFocus] = useState<string | null>(null);
  const syn = team?.synergy ? synergyFocus(team.synergy, synFocus) : null;
  // T-11-165 선발 선수 카드 — 그라운드 카드를 누르면 내 팀처럼 확대 카드가 열린다(웹 TeamProfile, 배포 전 응답엔 없다).
  const players = useMemo(() => new Map(team?.players?.map((p) => [p.careerId, p]) ?? []), [team]);
  const cells =
    team?.slots.map((s) => {
      const p = s.careerId ? players.get(s.careerId) : undefined;
      return {
        rating: s.rating,
        nation: s.nation,
        season: s.season,
        name: (mine && s.careerId && localNames.get(s.careerId)) || s.name,
        youth: s.careerId === null,
        ...(p
          ? {
              careerId: p.careerId,
              look: p.look,
              peak: p.peak,
              number: p.number,
              legendScore: p.legendScore,
              attrs: p.attrs,
              attrsEstimated: p.attrsEstimated,
              height: p.height,
              weight: p.weight,
              foot: p.foot,
              pos: p.pos,
              type: p.type,
            }
          : {}),
      };
    }) ?? [];
  const pitch = useRef<View>(null);
  const [peek, setPeek] = useState<{ i: number; origin: PeekOrigin } | null>(null);
  const positions = team ? (team.layout ?? presetLayout(team.formation)) : [];
  function openPeek(i: number) {
    const pos = positions[i];
    const id = team?.slots[i]?.careerId;
    if (!pos || !id || !players.has(id)) return;
    pitch.current?.measureInWindow((px, py, w, h) => {
      if (!w || !h) return;
      setPeek({ i, origin: pitchPeekOrigin(px, py, w, h, pos) });
    });
  }
  const peekPlayer = peek ? players.get(team?.slots[peek.i]?.careerId ?? '') : undefined;

  return (
    <LoadState status={status} failText={L.profLoadFail} retry={() => void load()}>
      {team ? (
        <>
          <Card gap={10}>
            {/* T-11-290 머리 정리(웹 TeamProfile.svelte) — 순위는 한 번만, 포메이션은 정체성 줄로, 감독·구단주·칭호는
                한 줄의 링크(줄 전체가 구단주 프로필). */}
            <View testID={`team-profile-${team.id}`}>
              <Txt v="eyebrow">Team profile</Txt>
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
                <Txt v="h1" accessibilityRole="header">
                  {team.name}
                </Txt>
                <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                  {`${team.seasonName}${team.rank ? ` · RANK #${team.rank}` : ''} · ${shapeOf(team.formation, team.layout)}`}
                </Txt>
              </View>
              <View
                accessible
                accessibilityLabel={
                  usesRankLadder(team.season)
                    ? L.profRpAria({ n: team.rating })
                    : L.profRatingAria({ n: team.rating })
                }
                style={{
                  minWidth: 76,
                  alignItems: 'center',
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: RADIUS.md,
                  backgroundColor: c.pitch,
                }}
              >
                <Txt
                  style={{
                    fontFamily: DISPLAY[400],
                    fontSize: rem(FONT.caption2),
                    lineHeight: rem(FONT.caption2) * 1.1 * 1.3,
                    letterSpacing: 0.12 * rem(0.6875),
                    color: c.onPitch,
                  }}
                >
                  {usesRankLadder(team.season) ? 'RP' : 'RATING'}
                </Txt>
                <Txt
                  style={{
                    fontFamily: DISPLAY[700],
                    fontVariant: ['tabular-nums'],
                    fontSize: rem(FONT.title1),
                    lineHeight: rem(FONT.title1) * 1.1,
                    color: c.pitchAccent,
                  }}
                >
                  {n(team.rating)}
                </Txt>
              </View>
            </View>
            <Press
              testID="owner-profile"
              accessibilityRole="button"
              scale={0.985}
              onPress={() => (appState.hof = { ...appState.hof, owner: true })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                minHeight: 44,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: 'transparent',
                borderRadius: RADIUS.md,
                backgroundColor: c.surface2,
              }}
            >
              <View
                style={{
                  flex: 1,
                  minWidth: 0,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  columnGap: 10,
                  rowGap: 4,
                }}
              >
                {team.ownerNickname && team.ownerNickname === team.manager ? (
                  <Txt tone="muted" style={{ fontSize: rem(FONT.label) }} testID="team-owner">
                    {L.profManagerOwner}
                    <Txt bold style={{ fontSize: rem(FONT.label) }}>
                      {team.manager}
                    </Txt>
                    {mine ? L.profMine : ''}
                  </Txt>
                ) : (
                  <>
                    <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                      {L.profManager}
                      <Txt bold style={{ fontSize: rem(FONT.label) }}>
                        {team.manager}
                      </Txt>
                      {mine ? L.profMine : ''}
                    </Txt>
                    {team.ownerNickname ? (
                      <Txt tone="muted" style={{ fontSize: rem(FONT.label) }} testID="team-owner">
                        {L.profOwner}
                        <Txt bold style={{ fontSize: rem(FONT.label) }}>
                          {team.ownerNickname}
                        </Txt>
                      </Txt>
                    ) : null}
                  </>
                )}
                {team.ownerTitle ? <TitleBadge title={team.ownerTitle} size="sm" /> : null}
              </View>
              <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                {`${LO.open} ›`}
              </Txt>
            </Press>
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
                    borderRadius: RADIUS.sm,
                    backgroundColor: c.surface2,
                  }}
                >
                  <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
                    {dt}
                  </Txt>
                  <Txt bold style={{ textAlign: 'center' }}>
                    {dd}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>

          <TeamPitch
            layout={team.layout}
            formation={team.formation}
            cells={cells}
            pitchRef={pitch}
            onpick={players.size ? openPeek : undefined}
            links={syn?.links ?? []}
            focus={syn?.members ?? null}
            applied={syn?.applied ?? []}
            caption={syn ? syn.caption : null}
          />
          {peek && peekPlayer && positions[peek.i] ? (
            <PlayerPeek
              player={peekPlayer}
              name={cells[peek.i]!.name}
              rating={cells[peek.i]!.rating}
              slot={positions[peek.i]!.slot}
              origin={peek.origin}
              onclose={() => setPeek(null)}
            />
          ) : null}

          <Card gap={12}>
            {/* T-11-335 감독 칸에 앉힌 감독과 줄 힘의 감독 보정(내 팀 화면과 같다). */}
            {team.coach ? (
              <View testID="team-profile-coach" style={{ gap: 2 }}>
                <Txt bold>{MG.profileCoach}</Txt>
                <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                  {coachSummary(team.coach, team.formation, localNames)}
                </Txt>
              </View>
            ) : null}
            <TeamLines
              lines={team.lines}
              coach={
                team.coach
                  ? coachLineBonus(team.coach, team.formation, team.synergy ?? null, team.season)
                  : null
              }
            />
            {team.synergy ? (
              <TeamSynergy
                synergy={team.synergy}
                season={team.season}
                focus={synFocus}
                setFocus={setSynFocus}
              />
            ) : null}
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
                  borderColor: 'transparent',
                  borderRadius: RADIUS.pill,
                  backgroundColor: c.surface2,
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
                      borderRadius: RADIUS.md,
                      backgroundColor: c.surface2,
                      borderWidth: b.id.startsWith('final-') ? 2 : 0,
                      borderColor: c.pitchAccent,
                      flexGrow: 1,
                    }}
                  >
                    <Txt bold>{b.label}</Txt>
                    <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                      {b.desc}
                    </Txt>
                  </View>
                ))}
              />
            ) : (
              <Txt tone="muted" style={{ fontSize: rem(FONT.body2), paddingVertical: 8 }}>
                {L.profHistoryEmpty}
              </Txt>
            )}
          </Card>
          <CupHonors honors={team.cupHonors ?? []} />
          {statsOpen ? (
            <TeamStats
              stats={stats}
              status={statsStatus}
              seasonName={seasonLabel(team.season, team.seasonName)}
              focus={null}
              name={(cid, fallback) => (mine && cid && localNames.get(cid)) || fallback}
              reload={() => void loadStats()}
              back={() => setStatsOpen(false)}
              backText={LM.statsTeamClose}
              embedded
            />
          ) : (
            <Btn testID="team-profile-stats" onPress={openStats}>
              {LM.statsTeamOpen}
            </Btn>
          )}
          {/* T-11-290 스쿼드 댓글 — 프로필을 그린 뒤 따로 불러온다(보는 사람마다 달라 프로필 응답에 섞지 않는다). */}
          <TeamComments teamId={team.id} />
          {mine ? null : (
            <NameReports>
              <NameReport kind="team" id={team.id} name={team.name} />
              {team.ownerNickname ? (
                <NameReport kind="owner" id={team.id} name={team.ownerNickname} />
              ) : null}
            </NameReports>
          )}
        </>
      ) : null}
    </LoadState>
  );
}
