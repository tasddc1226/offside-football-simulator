// T-11-028 구단주 랭킹(웹 team/AchievementRanking.svelte) — 기록실 탭. 구단주의 시즌 업적 점수 순(같은 점수면 먼저 닿은 구단주가
// 앞선다). 구단주는 공개 닉네임과 그 시즌 팀 이름으로만 보이고, 팀이 있으면 줄을 눌러 팀 프로필(appState.hof.team)을 연다.
// 서버가 5분마다 새로 센다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ACH_GRADES, ACH_RANK_PER_PAGE, achGradeOf } from '@offside/contracts/owner-team';
import { fetchAchRanking, type AchRankResponse } from '@offside/app-core/api/team';
import { hofStart } from '@offside/app-core/state';
import { num as n } from '@offside/app-core/teamText';
import { appState } from '../../../store';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Card } from '../../../ui/Card';
import { Press } from '../../../ui/Press';
import { scrollTo } from '../../../ui/scroll';
import { Txt } from '../../../ui/Txt';
import {
  displaySeasonAt,
  openTeamSeasons,
  teamSeasonName,
} from '@offside/contracts/service-seasons';
import { RecordsSelect, RECORDS_TOUCH } from '../RecordsControls';
import { AchGradeBadge } from '../../owner/TeamParts';
import { GradeEmblem } from '../../../ui/GradeEmblem';
import { TeamLogo } from '../../../components/TeamLogo';
import { useSeasonNow } from '../../../ui/useSeasonNow';

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

  useEffect(() => {
    setFailed(false);
    setLoading(true);
    let live = true; // 더 늦게 고른 조건의 응답만 쓴다.
    void fetchAchRanking(season, page).then((r) => {
      if (!live) return;
      setLoading(false);
      if (r.ok) setData(r.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [season, page, shownSeason]);

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
    <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
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
          label="시즌"
          testID="ach-rank-season-select"
          value={season ?? data?.season ?? displaySeasonAt(now)}
          options={
            data?.seasons.map((s) => ({ value: s.id, label: s.name })) ??
            openTeamSeasons(now).map((id) => ({
              value: id,
              label: teamSeasonName(id),
            }))
          }
          onChange={(id) => {
            setSeason(id);
            setPage(1);
          }}
        />
        <Txt
          tone="muted"
          style={{ flex: 1, textAlign: 'right', fontSize: 12, paddingBottom: 10 }}
        >{`구단주 ${n(data?.total ?? 0)}명`}</Txt>
      </View>
      {failed ? (
        empty('랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      ) : loading || !data ? (
        <Txt
          tone="muted"
          accessibilityLiveRegion="polite"
          style={{ fontSize: rem(0.875), paddingVertical: 8 }}
        >
          불러오는 중…
        </Txt>
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
              순위
            </Txt>
            <Txt tone="muted" style={{ flex: 1, paddingLeft: 8, fontSize: 12 }}>
              구단주
            </Txt>
            <Txt tone="muted" center style={{ width: 44, fontSize: 12 }}>
              등급
            </Txt>
            <Txt tone="muted" style={{ width: 58, fontSize: 12, textAlign: 'right' }}>
              점수
            </Txt>
          </View>
          {data.items.map((r) => {
            const team = r.team;
            const grade = achGradeOf(r.score).grade;
            const row = (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: c.line,
                }}
              >
                <Txt num tone="muted" center style={{ width: 24, fontSize: 15 }}>
                  {r.rank}
                </Txt>
                {team ? <TeamLogo logo={team.logo} name={team.name} size={24} decorative /> : null}
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Txt bold numberOfLines={1} style={{ fontSize: 14 }}>
                    {r.nickname ?? '익명 구단주'}
                  </Txt>
                  {team ? (
                    <Txt tone="muted" numberOfLines={1} style={{ fontSize: 12 }}>
                      {team.name}
                    </Txt>
                  ) : null}
                  <Txt
                    tone="muted"
                    numberOfLines={1}
                    style={{ fontSize: 12 }}
                  >{`업적 ${n(r.done)}개 · 선수 ${n(r.players)}명`}</Txt>
                </View>
                <View
                  accessible
                  accessibilityLabel={`등급 ${grade.name}`}
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
                accessibilityLabel={`${r.rank}위 ${r.nickname ?? '익명 구단주'}, ${grade.name}, ${n(r.score)}점, 업적 ${r.done}개, 선수 ${r.players}명, ${team.name} 팀 상세 보기`}
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
              accessibilityLabel="랭킹 페이지"
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
                ← 이전
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
                다음 →
              </Btn>
            </View>
          ) : null}
        </>
      ) : (
        empty('아직 랭킹에 오른 구단주가 없어요. 은퇴한 선수로 시즌 업적을 달성하면 여기에 올라요.')
      )}
      <View testID="ach-grades" style={{ marginTop: 12 }}>
        <Press
          scale={0.99}
          onPress={() => setGradesOpen(!gradesOpen)}
          accessibilityLabel="등급 기준"
          accessibilityState={{ expanded: gradesOpen }}
          style={{ minHeight: RECORDS_TOUCH, justifyContent: 'center' }}
        >
          <Txt tone="muted" v="sm">
            {`${gradesOpen ? '▾' : '▸'} 등급 기준`}
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
                  borderRadius: 10,
                  backgroundColor: c.surface2,
                }}
              >
                <AchGradeBadge grade={g} />
                <Txt num={400} tone="muted" style={{ fontSize: rem(0.8125) }}>
                  {`${n(g.min)}점부터`}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Txt tone="muted" style={{ fontSize: rem(0.75), marginTop: 10 }}>
        시즌마다 처음부터 다시 쌓아요. 선수·팀·구단주 업적 점수의 합이고, 랭킹은 5분마다 갱신돼요.
      </Txt>
    </Card>
  );
}
