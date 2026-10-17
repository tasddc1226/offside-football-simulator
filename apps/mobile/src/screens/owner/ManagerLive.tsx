// T-11-310 감독 시즌 경기 중계(웹 ManagerLive.svelte) — 선수 커리어 경기 중계 시트처럼 한 경기씩 올라오며 승무패 · 승점이
// 쌓인다. 경기 목록은 결산이 정한 승무패를 나눈 연출용이다(managerMatchday). 다 보거나 '결과 바로 보기'를 누르면 결산으로.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { tn } from '@offside/game/i18n/names';
import type { MgrMatch } from '@offside/game/manager';
import { liveStepMs, liveTally } from '@offside/app-core/manager';
import { managerText as M } from '@offside/app-core/i18n/ko/manager';
import { buzz } from '../../game/host';
import { rem } from '../../theme/type';
import { Bump } from '../../sheets/Block';
import { Enter } from '../../sheets/anim';
import { ProgBar, StatGrid } from '../../sheets/parts';
import { ResBadge } from '../../sheets/TickerLine';
import { Btn, Press, Txt } from '../../ui';

export function ManagerLive({
  n,
  club,
  matches,
  onDone,
}: {
  n: number;
  club: string;
  matches: MgrMatch[];
  onDone: () => void;
}) {
  const step = liveStepMs(matches.length);
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finished = shown >= matches.length;

  useEffect(() => {
    if (!matches.length) return;
    timer.current = setInterval(() => setShown((x) => Math.min(matches.length, x + 1)), step);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [matches.length, step]);
  useEffect(() => {
    if (!finished || !timer.current) return;
    clearInterval(timer.current);
    timer.current = null;
    buzz();
  }, [finished]);

  const played = matches.slice(0, shown);
  const t = liveTally(played);
  const cells = [
    { key: 'w', l: M.tallyW, k: t.w },
    { key: 'd', l: M.tallyD, k: t.d },
    { key: 'l', l: M.tallyL, k: t.l },
    { key: 'pts', l: M.tallyPts, k: t.pts },
  ];
  const recent = played.slice(-5).reverse();

  return (
    // T-11-330 감독 시트(PopSheet) 안에 그려서 카드 틀은 두지 않는다.
    <View style={{ gap: 10 }} testID="manager-live">
      <Txt v="eyebrow">{M.liveEyebrow({ n })}</Txt>
      <Txt v="h2" accessibilityRole="header">
        {club}
      </Txt>
      <ProgBar progress={matches.length ? shown / matches.length : 1} fill={step} />
      <Txt
        tone="muted"
        style={{ fontSize: rem(0.75), fontVariant: ['tabular-nums'], marginTop: -6 }}
      >
        {M.liveRound({ rd: shown, total: matches.length })}
      </Txt>
      <StatGrid items={cells.map((x) => ({ key: x.key, l: x.l, v: <Bump value={x.k} /> }))} />
      <View style={{ minHeight: 124, gap: 4 }}>
        {recent.map((m, i) => (
          <Enter key={m.rd} kind="translateY" from={-6} ms={250}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Txt tone="muted" style={{ width: 34, fontSize: rem(0.8125) }}>{`${m.rd}R`}</Txt>
              <View style={{ width: 30 }}>
                <ResBadge res={m.res} />
              </View>
              <Txt
                tone={i ? 'muted' : 'ink'}
                bold={i === 0}
                style={{ flex: 1, fontSize: rem(0.8125), fontVariant: ['tabular-nums'] }}
              >{`${tn(m.opp)} ${m.gf}-${m.ga}`}</Txt>
            </View>
          </Enter>
        ))}
      </View>
      {finished ? (
        <Btn block kind="primary" testID="manager-live-done" onPress={onDone}>
          {M.liveDone}
        </Btn>
      ) : (
        <Press
          testID="manager-live-skip"
          onPress={() => setShown(matches.length)}
          hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
          style={{ alignSelf: 'center', paddingVertical: 6 }}
        >
          <Txt tone="muted" style={{ fontSize: rem(0.75), textDecorationLine: 'underline' }}>
            {M.liveSkip}
          </Txt>
        </Press>
      )}
    </View>
  );
}
