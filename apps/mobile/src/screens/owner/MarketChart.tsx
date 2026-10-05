// T-11-080f 시세 차트(웹 ui/MarketChart.svelte · 시장 지수는 웹 Market.svelte .mk-index).
// 카드 상세: 같은 포지션군 · OVR대 하루 평균 선, 최저~최고 띠, 기준가 점선, 이 선수 거래 점. 영입 시트를 열 때만 부르고(1분 메모),
// 기간을 바꾸면 그 기간만 새로 받는다. 점을 누르면 그날 값을 위에 보여 준다. 색은 국내 증권 관례대로 오름 빨강 · 내림 파랑.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Line as SvgLine, Path } from 'react-native-svg';
import {
  fetchCardTrades,
  fetchMarketChart,
  type MarketCard,
  type MarketChartPoint,
  type MarketChartRange,
} from '@offside/app-core/api/market';
import {
  CHART_COPY,
  chartRanges,
  chartModel,
  dayText,
  marketIndex,
  tradeText,
  type CardTrade,
  type ChartTone,
} from '@offside/app-core/marketChart';
import { ovrBand } from '@offside/contracts/market-value';
import { POS_LABEL } from '@offside/game/pos-label';
import { useColors } from '../../theme/useColors';
import type { Colors } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
import { Press, Txt } from '../../ui';
import { marketChartText as L } from '@offside/app-core/i18n/ko/marketChart';

const chartTone = (c: Colors, tone: ChartTone) =>
  tone === 'up' ? c.up : tone === 'down' ? c.down : c.muted;

const PLOT_H = 132;
const AXIS_W = 40;

/** 차트 위 누를 수 있는 점(28pt 터치 상자 가운데에 작은 원). */
function Hit({
  at,
  label,
  onPress,
  dot,
  testID,
}: {
  at: { left: number; top: number };
  label: string;
  onPress: () => void;
  dot: ViewStyle;
  testID?: string;
}) {
  return (
    <Pressable
      {...(testID ? { testID } : {})}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        position: 'absolute',
        ...at,
        width: 28,
        height: 28,
        marginLeft: -14,
        marginTop: -14,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ borderRadius: 5, borderWidth: 2, ...dot }} />
    </Pressable>
  );
}

/** 이적시장 머리의 시장 지수 한 줄(최근 7일 · 시장 전체). */
export function MarketIndex({ points }: { points: readonly MarketChartPoint[] }) {
  const c = useColors();
  const index = marketIndex(points);
  if (!index) return null;
  const tone = chartTone(c, index.tone);
  return (
    <View
      testID="market-index"
      accessible
      accessibilityLabel={L.indexA11y({ pct: index.pct, change: index.change })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 14,
        backgroundColor: c.surface,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
          {CHART_COPY.index}
        </Txt>
        <Txt style={{ fontFamily: DISPLAY[700], fontSize: rem(1.375) }}>{index.pct}</Txt>
        <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(0.6875) }}>
          {CHART_COPY.indexSub(index.trades)}
        </Txt>
      </View>
      {index.spark.line ? (
        <Svg width={72} height={32} viewBox="0 0 100 100" preserveAspectRatio="none">
          <SvgLine
            x1={0}
            x2={100}
            y1={index.spark.base}
            y2={index.spark.base}
            stroke={c.muted}
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          <Path
            d={index.spark.line}
            fill="none"
            stroke={tone}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      ) : null}
      <Txt style={{ fontSize: rem(0.75), fontWeight: '700', color: tone }}>{index.change}</Txt>
    </View>
  );
}

