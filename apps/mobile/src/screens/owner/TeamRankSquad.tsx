// T-11-603 매칭 완료 화면의 스쿼드 · 선발 명단(웹 team/TeamRankSquad.svelte): 상대 · 내 팀을 골라 그라운드 · 명단 · 감독 · 줄 힘을 본다.
// 상대는 매칭되면 바로, 내 팀은 탭을 누를 때 불러온다.
import { FONT } from '@offside/app-core/design-tokens';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { presetLayout, shapeOf } from '@offside/contracts/owner-team';
import { fetchTeamScout, type TeamProfile } from '@offside/app-core/api/team';
import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
import { managerText as MG } from '@offside/app-core/i18n/ko/manager';
import { coachLineBonus, coachSummary } from '@offside/app-core/managerCard';
import { localCareerNames } from '@offside/game/hof-store';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { PlayerPeek, pitchPeekOrigin, type PeekOrigin } from '../../components/PlayerPeek';
import { TeamLines, TeamPitch } from '../../components/TeamPitch';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Txt } from '../../ui';
import { Seg, SegBtn } from './TeamParts';

export function TeamRankSquad({ opponentId, myId }: { opponentId: string; myId: string }) {
  const c = useColors();
  const [side, setSide] = useState<'opp' | 'me'>('opp');
  const id = side === 'opp' ? opponentId : myId;
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [team, setTeam] = useState<TeamProfile | null>(null);
  const localNames = useMemo(() => localCareerNames(), []);
  const want = useRef(id);
  const load = useCallback(async () => {
    want.current = id;
    setStatus('loading');
    const r = await fetchTeamScout(id);
    if (want.current !== id) return;
    if (!r.ok) return setStatus('error');
    setTeam(r.data.team);
    setStatus('ready');
  }, [id]);
  useEffect(() => void load(), [load]);

  const players = useMemo(() => new Map(team?.players?.map((p) => [p.careerId, p]) ?? []), [team]);
  const nameOf = (s: TeamProfile['slots'][number]) =>
    (side === 'me' && s.careerId && localNames.get(s.careerId)) || s.name;
  const cells =
    team?.slots.map((s) => {
      const p = s.careerId ? players.get(s.careerId) : undefined;
      return {
        rating: s.rating,
        nation: s.nation,
        season: s.season,
        name: nameOf(s),
        youth: s.careerId === null,
        ...(p
          ? {
              careerId: p.careerId,
              look: p.look,
              peak: p.peak,
              number: p.number,
              legendScore: p.legendScore,
              specials: p.specials,
              daily: p.daily,
              attrs: p.attrs,
              attrsEstimated: p.attrsEstimated,
              height: p.height,
              weight: p.weight,
              foot: p.foot,
              pos: p.pos,
              type: p.type,
              enhance: p.enhance,
              locked: p.locked,
            }
          : {}),
      };
    }) ?? [];
  const positions = team ? (team.layout ?? presetLayout(team.formation)) : [];
  const pitch = useRef<View>(null);
  const [peek, setPeek] = useState<{ i: number; origin: PeekOrigin } | null>(null);
  function openPeek(i: number) {
    const pos = positions[i];
    const careerId = team?.slots[i]?.careerId;
    if (!pos || !careerId || !players.has(careerId)) return;
    pitch.current?.measureInWindow((px, py, w, h) => {
      if (!w || !h) return;
      setPeek({ i, origin: pitchPeekOrigin(px, py, w, h, pos) });
    });
  }
  const peekPlayer = peek ? players.get(team?.slots[peek.i]?.careerId ?? '') : undefined;

  return (
    <View style={{ alignSelf: 'stretch', gap: 10 }} testID="rank-squad">
      <Seg label={L.squadSideAria}>
        <SegBtn
          center
          selected={side === 'opp'}
          testID="squad-side-opp"
          onPress={() => setSide('opp')}
        >
          <Txt bold>{L.squadOpponent}</Txt>
        </SegBtn>
        <SegBtn
          center
          selected={side === 'me'}
          testID="squad-side-me"
          onPress={() => setSide('me')}
        >
          <Txt bold>{L.queueMe}</Txt>
        </SegBtn>
      </Seg>
      <LoadState status={status} failText={L.squadLoadFail} retry={() => void load()}>
        {team ? (
          <View style={{ gap: 10 }}>
            <Txt tone="muted" v="sm" testID={`squad-team-${team.id}`}>
              {`${team.name} · ${shapeOf(team.formation, team.layout)} · ${L.oppOvr({ n: team.ovr })}`}
            </Txt>
            {/* 카드 안쪽 여백(20)까지 넓혀 팀 프로필과 같은 폭으로 그린다. 좁으면 선수 카드가 더 겹친다. */}
            <View style={{ marginHorizontal: -20 }}>
              <TeamPitch
                layout={team.layout}
                formation={team.formation}
                cells={cells}
                pitchRef={pitch}
                onpick={players.size ? openPeek : undefined}
              />
            </View>
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
            <Txt bold accessibilityRole="header">
              {L.squadLineup}
            </Txt>
            <View testID="squad-lineup">
              {team.slots.map((s, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 7,
                    borderTopWidth: 1,
                    borderTopColor: c.line,
                  }}
                >
                  <Txt bold tone="muted" v="xs" style={{ width: 36 }}>
                    {positions[i]?.slot ?? s.slot}
                  </Txt>
                  <Txt
                    {...(s.careerId === null ? { tone: 'muted' as const } : {})}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    {nameOf(s)}
                  </Txt>
                  <Txt bold style={{ fontVariant: ['tabular-nums'] }}>
                    {s.rating}
                  </Txt>
                </View>
              ))}
            </View>
            {team.coach ? (
              <View testID="squad-coach" style={{ gap: 2 }}>
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
          </View>
        ) : null}
      </LoadState>
    </View>
  );
}
