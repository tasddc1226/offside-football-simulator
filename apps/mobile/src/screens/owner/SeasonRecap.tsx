// T-11-128 구단주 시즌 결산(웹 SeasonRecap.svelte) — 끝난 시즌의 기록을 서버가 굳힌 그대로 보여 준다. 받은 휘장 ·
// 시즌 활동 · 남긴 선수 · 팀 경쟁 · 업적. 끝난 시즌이 둘 이상이면 시즌 칩으로 고른다(기본은 가장 최근).
// 결산을 열면 그 시즌을 '봤다'고 기록해 구단주 허브 카드의 NEW 표시를 끈다. 뒤로 가기는 구단주 허브로 돌아간다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { SeasonRecapResponse } from '@offside/contracts';
import { fetchOwnerHonors, fetchSeasonRecap } from '@offside/app-core/api/seasonRecap';
import { anonName } from '@offside/app-core/format';
import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
import { teamSeasonLabel } from '@offside/app-core/seasonName';
import {
  honorViews,
  markRecapSeen,
  rankText,
  recapCutoffText,
  recapStatusText,
  type HonorView,
} from '@offside/app-core/seasonRecap';
import { num, recordText } from '@offside/app-core/teamText';
import { POS } from '@offside/game/data';
import { Laurel, MEDAL_GLOW, useMedal } from '../../components/Laurel';
import { go } from '../../game/nav';
import { openPublicLegendById } from '../../game/host';
import { alpha } from '../../theme/colors';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { BackBar, Btn, Card, Press, Screen, Topbar, Txt } from '../../ui';
import { useRefresh } from '../../ui/refresh';
import { Seg, TabOpt } from '../board/parts';

/** 카드 제목 줄(영문 eyebrow 없이 소제목만). */
const Sec = ({ children }: { children: string }) => (
  <Txt v="h2" accessibilityRole="header">
    {children}
  </Txt>
);

/** 이름 · 값 한 줄(값이 없으면 문구만). 첫 줄이 아니면 위에 구분선. */
function KV({ k, v, first, testID }: { k: string; v: string; first?: boolean; testID?: string }) {
  const c = useColors();
  return (
    <View
      testID={testID}
      accessible
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 9,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.line,
      }}
    >
      <Txt tone={v ? 'muted' : 'ink'} style={{ fontSize: rem(0.875) }}>
        {k}
      </Txt>
      {v ? (
        <Txt num style={{ fontSize: rem(1), flexShrink: 1, textAlign: 'right' }}>
          {v}
        </Txt>
      ) : null}
    </View>
  );
}
const Rows = ({ items }: { items: [string, string, string?][] }) => (
  <View>
    {items.map(([k, v, id], i) => (
      <KV key={k} k={k} v={v} first={i === 0} {...(id ? { testID: id } : {})} />
    ))}
  </View>
);

/** 휘장 타일 — 메달 색 월계관 + 별 · 이름 · 단계. */
function HonorTile({ h }: { h: HonorView }) {
  const { text } = useMedal(h.medal);
  return (
    <View
      testID={`recap-honor-${h.kind}`}
      accessible
      accessibilityLabel={`${h.title} ${h.detail}`}
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: alpha(MEDAL_GLOW[h.medal], 0.5),
        backgroundColor: alpha(MEDAL_GLOW[h.medal], 0.12),
      }}
    >
      <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
        <Laurel medal={h.medal} />
        <Svg
          viewBox="0 0 24 24"
          width={14}
          height={14}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Path
            d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"
            fill={text}
          />
        </Svg>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Txt bold style={{ fontSize: rem(0.875) }}>
          {h.title}
        </Txt>
        <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
          {h.detail}
        </Txt>
      </View>
    </View>
  );
}

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; res: SeasonRecapResponse };

