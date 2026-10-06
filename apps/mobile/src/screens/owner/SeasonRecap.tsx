// T-11-128 구단주 시즌 결산(웹 SeasonRecap.svelte) — 끝난 시즌의 기록을 서버가 굳힌 그대로 보여 준다. 시즌 등급(티어) ·
// 기록 배지 · 시즌 활동 · 남긴 선수 · 팀 경쟁 · 업적. 끝난 시즌이 둘 이상이면 시즌 칩으로 고른다(기본은 가장 최근).
// 결산을 열면 그 시즌을 '봤다'고 기록해 구단주 허브 카드의 NEW 표시를 끈다. 뒤로 가기는 구단주 허브로 돌아간다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { SeasonRecapResponse } from '@offside/contracts';
import { fetchOwnerHonors, fetchSeasonRecap } from '@offside/app-core/api/seasonRecap';
import { anonName } from '@offside/app-core/format';
import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
import { recapTier, tierReason, tierTitle } from '@offside/app-core/ownerTier';
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
import { HonorEmblem } from '../../components/HonorEmblem';
import { useMedal } from '../../components/Laurel';
import { GradeEmblem } from '../../ui/GradeEmblem';
import { GRADE_COLOR } from './TeamParts';
import { go } from '../../game/nav';
import { appState } from '../../store';
import { openPublicLegendById } from '../../game/host';
import { mix } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
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

/** 기록 배지 진열(웹 .recap-honor) — 칸 없이 문장만 세 개씩(76px). 문장 아래에 이름(굵게)과 단계(메달 글자색). */
function HonorBadge({ h }: { h: HonorView }) {
  const { leaf, text } = useMedal(h.medal);
  return (
    <View
      testID={`recap-honor-${h.kind}`}
      accessible
      accessibilityLabel={`${h.title} ${h.detail}`}
      style={{ width: '33.3333%', alignItems: 'center', gap: 4, paddingHorizontal: 3 }}
    >
      {/* 웹 drop-shadow — 메달 색 빛(iOS만 그려지고 안드로이드는 생략). */}
      <View
        style={{
          shadowColor: leaf,
          shadowOpacity: 0.35,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <HonorEmblem h={h} size={76} />
      </View>
      <View style={{ gap: 1, alignItems: 'center', minWidth: 0 }} accessibilityElementsHidden>
        <Txt bold center style={{ fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.25 }}>
          {h.title}
        </Txt>
        <Txt num={600} center style={{ fontSize: rem(0.75), color: text, fontWeight: '600' }}>
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
      if (r.data.status === 'ready') {
        markRecapSeen(r.data.season);
        appState.recapNew = false;
      }
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
  const tier = recap ? recapTier(recap) : null;
  const c = useColors();

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
          {tier ? (
            // 시즌 등급 — 구단주 랭킹과 같은 업적 등급을 마감 업적 점수로. 프로필 · 댓글 · 채팅에 다음 시즌 내내 붙는다(웹 .recap-tier).
            <Card gap={4} testID={`recap-tier-${tier}`}>
              <Sec>{L.secTier}</Sec>
              <View
                accessible
                accessibilityLabel={`${tierTitle({ tier, season: res.season })} ${tierReason(recap)}`}
                style={{ alignItems: 'center', gap: 4, paddingBottom: 4 }}
              >
                <GradeEmblem id={tier} size={112} />
                <Txt
                  style={{
                    marginTop: 8,
                    fontFamily: DISPLAY[700],
                    fontSize: rem(1.25),
                    letterSpacing: 0.3,
                    color: mix(GRADE_COLOR[tier] ?? GRADE_COLOR.rookie!, c.ink, 0.65),
                  }}
                >
                  {tierTitle({ tier, season: res.season })}
                </Txt>
                <Txt tone="muted" num style={muted}>
                  {tierReason(recap)}
                </Txt>
              </View>
            </Card>
          ) : null}

          <Card gap={10} testID="recap-honors">
            <Sec>{L.secBadges}</Sec>
            {honors.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, paddingTop: 4 }}>
                {honors.map((h) => (
                  <HonorBadge key={`${h.season}-${h.kind}`} h={h} />
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
