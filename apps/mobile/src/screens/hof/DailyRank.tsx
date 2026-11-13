// T-11-723 오늘의 랭킹(기록실 탭, 웹 DailyRank.svelte). 오늘(한국 시각) 은퇴한 선수의 레전드 점수 순위와 어제 1 · 2 · 3위.
// 자정에 순위가 굳고 1 · 2 · 3위 카드에 표식이 남는다. 탭을 열 때만 부르고 메모(60초)를 거친다.
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { DailyRankResponse, PublicHofEntry } from '@offside/contracts';
import {
  DAILY_RANK_FIRST_DAY,
  DAILY_RANK_REWARDS,
  dailyRankOpen,
  dailyRankStart,
} from '@offside/contracts/daily-rank';
import { getDailyRank } from '@offside/app-core/api/client';
import { kstMonthDayHour } from '@offside/app-core/boardText';
import { playerName } from '@offside/app-core/format';
import { raiserLabel } from '@offside/app-core/hofRaiser';
import { hofText as L } from '@offside/app-core/i18n/ko/hof';
import { loadHOF } from '@offside/game/hof-store';
import { HofRow } from '../../components/HofRow';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { openPublicLegend } from '../../game/host';
import { useColors } from '../../theme/useColors';
import { Pill } from '../../ui/bits';
import { Card } from '../../ui/Card';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';

export default function DailyRank() {
  const c = useColors();
  const [data, setData] = useState<DailyRankResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [tick, setTick] = useState(0);
  const myIds = useMemo(() => new Set(loadHOF().flatMap((h) => (h.id ? [h.id] : []))), []);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    void getDailyRank().then((res) => {
      if (!live) return;
      if (res.ok) {
        setData(res.data);
        setStatus('ready');
      } else setStatus('error');
    });
    return () => {
      live = false;
    };
  }, [tick]);

  const row = (h: PublicHofEntry, rank: number, first: boolean) => (
    <Press
      key={h.id}
      scale={0.985}
      testID={`daily-row-${h.id}`}
      onPress={() => void openPublicLegend(h)}
    >
      <HofRow
        rank={rank}
        name={playerName(h.name, h.pos, h.number)}
        pos={h.pos}
        dpos={h.dpos}
        nation={h.nation}
        club={h.lastClub}
        clubId={h.lastClubId}
        showClub
        shortPos
        retireAge={h.retireAge}
        rn={h.retiredNumber?.number}
        wall={h.wallOfHonor ? h.number : null}
        tag={myIds.has(h.id) ? L.mine : null}
        owner={raiserLabel(h.raiser)}
        t={{ ...h, score: h.legendScore }}
        titleId={h.title}
        compact
        plain
        first={first}
      />
    </Press>
  );

  return (
    <Card gap={12} testID="daily-rank">
      <View style={{ gap: 2 }}>
        <Txt v="eyebrow">Daily</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.dailyTitle}
        </Txt>
      </View>
      <Txt v="sm" tone="muted">
        {L.dailyLead}
      </Txt>
      <Txt v="sm" tone="muted" testID="daily-reward">
        {L.dailyReward({
          scout: DAILY_RANK_REWARDS[0]!.scout,
          reroll: DAILY_RANK_REWARDS[0]!.reroll,
          rest: DAILY_RANK_REWARDS[1]!.reroll,
        })}
      </Txt>
      <LoadState
        status={status}
        rows={6}
        failText={L.dailyFailed}
        retry={() => setTick((n) => n + 1)}
      >
        {data && !dailyRankOpen(data.day) ? (
          <Txt tone="muted" testID="daily-opens">
            {L.dailyOpens({ when: kstMonthDayHour(dailyRankStart(DAILY_RANK_FIRST_DAY)) })}
          </Txt>
        ) : data ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Pill>{L.dailyCount({ n: data.entries.length })}</Pill>
              <Txt v="sm" tone="muted" style={{ flexShrink: 1 }} testID="daily-reset">
                {L.dailyReset({ when: kstMonthDayHour(data.resetAt) })}
              </Txt>
            </View>
            {data.entries.length ? (
              <View testID="daily-list">{data.entries.map((h, i) => row(h, i, i === 0))}</View>
            ) : (
              <Txt tone="muted" testID="daily-empty">
                {L.dailyEmpty}
              </Txt>
            )}
            {data.yesterday ? (
              <View
                testID="daily-yesterday"
                style={{ gap: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.line }}
              >
                <Txt bold accessibilityRole="header">
                  {L.dailyYesterday}
                </Txt>
                <View>
                  {data.yesterday.winners.map((w, i) => row(w.entry, w.rank - 1, i === 0))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </LoadState>
    </Card>
  );
}