/** 카드 상세 시세 차트. */
export function MarketChart({ card }: { card: MarketCard }) {
  const c = useColors();
  const band = ovrBand(card.peak);
  const [range, setRange] = useState<MarketChartRange>('week');
  const [points, setPoints] = useState<MarketChartPoint[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [trades, setTrades] = useState<CardTrade[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    let live = true;
    setFailed(false);
    setPick(null);
    void fetchMarketChart(range, { pos: card.pos, band }).then((r) => {
      if (!live) return;
      setFailed(!r.ok);
      setPoints(r.ok ? r.data.points : []);
    });
    return () => {
      live = false;
    };
  }, [range, card.pos, band]);
  // 한 번도 팔린 적 없는 선수(이적 0회)는 거래 기록을 묻지 않는다.
  useEffect(() => {
    if (card.transfers === 0) return;
    let live = true;
    void fetchCardTrades(card.careerId).then((r) => live && setTrades(r.ok ? r.data.trades : []));
    return () => {
      live = false;
    };
  }, [card.careerId, card.transfers]);

  const model = useMemo(
    () => (points ? chartModel(points, trades, range) : null),
    [points, trades, range],
  );
  const tone = model ? chartTone(c, model.tone) : c.muted;
  const plotW = Math.max(0, w - AXIS_W);
  const at = (x: number, y: number) => ({ left: (x / 100) * plotW, top: (y / 100) * PLOT_H });

  const empty = (text: string) => (
    <Txt tone="muted" style={{ fontSize: rem(0.8125), textAlign: 'center', paddingVertical: 28 }}>
      {text}
    </Txt>
  );

  return (
    <View
      testID="market-chart"
      style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 14, gap: 6 }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexShrink: 1 }}>
          <Txt bold style={{ fontSize: rem(0.875) }} accessibilityRole="header">
            {CHART_COPY.title}
          </Txt>
          <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
            {CHART_COPY.group(POS_LABEL[card.pos], band)}
          </Txt>
        </View>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={L.rangeGroup}
          style={{
            flexDirection: 'row',
            gap: 2,
            padding: 2,
            borderRadius: 8,
            backgroundColor: c.surface2,
            alignSelf: 'flex-start',
          }}
        >
          {chartRanges().map(([k, label]) => (
            <Press
              key={k}
              testID={`chart-range-${k}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: range === k }}
              onPress={() => setRange(k)}
              style={{
                minHeight: 30,
                paddingHorizontal: 10,
                justifyContent: 'center',
                borderRadius: 6,
                backgroundColor: range === k ? c.surface : 'transparent',
              }}
            >
              <Txt
                tone={range === k ? 'ink' : 'muted'}
                style={{ fontSize: rem(0.75), fontWeight: '600' }}
              >
                {label}
              </Txt>
            </Press>
          ))}
        </View>
      </View>
      {points === null ? (
        empty(L.loading)
      ) : failed ? (
        empty(CHART_COPY.failed)
      ) : !model ? (
        empty(CHART_COPY.empty)
      ) : (
        <>
          <Txt accessibilityLiveRegion="polite" style={{ fontSize: rem(0.75), fontWeight: '600' }}>
            {pick ?? ' '}
          </Txt>
          <View style={{ height: PLOT_H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
            {plotW > 0 ? (
              <>
                <Svg
                  width={plotW}
                  height={PLOT_H}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute' }}
                >
                  {model.band ? <Path d={model.band} fill={tone} fillOpacity={0.12} /> : null}
                  <SvgLine
                    x1={0}
                    x2={100}
                    y1={model.base}
                    y2={model.base}
                    stroke={c.muted}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                  {model.line ? (
                    <Path
                      d={model.line}
                      fill="none"
                      stroke={tone}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                </Svg>
                {(
                  [
                    [8, model.top],
                    [model.base, L.baseLabel],
                    [92, model.bottom],
                  ] as const
                ).map(([y, label]) => (
                  <Txt
                    key={label}
                    tone="muted"
                    style={{
                      position: 'absolute',
                      left: plotW + 6,
                      top: (y / 100) * PLOT_H - 7,
                      fontSize: rem(0.625),
                    }}
                  >
                    {label}
                  </Txt>
                ))}
                {model.days.map((d) => (
                  <Hit
                    key={d.p.day}
                    at={at(d.x, d.y)}
                    label={dayText(d.p)}
                    onPress={() => setPick(dayText(d.p))}
                    dot={{ width: 7, height: 7, borderColor: tone, backgroundColor: c.surface }}
                  />
                ))}
                {model.dots.map((d, i) => (
                  <Hit
                    key={i}
                    testID="chart-trade"
                    at={at(d.x, d.y)}
                    label={tradeText(d.t)}
                    onPress={() => setPick(tradeText(d.t))}
                    dot={{
                      width: 10,
                      height: 10,
                      borderColor: c.surface,
                      backgroundColor: c.accent,
                    }}
                  />
                ))}
              </>
            ) : null}
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginRight: AXIS_W,
              gap: 6,
            }}
          >
            <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
              {model.from}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
              {model.line ? (
                <>
                  <View style={{ width: 12, height: 2, backgroundColor: c.muted }} />
                  <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
                    {CHART_COPY.legendLine}
                  </Txt>
                </>
              ) : null}
              {model.dots.length ? (
                <>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: c.accent,
                      marginLeft: 6,
                    }}
                  />
                  <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
                    {CHART_COPY.legendDot}
                  </Txt>
                </>
              ) : null}
            </View>
            <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
              {model.to}
            </Txt>
          </View>
        </>
      )}
    </View>
  );
}