export default function SeasonRecap() {
  // 끝난 시즌(오래된 순)과 고른 시즌 — 고르지 않았으면 가장 최근.
  const [seasons, setSeasons] = useState<number[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [st, setSt] = useState<State>({ kind: 'loading' });
  const [retryN, setRetryN] = useState(0);
  const { tick, track, pulled } = useRefresh();
  const season = picked ?? seasons?.at(-1) ?? null;

  useEffect(() => {
    let alive = true;
    void track(fetchOwnerHonors()).then((r) => alive && r.ok && setSeasons(r.data.seasons));
    return () => {
      alive = false;
    };
  }, [tick, track]);

  useEffect(() => {
    // 시즌 목록이 오기 전에는 서버가 정한 가장 최근 시즌을 받는다(season 생략).
    if (!pulled) setSt({ kind: 'loading' });
    let alive = true; // 더 늦게 고른 시즌의 응답만 쓴다.
    void track(fetchSeasonRecap(season ?? undefined)).then((r) => {
      if (!alive) return;
      if (!r.ok) return setSt({ kind: 'error' });
      setSt({ kind: 'ok', res: r.data });
      if (r.data.status === 'ready') markRecapSeen(r.data.season);
    });
    return () => {
      alive = false;
    };
  }, [season, tick, retryN, track]);

  const res = st.kind === 'ok' ? st.res : null;
  const recap = res?.recap ?? null;
  const shown = res ? teamSeasonLabel(res.season) : '';
  const honors = res ? honorViews(res.honors) : [];
  const muted = { fontSize: rem(0.875) } as const;

  return (
    <Screen footer={<BackBar testID="owner" fallback={() => go('owner')} />}>
      <Topbar />
      <Card gap={8} testID="recap">
        <View style={{ gap: 2 }}>
          <Txt v="eyebrow">Season recap</Txt>
          <Txt v="h1" accessibilityRole="header">
            {res ? L.title({ season: shown }) : L.cardTitle}
          </Txt>
          {recap ? (
            <Txt tone="muted" style={muted}>
              {recapCutoffText(recap)}
            </Txt>
          ) : null}
        </View>
        {seasons && seasons.length > 1 ? (
          <Seg cols={Math.min(seasons.length, 3)} label={L.pickSeason} style={{ marginTop: 4 }}>
            {seasons.map((id) => (
              <TabOpt
                key={id}
                title={teamSeasonLabel(id)}
                selected={season === id}
                testID={`recap-season-${id}`}
                onPress={() => setPicked(id)}
              />
            ))}
          </Seg>
        ) : null}
        {st.kind === 'loading' ? (
          <Txt tone="muted" accessibilityLiveRegion="polite" style={muted}>
            {'…'}
          </Txt>
        ) : st.kind === 'error' ? (
          <View style={{ gap: 8 }}>
            <Txt tone="muted" style={muted}>
              {L.loadFail}
            </Txt>
            <Btn
              sm
              testID="recap-retry"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => setRetryN((n) => n + 1)}
            >
              {L.retry}
            </Btn>
          </View>
        ) : res && res.status !== 'ready' ? (
          <Txt tone="muted" testID={`recap-${res.status}`} style={muted}>
            {recapStatusText(res)}
          </Txt>
        ) : null}
      </Card>

      {res && recap ? (
        <>
          <Card gap={10} testID="recap-honors">
            <Sec>{L.secHonors}</Sec>
            {honors.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {honors.map((h) => (
                  <HonorTile key={`${h.season}-${h.kind}`} h={h} />
                ))}
              </View>
            ) : (
              <Txt tone="muted" style={muted}>
                {L.honorsNone}
              </Txt>
            )}
          </Card>

          <Card gap={6} testID="recap-activity">
            <Sec>{L.secActivity}</Sec>
            <Rows
              items={[
                [L.players, num(recap.players)],
                [L.retired, num(recap.retired)],
              ]}
            />
          </Card>

          <Card gap={6} testID="recap-legacy">
            <Sec>{L.secLegacy}</Sec>
            {recap.best ? <BestPlayer best={recap.best} /> : null}
            <Rows
              items={[
                [L.hofRank, rankText(recap.hofRank, recap.hofRanked)],
                [L.retiredNumbers, num(recap.retiredNumbers)],
                [L.wallOfHonor, num(recap.wallOfHonor)],
                [L.firsts, num(recap.firsts)],
              ]}
            />
          </Card>

          <Card gap={6} testID="recap-team">
            <Sec>{L.secTeam}</Sec>
            {recap.team ? (
              <>
                <Txt bold style={{ fontSize: rem(1.0625) }}>
                  {recap.team.name}
                </Txt>
                <Rows
                  items={[
                    [L.rating, num(recap.team.rating)],
                    [L.teamRank, rankText(recap.team.rank, recap.team.ranked)],
                    [
                      recordText({
                        w: recap.team.wins,
                        d: recap.team.draws,
                        l: recap.team.losses,
                      }),
                      '',
                    ],
                    [L.goals, num(recap.team.goalsFor)],
                    [L.bestStreak, num(recap.team.bestStreak)],
                  ]}
                />
              </>
            ) : (
              <Txt tone="muted" style={muted}>
                {L.noTeam}
              </Txt>
            )}
          </Card>

          {recap.achievements ? (
            <Card gap={6} testID="recap-achievements">
              <Sec>{L.secAch}</Sec>
              <Rows
                items={[
                  [L.achScore, num(recap.achievements.score)],
                  [L.achRank, rankText(recap.achievements.rank, recap.achievements.ranked)],
                  [L.achDone({ n: recap.achievements.done }), ''],
                ]}
              />
            </Card>
          ) : null}

          <Txt tone="muted" center testID="recap-next" style={{ ...muted, paddingBottom: 4 }}>
            {L.next({ season: teamSeasonLabel(res.season + 1) })}
          </Txt>
        </>
      ) : null}
    </Screen>
  );
}

/** 마감 전 은퇴한 선수 가운데 레전드 점수가 가장 높은 선수. 이름을 공개한 선수만 눌러 상세를 연다. */
function BestPlayer({
  best,
}: {
  best: NonNullable<SeasonRecapResponse['recap']>['best'] & object;
}) {
  const c = useColors();
  const name = best.name ?? anonName(best.pos, null);
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
          {L.best}
        </Txt>
        <Txt bold style={{ fontSize: rem(1.0625) }}>
          {name}
        </Txt>
        <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
          {[POS[best.pos].label, best.lastClub].filter(Boolean).join(' · ')}
        </Txt>
      </View>
      <Txt num style={{ fontSize: rem(0.875), color: c.accentText }}>
        {L.bestScore({ score: num(best.score) })}
      </Txt>
    </View>
  );
  const box = {
    padding: 12,
    borderRadius: 12,
    backgroundColor: c.surface2,
  } as const;
  return best.name ? (
    <Press
      scale={0.985}
      testID="recap-best"
      accessibilityLabel={`${name} ${L.bestScore({ score: num(best.score) })}`}
      onPress={() => void openPublicLegendById(best.careerId)}
      style={box}
    >
      {body}
    </Press>
  ) : (
    <View testID="recap-best" style={box}>
      {body}
    </View>
  );
}
