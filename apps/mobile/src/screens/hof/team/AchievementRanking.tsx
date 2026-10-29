// T-11-028 구단주 랭킹(웹 team/AchievementRanking.svelte) — 기록실 탭. 구단주의 시즌 업적 점수 순(같은 점수면 먼저 닿은 구단주가
// 앞선다). 구단주는 공개 닉네임과 그 시즌 팀 이름으로만 보이고, 팀이 있으면 줄을 눌러 팀 프로필(appState.hof.team)을 연다.
// 서버가 5분마다 새로 센다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { View } from 'react-native';
import {
  ACH_GRADES,
  ACH_GRADE_TOP,
  ACH_RANK_PER_PAGE,
  achGradeAt,
  achTierByRank,
} from '@offside/contracts/owner-team';
import { fetchAchRanking, fetchMyAchRank, type AchRankResponse } from '@offside/app-core/api/team';
import { isMember } from '@offside/app-core/account';
import { canJumpToMyRank, myRankJump } from '@offside/app-core/myRank';
import { hofStart } from '@offside/app-core/state';
import { num as n } from '@offside/app-core/teamText';
import { achGradeName } from '@offside/app-core/teamOwner';
import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';
import { accountCache, appState, prefs } from '../../../store';
import { toast } from '../../../game/host';
import { alpha } from '../../../theme/colors';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Card } from '../../../ui/Card';
import { Skeleton } from '../../../ui/Skeleton';
import { Press } from '../../../ui/Press';
import { centerView, scrollTo } from '../../../ui/scroll';
import { Txt } from '../../../ui/Txt';
import { displaySeasonAt, openTeamSeasons } from '@offside/contracts/service-seasons';
import { RecordsSelect, RECORDS_TOUCH } from '../RecordsControls';
import { AchGradeBadge } from '../../owner/TeamParts';
import { GradeEmblem } from '../../../ui/GradeEmblem';
import { TitleBadge } from '../../../components/TitleBadge';
import { TeamLogo } from '../../../components/TeamLogo';
import { useSeasonNow } from '../../../ui/useSeasonNow';
import { useRefresh } from '../../../ui/refresh';
import { seasonOptions } from '../../../ui/seasonOptions';

