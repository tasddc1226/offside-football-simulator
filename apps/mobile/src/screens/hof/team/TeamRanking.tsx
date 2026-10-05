// T-10-092 라이브 랭킹(팀 랭킹, 웹 team/TeamRanking.svelte) — 기록실 탭. 선수가 한 명 이상 있는 구단주 팀을 시즌별로
// 레이팅(경기 결과) 또는 팀 OVR 순으로 보여 주고, 줄을 누르면 팀 프로필(appState.hof.team)을 연다. 서버가 5분마다 새로 센다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { TEAM_RANK_PER_PAGE } from '@offside/contracts/owner-team';
import {
  fetchTeamRanking,
  type TeamRankResponse,
  type TeamRankSort,
} from '@offside/app-core/api/team';
import { num as n } from '@offside/app-core/teamText';
import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';
import { appState } from '../../../store';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Card } from '../../../ui/Card';
import { Press } from '../../../ui/Press';
import { scrollTo } from '../../../ui/scroll';
import { Txt } from '../../../ui/Txt';
import { displaySeasonAt, openTeamSeasons } from '@offside/contracts/service-seasons';
import { RecordsSelect, RecordsChips } from '../RecordsControls';
import TeamProfile from './TeamProfile';
import { TeamLogo } from '../../../components/TeamLogo';
import { seasonLabel, teamSeasonLabel } from '@offside/app-core/seasonName';

const sorts = (): [TeamRankSort, string][] => [
  ['rating', L.sortRating],
  ['ovr', L.sortOvr],
];

