// 시즌 진행 게이지(웹 SeasonGauge.svelte). 시즌은 정한 날짜가 아니라 유저들이 끝까지 뛴 커리어로 찬다
// (contracts season-gauge.ts). 90%에 닿아 마감이 정해지면 카운트다운으로 바뀐다. 진행 중인 시즌이 없으면 그리지 않는다.
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { seasonGaugeLines, type SeasonGauge as Gauge } from '@offside/app-core/seasonGauge';
import { loadSeasonGauge } from '@offside/app-core/seasonSchedule';
import { num as fmt } from '@offside/app-core/teamText';
import { alpha } from '../../theme/colors';
import { num, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Card, Txt } from '../../ui';
import { useOnPull } from '../../ui/refresh';

export function SeasonGauge() {
  const c = useColors();
  const [gauge, setGauge] = useState<Gauge | null>(null);
  const [now, setNow] = useState(Date.now());
  const reload = useRef<() => Promise<void>>(async () => {});
  useOnPull(() => reload.current());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await loadSeasonGauge();
      if (!alive) return;
      if (r.ok) setGauge(r.data.gauge);
      setNow(Date.now());
    };
    reload.current = load;
    void load();
    // 서버는 30분마다 세고 엣지는 5분 담는다. 카운트다운은 분 단위라 30초마다 시계만 다시 본다.
    const poll = setInterval(() => {
      if (AppState.currentState === 'active') void load();
    }, 5 * 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void load();
    });
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
      sub.remove();
    };
  }, []);

  if (!gauge) return null;
  const lines = seasonGaugeLines(gauge, now, fmt);
  const locked = !!gauge.endsAt;
  return (
    <Card gap={8} testID="season-gauge">
      <View
        style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <Txt v="eyebrow">Season progress</Txt>
        <Txt
          testID="season-gauge-pct"
          style={[num(700), { fontSize: rem(1.5), color: c.accentText }]}
        >
          {`${lines.pct}%`}
        </Txt>
      </View>
      <Txt
        v="h2"
        accessibilityRole="header"
        style={{ fontSize: rem(1.0625), ...(locked ? { color: c.accentText } : null) }}
      >
        {lines.countdown ?? lines.title}
      </Txt>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={lines.aria}
        accessibilityValue={{ min: 0, max: 100, now: lines.pct }}
        style={{ height: 12, borderRadius: 999, backgroundColor: c.surface2, overflow: 'hidden' }}
      >
        <View
          style={{
            width: `${lines.pct}%`,
            height: '100%',
            borderRadius: 999,
            backgroundColor: c.accent,
          }}
        />
        {/* 90%(마감이 정해지는 자리) 눈금 */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '90%',
            width: 2,
            backgroundColor: alpha(c.ink, 0.4),
          }}
        />
      </View>
      <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
        {lines.stats}
      </Txt>
      <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
        {lines.note}
      </Txt>
    </Card>
  );
}
