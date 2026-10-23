// T-11-463 기록실 'BEST 11' 탭(웹 Best11.svelte). 4-3-3 그라운드에 시즌마다 포지션별 최고의 은퇴 선수 11명을 세운다. 시즌 중에는
// 잠정(은퇴마다 자리 주인이 바뀐다), 마감 뒤에는 확정. 자리를 누르면 선정 이유 · 세 기둥 · 그 자리 상위 10명이 아래에 나온다.
// 탭을 열 때만 부르고 메모(60초)를 거친다.
import { RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Best11Response } from '@offside/contracts';
import { BEST11_SLOTS, type Best11Slot } from '@offside/contracts/best11-rules';
import { DETAIL_LABEL } from '@offside/contracts/positions';
import { SERVICE_SEASONS, seasonById } from '@offside/contracts/service-seasons';
import { getBest11 } from '@offside/app-core/api/client';
import {
  best11ChangeLine,
  best11Criteria,
  best11Cutline,
  best11Layout,
  best11RankingOf,
  best11Reasons,
  best11SlotName,
  fmtIndex,
} from '@offside/app-core/best11';
import { kstMonthDayHour } from '@offside/app-core/boardText';
import { best11Text as L } from '@offside/app-core/i18n/ko/best11';
import { seasonLabel } from '@offside/app-core/seasonName';
import { tn } from '@offside/game/i18n/names';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { TeamPitch, type PitchCell } from '../../components/TeamPitch';
import { openPublicLegendById } from '../../game/host';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { Card } from '../../ui/Card';
import { Press } from '../../ui/Press';
import { SkeletonFrame, useSkeletonBlock } from '../../ui/Skeleton';
import { Txt } from '../../ui/Txt';
import { useSeasonNow } from '../../ui/useSeasonNow';
import { RecordsSelect } from './RecordsControls';

const LAYOUT = best11Layout();

function Pill({ tone, children }: { tone: 'good' | 'warn' | 'muted'; children: string }) {
  const c = useColors();
  const color = tone === 'muted' ? c.muted : c[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: RADIUS.xs,
        backgroundColor: alpha(tone === 'muted' ? c.ink : color, tone === 'muted' ? 0.06 : 0.12),
      }}
    >
      <Txt v="xs" bold style={{ color }}>
        {children}
      </Txt>
    </View>
  );
}

function Bar({ value }: { value: number }) {
  const c = useColors();
  return (
    <View
      style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}
    >
      <View style={{ width: `${Math.max(2, value)}%`, height: 6, backgroundColor: c.accent }} />
    </View>
  );
}