export default function TeamRanking() {
  const c = useColors();
  const snap = useSnapshot(appState);
  /** undefined = 지금 시즌(서버가 정한다). */
  const [season, setSeason] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState<TeamRankSort>('rating');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TeamRankResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoading(true);
    let live = true; // 더 늦게 고른 조건의 응답만 쓴다.
    void fetchTeamRanking(season, sort, page).then((r) => {
      if (!live) return;
      setLoading(false);
      if (r.ok) setData(r.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [season, sort, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / TEAM_RANK_PER_PAGE)) : 1;
  function goPage(p: number) {
    setPage(p);
    scrollTo(0);
  }
  function open(id: string) {
    appState.hof = { ...appState.hof, team: id };
    scrollTo(0);
  }

  // '← 이전으로'는 화면(Hof)이 아래 막대로 그린다.
  if (snap.hof.team) return <TeamProfile id={snap.hof.team} />;

  const empty = (text: string) => (
    <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
      {text}
    </Txt>
  );
  return (
    <Card gap={0} style={{ paddingHorizontal: 12, paddingVertical: 16 }}>
      <View
        testID="team-ranking"
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}
      >
        <RecordsSelect
          label={L.seasonLabel}
          testID="rank-season-select"
          value={season ?? data?.season ?? displaySeasonAt(new Date().toISOString())}
          options={
            data?.seasons.map((s) => ({ value: s.id, label: seasonLabel(s.id, s.name) })) ??
            openTeamSeasons(new Date().toISOString()).map((id) => ({
              value: id,
              label: teamSeasonLabel(id),
            }))
          }
          onChange={(id) => {
            setSeason(id);
            setPage(1);
          }}
        />
        <Txt tone="muted" style={{ flex: 1, textAlign: 'right', fontSize: 12, paddingBottom: 10 }}>
          {L.teamsApp({ n: n(data?.total ?? 0) })}
        </Txt>
      </View>
      <RecordsChips
        label={L.sortGroupAria}
        testIDPrefix="rank-sort"
        value={sort}
        items={sorts().map(([key, label]) => ({ key, label }))}
        onPick={(key) => {
          setSort(key as TeamRankSort);
          setPage(1);
        }}
      />
      <Txt tone="muted" style={{ fontSize: 12, marginVertical: 8 }}>
        {L.formGuide}
      </Txt>
      {failed ? (
        empty(L.rankFail)
      ) : loading || !data ? (
        <Txt
          tone="muted"
          accessibilityLiveRegion="polite"
          style={{ fontSize: rem(0.875), paddingVertical: 8 }}
        >
          {L.loading}
        </Txt>
      ) : data.items.length ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: c.line,
            }}
            accessibilityElementsHidden
          >
            <Txt tone="muted" style={{ flex: 1, fontSize: 12 }}>
              {L.colTeam}
            </Txt>
            {[L.colPlayed, L.colWin, L.colDraw, L.colLoss].map((label, i) => (
              <Txt
                key={label}
                tone="muted"
                center
                style={{ width: i === 0 ? 28 : 22, fontSize: 12 }}
              >
                {label}
              </Txt>
            ))}
            <Txt bold center style={{ width: 48, fontSize: 12 }}>
              {sort === 'rating' ? L.sortRating : L.colOvrApp}
            </Txt>
          </View>
          {data.items.map((t) => (
            <Press
              key={t.teamId}
              scale={1}
              testID={`rank-team-${t.teamId}`}
              onPress={() => open(t.teamId)}
              accessibilityLabel={L.teamRowAria({
                rank: t.rank,
                name: t.name,
                played: String(t.record.w + t.record.d + t.record.l),
                w: String(t.record.w),
                d: String(t.record.d),
                l: String(t.record.l),
                metric: sort === 'rating' ? L.sortRating : L.sortOvr,
                value: String(sort === 'rating' ? t.rating : t.ovr),
                form: t.recentForm.length
                  ? t.recentForm
                      .map((r) => ({ W: L.formWin, D: L.formDraw, L: L.formLoss })[r])
                      .join(', ')
                  : L.formNone,
              })}
              style={{
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: c.line,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Txt num tone="muted" center style={{ width: 22, fontSize: 14 }}>
                    {t.rank}
                  </Txt>
                  <TeamLogo logo={t.logo} name={t.name} size={24} decorative />
                  <Txt bold numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>
                    {t.name}
                  </Txt>
                </View>
                {[t.record.w + t.record.d + t.record.l, t.record.w, t.record.d, t.record.l].map(
                  (value, i) => (
                    <Txt key={i} num center style={{ width: i === 0 ? 28 : 22, fontSize: 14 }}>
                      {n(value)}
                    </Txt>
                  ),
                )}
                <Txt num bold center style={{ width: 48, fontSize: 17 }}>
                  {sort === 'rating' ? n(t.rating) : t.ovr}
                </Txt>
              </View>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 27 }}
              >
                <Txt tone="muted" numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>
                  {t.manager}
                </Txt>
                <View
                  testID={`rank-team-form-${t.teamId}`}
                  style={{ flexDirection: 'row', gap: 4 }}
                >
                  {[0, 1, 2, 3, 4].map((i) => {
                    const result = t.recentForm[i];
                    const color = result === 'W' ? c.good : result === 'L' ? c.bad : c.muted;
                    return (
                      <View
                        key={i}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          borderWidth: 1,
                          borderColor: result ? color : c.line,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Txt accessible={false} style={{ fontSize: 12, lineHeight: 16, color }}>
                          {result ? { W: '✓', D: '−', L: '×' }[result] : ''}
                        </Txt>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Press>
          ))}
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
              <Btn sm testID="rank-page-prev" disabled={page <= 1} onPress={() => goPage(page - 1)}>
                {L.prev}
              </Btn>
              <Txt num accessibilityLiveRegion="polite" style={{ fontWeight: '700' }}>
                {`${page} / ${pages}`}
              </Txt>
              <Btn
                sm
                testID="rank-page-next"
                disabled={page >= pages}
                onPress={() => goPage(page + 1)}
              >
                {L.next}
              </Btn>
            </View>
          ) : null}
        </>
      ) : (
        empty(L.teamsEmpty)
      )}
      <Txt tone="muted" style={{ fontSize: rem(0.75), marginTop: 10 }}>
        {L.teamsFoot}
      </Txt>
    </Card>
  );
}
