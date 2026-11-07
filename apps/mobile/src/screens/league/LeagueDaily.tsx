// T-11-652 오프사이드 데일리(웹 league/LeagueDaily.svelte) — 끝난 라운드 신문, 다음 라운드 빅매치 예측(보상 없이 적중 기록만),
// 기사 라운지 공유. 리그 화면을 열 때만 불러온다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { RADIUS } from '@offside/app-core/design-tokens';
import {
  fetchLeagueNews,
  fetchLeaguePredictionCounts,
  fetchLeaguePredictionsMe,
  putLeaguePrediction,
  type LeagueNewsMatch,
  type LeagueNewsResponse,
  type LeaguePredictionCounts,
  type LeaguePredictionMeResponse,
  type LeaguePredictionPick,
} from '@offside/app-core/api/league';
import { leagueNewsText as N } from '@offside/app-core/i18n/ko/leagueNews';
import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';
import { lastBigLine, newsCards, pickLabel, predictionSplit } from '@offside/app-core/leagueNews';
import { leagueWhen } from '@offside/app-core/leagueView';
import { shareToLounge } from '../../components/loungeShare';
import { TeamLogo } from '../../components/TeamLogo';
import { toast } from '../../game/host';
import { alpha } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Pill, Press, Skeleton, Txt } from '../../ui';

const PICKS: LeaguePredictionPick[] = ['home', 'draw', 'away'];