export default function Best11() {
  const c = useColors();
  const block = useSkeletonBlock();
  const now = useSeasonNow();
  const seasons = SERVICE_SEASONS.filter((s) => s.id >= 1 && s.startsAt <= now);
  const [picked, setPicked] = useState<number | null>(null);
  const season = picked ?? seasons.at(-1)?.id ?? 1;
  const meta = seasonById(season);
  const [data, setData] = useState<Best11Response | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [slot, setSlot] = useState<Best11Slot>('ST');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    void getBest11(season).then((res) => {
      if (!live) return;
      if (res.ok) {
        setData(res.data);
        setStatus('ready');
      } else setStatus('error');
    });
    return () => {
      live = false;
    };
  }, [season, tick]);

  const cells: PitchCell[] = BEST11_SLOTS.map((s) => {
    const p = data?.slots.find((x) => x.slot === s)?.player;
    return p
      ? { name: p.name, rating: p.peak, nation: p.nation, youth: false }
      : { name: L.emptySlot, rating: 0, youth: true };
  });
  const filled = data?.slots.filter((s) => s.player).length ?? 0;
  const current = data?.slots.find((s) => s.slot === slot);
  const player = current?.player ?? null;
  const ranking = data ? best11RankingOf(data, slot) : [];
  const cutline = data ? best11Cutline(data, slot) : null;

  return (
    <Card testID="best11" gap={12}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt v="eyebrow">Best XI</Txt>
          <Txt v="h3">
            {L.title({ season: meta ? seasonLabel(meta.id, meta.name) : String(season) })}
          </Txt>
        </View>
        {seasons.length > 1 ? (
          <RecordsSelect
            testID="best11-season"
            label={L.seasonAria}
            value={season}
            options={seasons.map((s) => ({ value: s.id, label: seasonLabel(s.id, s.name) }))}
            onChange={setPicked}
          />
        ) : null}
      </View>
      <Txt tone="muted" v="sm">
        {L.lead}
      </Txt>
      <LoadState
        status={status}
        failText={L.loadFailed}
        retry={() => setTick((n) => n + 1)}
        skeleton={
          <SkeletonFrame testID="best11-skeleton">
            <View style={[{ height: 480, borderRadius: RADIUS.lg }, block]} />
          </SkeletonFrame>
        }
      >
        {data ? (
          <View style={{ gap: 12 }}>
            <View style={{ gap: 4 }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
              >
                {data.finalAt ? (
                  <Pill tone="good">{L.final}</Pill>
                ) : (
                  <Pill tone="warn">{L.provisional}</Pill>
                )}
                {data.updatedAt ? (
                  <Txt v="xs" tone="muted">
                    {L.updated({ when: kstMonthDayHour(data.updatedAt) })}
                  </Txt>
                ) : null}
              </View>
              <Txt v="xs" tone="muted">
                {data.finalAt
                  ? L.finalAt({ day: kstMonthDayHour(data.finalAt) })
                  : meta?.endsAt
                    ? L.provisionalUntil({ when: kstMonthDayHour(meta.endsAt) })
                    : L.provisionalOpen}
              </Txt>
            </View>
            {!filled ? (
              <Txt tone="muted" testID="best11-empty">
                {L.empty}
              </Txt>
            ) : (
              <>
                <View accessibilityLabel={L.pitchAria}>
                  <TeamPitch
                    formation="4-3-3"
                    layout={LAYOUT}
                    cells={cells}
                    selected={BEST11_SLOTS.indexOf(slot)}
                    onpick={(i) => setSlot(BEST11_SLOTS[i]!)}
                  />
                </View>
                <Txt v="xs" tone="muted" center>
                  {L.pickHint}
                </Txt>
                <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}>
                  <Txt v="xs" tone="muted" bold>
                    {best11SlotName(slot)}
                  </Txt>
                  {player ? (
                    <View
                      testID={`best11-player-${player.careerId}`}
                      style={{
                        gap: 8,
                        padding: 12,
                        borderRadius: RADIUS.md,
                        backgroundColor: c.surface2,
                      }}
                    >
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Press
                          scale={1}
                          style={{ flex: 1 }}
                          onPress={() => void openPublicLegendById(player.careerId)}
                        >
                          <Txt v="h3">{player.name}</Txt>
                          <Txt v="xs" tone="muted">
                            {`${tn(DETAIL_LABEL[player.dpos])} · OVR ${player.peak}`}
                          </Txt>
                        </Press>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Txt v="h2" num tone="accent">
                            {fmtIndex(player.index)}
                          </Txt>
                          <Txt v="xs" tone="muted">
                            {L.index}
                          </Txt>
                        </View>
                      </View>
                      {(
                        [
                          [L.pillarInd, player.ind, 50],
                          [L.pillarTeam, player.team, 30],
                          [L.pillarAward, player.award, 20],
                        ] as const
                      ).map(([label, value, weight]) => (
                        <View
                          key={label}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        >
                          <Txt v="xs" style={{ width: 92 }}>
                            {`${label} ${weight}`}
                          </Txt>
                          <Bar value={value} />
                          <Txt v="xs" num style={{ width: 40, textAlign: 'right' }}>
                            {fmtIndex(value)}
                          </Txt>
                        </View>
                      ))}
                      <Txt v="xs" bold>
                        {L.reasonTitle}
                      </Txt>
                      {best11Reasons(player).map((line, i) => (
                        <Txt key={i} v="sm">
                          {`· ${line}`}
                        </Txt>
                      ))}
                      {current?.since ? (
                        <Txt v="xs" tone="muted">
                          {L.since({ when: kstMonthDayHour(current.since) })}
                        </Txt>
                      ) : null}
                    </View>
                  ) : (
                    <Txt tone="muted">{L.rankEmpty}</Txt>
                  )}
                  <Txt v="h3" style={{ marginTop: 8 }}>
                    {L.rankTitle({ slot: best11SlotName(slot) })}
                  </Txt>
                  <Txt v="xs" tone="muted">
                    {L.rankLead}
                    {cutline !== null ? ` ${L.cutline({ index: fmtIndex(cutline) })}` : ''}
                  </Txt>
                  {ranking.map((e, i) => (
                    <Press
                      key={e.careerId}
                      testID={`best11-rank-${e.careerId}`}
                      scale={1}
                      onPress={() => void openPublicLegendById(e.careerId)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: c.line,
                        backgroundColor: e.held === 'xi' ? alpha(c.good, 0.07) : 'transparent',
                      }}
                    >
                      <Txt num tone="muted" style={{ width: 24, textAlign: 'center' }}>
                        {String(i + 1)}
                      </Txt>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt bold numberOfLines={1} tone={e.held === 'owner' ? 'muted' : 'ink'}>
                          {e.name}
                        </Txt>
                        <Txt v="xs" tone="muted">
                          {`${e.dpos} · ${fmtIndex(e.ind)} / ${fmtIndex(e.team)} / ${fmtIndex(e.award)}`}
                        </Txt>
                      </View>
                      {e.held === 'xi' && e.at ? (
                        <Pill tone="good">{L.heldXi({ slot: best11SlotName(e.at) })}</Pill>
                      ) : null}
                      {e.held === 'owner' ? <Pill tone="muted">{L.heldOwner}</Pill> : null}
                      <Txt num bold>
                        {fmtIndex(e.index)}
                      </Txt>
                    </Press>
                  ))}
                  {ranking.some((e) => e.held === 'owner') ? (
                    <Txt v="xs" tone="muted">
                      {L.heldOwnerNote}
                    </Txt>
                  ) : null}
                </View>
              </>
            )}
            {data.changes.length ? (
              <View style={{ gap: 4 }}>
                <Txt v="h3">{L.changesTitle}</Txt>
                {data.changes.map((ch, i) => (
                  <Txt key={i} v="xs">
                    {`${kstMonthDayHour(ch.at)}  ${best11ChangeLine(ch)}`}
                  </Txt>
                ))}
              </View>
            ) : null}
            <View style={{ gap: 4 }}>
              <Txt v="xs" bold>
                {L.criteriaTitle}
              </Txt>
              {best11Criteria().map((line, i) => (
                <Txt key={i} v="xs" tone="muted">
                  {`· ${line}`}
                </Txt>
              ))}
            </View>
          </View>
        ) : null}
      </LoadState>
    </Card>
  );
}