export default function AchievementRanking() {
  const c = useColors();
  /** undefined = 지금 시즌(서버가 정한다). */
  const [season, setSeason] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AchRankResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [gradesOpen, setGradesOpen] = useState(false);
  const now = useSeasonNow();
  /** 다시 받을 기준 — 고른 시즌, 아니면 지금 시즌(띄운 채 개막을 넘기면 바뀐다). */
  const shownSeason = season ?? displaySeasonAt(now);
  // T-11-489 등급 기준 안내: 상위 비율 시즌이면 '상위 N%'.
  const byRank = achTierByRank(data?.season ?? shownSeason);

  // T-11-441 '내 순위로'(팀 랭킹과 같다). 내 줄은 시즌과 순위로 강조한다.
  const acct = useSnapshot(accountCache).value;
  // 로그인 상태를 아직 묻지 않았으면 버튼을 두고, 누를 때 서버가 판정한다(따로 묻지 않는다).
  const member = acct === undefined || (!!acct && acct !== 'error' && isMember(acct));
  const [mine, setMine] = useState<{ season: number; rank: number } | null>(null);
  const [jumping, setJumping] = useState(false);
  const preset = useRef<AchRankResponse | null>(null);
  const mineRow = useRef<View>(null);
  const scrollMine = useRef(false);
  const [jumpTick, setJumpTick] = useState(0);
  useEffect(() => {
    if (!scrollMine.current) return;
    const frame = requestAnimationFrame(() => {
      if (!scrollMine.current || !mineRow.current) return;
      scrollMine.current = false;
      centerView(mineRow.current, prefs.motionOK);
    });
    return () => cancelAnimationFrame(frame);
  }, [jumpTick, data]);
  async function jumpToMe() {
    setJumping(true);
    const j = myRankJump(await fetchMyAchRank(season), 'ach');
    setJumping(false);
    if (!j.ok) return toast(j.message);
    setMine({ season: j.data.season, rank: j.rank });
    if (j.data.page !== page) preset.current = j.data;
    scrollMine.current = true;
    setJumpTick((n) => n + 1);
    setData(j.data);
    setPage(j.data.page);
  }

  const { tick, track, pulled } = useRefresh();
  useEffect(() => {
    const p0 = preset.current;
    preset.current = null;
    if (p0 && p0.page === page && !pulled) return;
    setFailed(false);
    if (!pulled) setLoading(true);
    let live = true; // 더 늦게 고른 조건의 응답만 쓴다.
    void track(fetchAchRanking(season, page)).then((r) => {
      if (!live) return;
      setLoading(false);
      if (r.ok) setData(r.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [season, page, shownSeason, tick, track]);

  const pages = data ? Math.max(1, Math.ceil(data.total / ACH_RANK_PER_PAGE)) : 1;
  function goPage(p: number) {
    setPage(p);
    scrollTo(0);
  }
  function openTeam(id: string) {
    appState.hof = { ...hofStart(), tab: 'teams', team: id };
    scrollTo(0);
  }

  const empty = (text: string) => (
    <Txt tone="muted" style={{ fontSize: rem(FONT.body2), paddingVertical: 8 }}>
      {text}
    </Txt>
  );
  return (
    <Card gap={0} style={{ paddingHorizontal: 12, paddingVertical: 16 }}>
      <View
        testID="ach-ranking-screen"
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}
      >
        <RecordsSelect
          label={L.seasonLabel}
          testID="ach-rank-season-select"
          value={season ?? data?.season ?? displaySeasonAt(now)}
          options={seasonOptions(data?.seasons ?? openTeamSeasons(now), now)}
          onChange={(id) => {
            setSeason(id);
            setPage(1);
          }}
        />
        <Txt tone="muted" style={{ flex: 1, textAlign: 'right', fontSize: 12, paddingBottom: 10 }}>
          {L.ownersApp({ n: n(data?.total ?? 0) })}
        </Txt>
      </View>
      {canJumpToMyRank(member) ? (
        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          <Btn sm testID="ach-rank-my" disabled={jumping} onPress={() => void jumpToMe()}>
            {L.myRank}
          </Btn>
        </View>
      ) : null}
      {failed ? (
        empty(L.rankFail)
      ) : loading || !data ? (
        <Skeleton rows={6} />
      ) : data.items.length ? (
        <>
          <View
            accessibilityElementsHidden
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: c.line,
            }}
          >
            <Txt tone="muted" center style={{ width: 24, fontSize: 12 }}>
              {L.hdrRankApp}
            </Txt>
            <Txt tone="muted" style={{ flex: 1, paddingLeft: 8, fontSize: 12 }}>
              {L.hdrOwner}
            </Txt>
            <Txt tone="muted" center style={{ width: 44, fontSize: 12 }}>
              {L.hdrGrade}
            </Txt>
            <Txt tone="muted" style={{ width: 58, fontSize: 12, textAlign: 'right' }}>
              {L.hdrScore}
            </Txt>
          </View>
          {data.items.map((r) => {
            const team = r.team;
            // T-11-489 시즌 2부터 등급은 랭킹 상위 비율.
            const grade = achGradeAt({
              season: data.season,
              score: r.score,
              rank: r.rank,
              ranked: data.total,
            }).grade;
            const isMine = !!mine && mine.season === data.season && mine.rank === r.rank;
            const row = (
              <View
                ref={isMine ? mineRow : undefined}
                onLayout={
                  isMine
                    ? () => {
                        if (!scrollMine.current) return;
                        scrollMine.current = false;
                        centerView(mineRow.current, prefs.motionOK);
                      }
                    : undefined
                }
                accessibilityState={isMine ? { selected: true } : undefined}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: c.line,
                  ...(isMine
                    ? { backgroundColor: alpha(c.accent, 0.12), borderRadius: RADIUS.sm }
                    : null),
                }}
              >
                <Txt num tone="muted" center style={{ width: 24, fontSize: 15 }}>
                  {r.rank}
                </Txt>
                {team ? <TeamLogo logo={team.logo} name={team.name} size={24} decorative /> : null}
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Txt bold numberOfLines={1} style={{ flexShrink: 1, fontSize: 14 }}>
                      {r.nickname ?? L.anonOwner}
                    </Txt>
                    {r.title ? <TitleBadge title={r.title} size="icon" /> : null}
                  </View>
                  {team ? (
                    <Txt tone="muted" numberOfLines={1} style={{ fontSize: 12 }}>
                      {team.name}
                    </Txt>
                  ) : null}
                  <Txt tone="muted" numberOfLines={1} style={{ fontSize: 12 }}>
                    {L.rowStatsApp({ done: n(r.done), players: n(r.players) })}
                  </Txt>
                </View>
                <View
                  accessible
                  accessibilityLabel={L.gradeAria({ name: achGradeName(grade) })}
                  style={{ width: 36, alignItems: 'center' }}
                >
                  <GradeEmblem id={grade.id} size={32} />
                </View>
                <Txt num bold style={{ width: 50, textAlign: 'right', fontSize: 19 }}>
                  {n(r.score)}
                </Txt>
              </View>
            );
            return team ? (
              <Press
                key={r.rank}
                scale={1}
                testID={`ach-rank-${r.rank}`}
                onPress={() => openTeam(team.id)}
                accessibilityLabel={L.rowAriaApp({
                  rank: r.rank,
                  name: r.nickname ?? L.anonOwner,
                  grade: achGradeName(grade),
                  score: n(r.score),
                  done: r.done,
                  players: r.players,
                  team: team.name,
                })}
              >
                {row}
              </Press>
            ) : (
              <View key={r.rank} testID={`ach-rank-${r.rank}`}>
                {row}
              </View>
            );
          })}
          {pages > 1 ? (
            <View
              accessibilityLabel={L.pagerAria}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: c.line,
              }}
            >
              <Btn
                sm
                testID="ach-rank-page-prev"
                disabled={page <= 1}
                onPress={() => goPage(page - 1)}
              >
                {L.prev}
              </Btn>
              <Txt num accessibilityLiveRegion="polite" style={{ fontWeight: '700' }}>
                {`${page} / ${pages}`}
              </Txt>
              <Btn
                sm
                testID="ach-rank-page-next"
                disabled={page >= pages}
                onPress={() => goPage(page + 1)}
              >
                {L.next}
              </Btn>
            </View>
          ) : null}
        </>
      ) : (
        empty(L.ownersEmpty)
      )}
      <View testID="ach-grades" style={{ marginTop: 12 }}>
        <Press
          scale={0.99}
          onPress={() => setGradesOpen(!gradesOpen)}
          accessibilityLabel={L.gradesTitle}
          accessibilityState={{ expanded: gradesOpen }}
          style={{ minHeight: RECORDS_TOUCH, justifyContent: 'center' }}
        >
          <Txt tone="muted" v="sm">
            {L.gradesToggleApp({ open: gradesOpen })}
          </Txt>
        </Press>
        {gradesOpen ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {ACH_GRADES.map((g) => (
              <View
                key={g.id}
                style={{
                  width: '48.5%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: RADIUS.sm,
                  backgroundColor: c.surface2,
                }}
              >
                <AchGradeBadge grade={g} />
                <Txt num={400} tone="muted" style={{ fontSize: rem(FONT.label) }}>
                  {byRank
                    ? g.id === 'rookie'
                      ? L.gradeRest
                      : L.gradeTop({ pct: ACH_GRADE_TOP[g.id] })
                    : L.gradeFrom({ n: n(g.min) })}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Txt tone="muted" style={{ fontSize: rem(FONT.caption), marginTop: 10 }}>
        {L.noteApp}
      </Txt>
    </Card>
  );
}
