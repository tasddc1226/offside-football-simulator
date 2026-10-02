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
import { num as n, recordText } from '@offside/app-core/teamText';
import { RowFrame } from '../../../components/HofRow';
import { appState } from '../../../store';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Card } from '../../../ui/Card';
import { Press } from '../../../ui/Press';
import { scrollTo } from '../../../ui/scroll';
import { Txt } from '../../../ui/Txt';
import { Seg, SortChips, TabOpt } from '../../board/parts';
import TeamProfile from './TeamProfile';

const SORTS: [TeamRankSort, string][] = [
  ['rating', '레이팅'],
  ['ovr', '팀 OVR'],
];

export default function TeamRanking() {
  const c = useColors();
  const snap = useSnapshot(appState);
  /** undefined = 지금 시즌(서버가 정한다). */
  const [season, setSeason] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState<TeamRankSort>('rating');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TeamRankResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    let live = true; // 더 늦게 고른 조건의 응답만 쓴다.
    void fetchTeamRanking(season, sort, page).then((r) => {
      if (!live) return;
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
    <Card gap={0}>
      <View testID="team-ranking">
        <Txt v="eyebrow">Live ranking</Txt>
        <Txt v="h1" accessibilityRole="header" style={{ marginBottom: 8 }}>
          라이브 랭킹
        </Txt>
      </View>
      {data && data.seasons.length > 1 ? (
        <Seg cols={2} label="시즌" style={{ marginTop: 4, marginBottom: 6 }}>
          {data.seasons.map((s) => (
            <TabOpt
              key={s.id}
              title={s.name}
              selected={data.season === s.id}
              testID={`rank-season-${s.id}`}
              onPress={() => {
                setSeason(s.id);
                setPage(1);
              }}
            />
          ))}
        </Seg>
      ) : null}
      <SortChips
        label="순위 유형"
        testIDPrefix="rank-sort"
        value={sort}
        onPick={(k) => {
          setSort(k as TeamRankSort);
          setPage(1);
        }}
        items={SORTS.map(([key, label]) => ({ key, label }))}
      />
      {failed ? (
        empty('랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      ) : !data ? (
        <Txt
          tone="muted"
          accessibilityLiveRegion="polite"
          style={{ fontSize: rem(0.875), paddingVertical: 8 }}
        >
          불러오는 중…
        </Txt>
      ) : data.items.length ? (
        <>
          <Txt tone="muted" style={{ fontSize: rem(0.75), marginBottom: 6 }}>
            {`${data.seasons.find((s) => s.id === data.season)?.name} · 팀 ${n(data.total)}개 · ${sort === 'rating' ? '레이팅' : '팀 OVR'} 순`}
          </Txt>
          {data.items.map((t, i) => (
            <Press
              key={t.teamId}
              scale={0.985}
              testID={`rank-team-${t.teamId}`}
              onPress={() => open(t.teamId)}
            >
              <RowFrame rank={t.rank - 1} first={i === 0}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt>
                      <Txt bold>{t.name}</Txt>
                      <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>{` · ${t.manager}`}</Txt>
                    </Txt>
                    <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                      {`${t.formation} · ${recordText(t.record)} · OVR ${t.ovr}${t.likes ? ` · ♥ ${n(t.likes)}` : ''}`}
                    </Txt>
                  </View>
                  <Txt
                    num
                    numberOfLines={1}
                    style={{ fontSize: rem(1.375), lineHeight: rem(1.375) * 1.2 }}
                  >
                    {sort === 'rating' ? n(t.rating) : t.ovr}
                  </Txt>
                </View>
              </RowFrame>
            </Press>
          ))}
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
              <Btn sm testID="rank-page-prev" disabled={page <= 1} onPress={() => goPage(page - 1)}>
                ← 이전
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
                다음 →
              </Btn>
            </View>
          ) : null}
        </>
      ) : (
        empty(
          '아직 랭킹에 오른 팀이 없어요. 구단주 화면에서 은퇴한 선수로 팀을 꾸리면 여기에 올라요.',
        )
      )}
      <Txt tone="muted" style={{ fontSize: rem(0.75), marginTop: 10 }}>
        레이팅은 팀 경기 결과로 오르내려요. 랭킹은 5분마다 새로 세요.
      </Txt>
    </Card>
  );
}