export function LeagueDaily({
  season,
  round,
  linked,
  onopen,
}: {
  season: number;
  /** 끝난 라운드 수(0이면 1라운드 빅매치만). */
  round: number;
  linked: boolean;
  onopen: (m: LeagueNewsMatch) => void;
}) {
  const c = useColors();
  const [news, setNews] = useState<LeagueNewsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [counts, setCounts] = useState<LeaguePredictionCounts | null>(null);
  const [mine, setMine] = useState<LeaguePredictionMeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = async () => {
    setFailed(false);
    const r = await fetchLeagueNews(season, round);
    if (!r.ok) return setFailed(true);
    setNews(r.data);
    const big = r.data.bigMatch;
    if (big) {
      const x = await fetchLeaguePredictionCounts(season, big.id);
      if (x.ok) setCounts(x.data);
    }
  };
  useEffect(() => {
    void load();
    // 라운드가 바뀔 때만.
  }, [season, round]);
  useEffect(() => {
    if (!linked) return setMine(null);
    void fetchLeaguePredictionsMe(season).then((r) => setMine(r.ok ? r.data : null));
  }, [linked, season]);

  const cards = news ? newsCards(news) : [];
  const big = news?.bigMatch ?? null;
  const last = news ? lastBigLine(news) : null;
  const myPick = big ? (mine?.items.find((x) => x.matchId === big.id)?.pick ?? null) : null;
  const split = counts ? predictionSplit(counts) : null;
  const open = !!big && Date.parse(big.at) > Date.now();

  const pick = async (p: LeaguePredictionPick) => {
    if (!big || busy) return;
    if (!linked) return toast(N.pickLogin);
    setBusy(true);
    const r = await putLeaguePrediction(season, big.id, p);
    setBusy(false);
    if (!r.ok) return toast(r.error.message || N.pickFail);
    setCounts(r.data);
    setMine((prev) => ({
      hit: prev?.hit ?? 0,
      total: prev?.total ?? 0,
      items: [
        { matchId: big.id, round: big.round, pick: p, result: null },
        ...(prev?.items ?? []).filter((x) => x.matchId !== big.id),
      ],
    }));
    toast(N.pickSaved);
  };
  const share = async (m: LeagueNewsMatch) => {
    if (sharing) return;
    setSharing(true);
    await shareToLounge({ kind: 'leagueMatch', season, matchId: m.id });
    setSharing(false);
  };
  const link = (text: string, onPress: () => void, testID: string, label?: string) => (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? text}
      testID={testID}
      style={{ minHeight: 32, justifyContent: 'center' }}
    >
      <Txt v="sm" bold tone="accent">
        {text}
      </Txt>
    </Press>
  );

  return (
    <Card gap={12} testID={`league-daily-${round}`}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          borderBottomWidth: 2,
          borderBottomColor: c.ink,
          paddingBottom: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Txt style={{ fontFamily: DISPLAY[800], fontSize: rem(1.35), lineHeight: rem(1.6) }}>
            {N.title}
          </Txt>
          {round > 0 ? (
            <Txt v="xs" tone="muted">
              {N.edition({ round })}
            </Txt>
          ) : null}
        </View>
        {mine && mine.total > 0 ? (
          <View testID="league-pred-record">
            <Pill>{N.record({ hit: mine.hit, total: mine.total })}</Pill>
          </View>
        ) : null}
      </View>
      {failed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt v="sm" tone="muted" style={{ flex: 1 }}>
            {N.loadFail}
          </Txt>
          <Btn onPress={() => void load()} testID="league-daily-retry">
            {shellMoreText.retry}
          </Btn>
        </View>
      ) : !news ? (
        <Skeleton height={160} />
      ) : (
        <>
          {round === 0 ? (
            <Txt v="sm" tone="muted" testID="league-daily-first">
              {N.firstSoon}
            </Txt>
          ) : !cards.length ? (
            <Txt v="sm" tone="muted">
              {N.quiet}
            </Txt>
          ) : null}
          {cards.map((card, i) => (
            <View
              key={card.key}
              testID={`league-news-${card.kind}`}
              style={{ gap: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.line }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
              >
                <Pill tone={card.kind === 'upset' ? 'warn' : undefined}>{card.tag}</Pill>
                <Txt v="xs" tone="muted">
                  {card.where}
                </Txt>
              </View>
              <Txt
                bold
                style={{
                  fontSize: rem(i === 0 ? 1.15 : 1),
                  lineHeight: rem(i === 0 ? 1.55 : 1.35),
                }}
              >
                {card.head}
              </Txt>
              <Txt v="sm" style={{ lineHeight: rem(1) * 1.5 }}>
                {card.body}
              </Txt>
              {card.match ? (
                <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                  {link(`${N.readArticle} ›`, () => onopen(card.match!), 'league-news-open')}
                  {linked
                    ? link(
                        N.shareAct,
                        () => void share(card.match!),
                        'league-news-share',
                        N.shareAria({ home: card.match.home.name, away: card.match.away.name }),
                      )
                    : null}
                </View>
              ) : null}
            </View>
          ))}
          {big ? (
            <View
              testID={`league-big-${big.id}`}
              style={{
                gap: 8,
                padding: 12,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: RADIUS.md,
                backgroundColor: alpha(c.accent, 0.05),
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
              >
                <Pill tone="good">{N.tagBig}</Pill>
                <Txt v="xs" tone="muted">
                  {N.where({ tier: big.tier, league: big.league, round: big.round })}
                </Txt>
              </View>
              <Txt v="h3" bold>
                {N.bigTitle}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {[big.home, big.away].map((t, k) => (
                  <View
                    key={t.teamId}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      gap: 2,
                      alignItems: k ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <TeamLogo logo={t.logo} name={t.name} size={32} decorative />
                    <Txt bold style={{ textAlign: k ? 'right' : 'left' }}>
                      {t.name}
                    </Txt>
                    <Txt v="xs" tone="muted">
                      {N.rankOvr({ rank: k ? big.awayRank : big.homeRank, ovr: t.ovr })}
                    </Txt>
                  </View>
                ))}
              </View>
              <Txt v="xs" tone="muted">
                {N.bigWhen({ when: leagueWhen(big.at) })}
              </Txt>
              {open ? (
                <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup">
                  {PICKS.map((p) => (
                    <View key={p} style={{ flex: 1 }}>
                      <Btn
                        block
                        kind={myPick === p ? 'primary' : 'default'}
                        disabled={busy}
                        onPress={() => void pick(p)}
                        testID={`league-pick-${p}`}
                      >
                        {pickLabel(p)}
                      </Btn>
                    </View>
                  ))}
                </View>
              ) : null}
              {myPick ? (
                <Txt v="xs" testID={`league-my-pick-${myPick}`}>
                  {N.picked({ pick: pickLabel(myPick) })}
                </Txt>
              ) : null}
              {split ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      height: 6,
                      borderRadius: 3,
                      overflow: 'hidden',
                      backgroundColor: c.line,
                    }}
                  >
                    <View style={{ width: `${split.home}%`, backgroundColor: c.accent }} />
                    <View style={{ width: `${split.draw}%`, backgroundColor: c.muted }} />
                    <View style={{ width: `${split.away}%`, backgroundColor: c.warn }} />
                  </View>
                  <Txt v="xs" tone="muted" testID="league-pred-split">
                    {split.line}
                  </Txt>
                </>
              ) : null}
            </View>
          ) : null}
          {last ? (
            <Txt v="xs" tone="muted" testID="league-last-big">
              {last}
            </Txt>
          ) : null}
        </>
      )}
    </Card>
  );
}
