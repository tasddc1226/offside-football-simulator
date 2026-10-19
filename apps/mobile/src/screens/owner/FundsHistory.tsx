// 구단 자금 내역(웹 FundsHistory.svelte) — 구단주 화면의 '구단 자금' 칸으로 연다. 지금 자금, 들어온·나간 자금 합(출처별),
// 그리고 방출·판매·영입·구단 자금 사용을 한국 시각 날짜로 묶어 최근 순으로 보여 준다(30줄씩 더 보기).
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { FundsHistoryEntry, FundsHistoryResponse } from '@offside/contracts';
import {
  fetchFundsHistory,
  fundsHistoryDays,
  fundsHistoryTotals,
} from '@offside/app-core/fundsHistory';
import { fundsText } from '@offside/app-core/market';
import { fundsHistoryText as H } from '@offside/app-core/i18n/ko/fundsHistory';
import { localCareerNames } from '@offside/game/hof-store';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Screen, Topbar, Txt } from '../../ui';
import { useRefresh } from '../../ui/refresh';

type Totals = ReturnType<typeof fundsHistoryTotals>['income'];

/** 들어온·나간 자금 칸(웹 .fh-totals div). */
function TotalBox({
  label,
  t,
  plus,
  testID,
}: {
  label: string;
  t: Totals;
  plus?: boolean;
  testID: string;
}) {
  const c = useColors();
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        minWidth: 0,
        gap: 2,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: RADIUS.md,
        backgroundColor: c.surface2,
      }}
    >
      <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
        {label}
      </Txt>
      <Txt
        tone={plus ? 'good' : 'ink'}
        style={{
          fontFamily: DISPLAY[700],
          fontSize: rem(FONT.title3),
          fontVariant: ['tabular-nums'],
        }}
      >
        {t.total}
      </Txt>
      {t.lines.map((l) => (
        <Txt key={l.label} tone="muted" style={{ fontSize: rem(FONT.label) }}>
          {`${l.label} ${l.value}`}
        </Txt>
      ))}
    </View>
  );
}

export default function FundsHistory() {
  const c = useColors();
  const local = useMemo(() => localCareerNames(), []);
  const [res, setRes] = useState<FundsHistoryResponse | null>(null);
  const [items, setItems] = useState<FundsHistoryEntry[]>([]);
  const [page, setPage] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retryN, setRetryN] = useState(0);
  const { tick, track } = useRefresh();

  async function load(next: number) {
    setLoading(true);
    setFailed(false);
    const r = await track(fetchFundsHistory(next));
    setLoading(false);
    if (!r.ok) return setFailed(true);
    setRes(r.data);
    setItems((prev) => (next === 0 ? r.data.items : [...prev, ...r.data.items]));
    setPage(next);
  }

  useEffect(() => {
    void load(0);
  }, [tick, retryN]);

  const days = useMemo(() => fundsHistoryDays(items, local), [items, local]);
  const totals = res ? fundsHistoryTotals(res.totals) : null;
  const badge = (kind: FundsHistoryEntry['kind']) =>
    kind === 'sold' || kind === 'bonus' ? c.accentText : kind === 'released' ? c.bad : c.ink;
  const small = { fontSize: rem(FONT.body2) } as const;

  return (
    <Screen>
      <Topbar />
      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <Txt v="eyebrow">{H.eyebrow}</Txt>
        <Txt v="h1" accessibilityRole="header">
          {H.title}
        </Txt>
      </View>

      {failed && !res ? (
        <Card gap={10}>
          <Txt tone="muted">{H.loadFail}</Txt>
          <Btn sm onPress={() => setRetryN((n) => n + 1)}>
            {H.retry}
          </Btn>
        </Card>
      ) : !res || !totals ? (
        <Card>
          <Txt tone="muted">…</Txt>
        </Card>
      ) : (
        <>
          <Card gap={12} testID="funds-summary">
            <View style={{ gap: 2 }}>
              <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                {H.balance}
              </Txt>
              <Txt
                testID="funds-balance"
                style={{
                  fontFamily: DISPLAY[700],
                  fontSize: rem(FONT.title1),
                  color: c.accentText,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {fundsText(res.balance)}
              </Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TotalBox label={H.income} t={totals.income} plus testID="funds-income" />
              <TotalBox label={H.spending} t={totals.spending} testID="funds-spending" />
            </View>
          </Card>

          <View style={{ gap: 8 }} accessibilityLabel={H.log}>
            {days.length ? (
              days.map((g) => (
                <View key={g.day} style={{ gap: 8 }}>
                  <Txt
                    tone="muted"
                    bold
                    style={{ fontSize: rem(FONT.label), marginTop: 6, paddingHorizontal: 4 }}
                  >
                    {g.label}
                  </Txt>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: 'transparent',
                      borderRadius: RADIUS.md,
                      backgroundColor: c.surface,
                    }}
                  >
                    {g.rows.map((r, i) => (
                      <View
                        key={r.id}
                        testID={`funds-row-${r.kind}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderTopWidth: i ? 1 : 0,
                          borderTopColor: c.line,
                        }}
                      >
                        <View
                          style={{
                            minWidth: 36,
                            paddingVertical: 3,
                            paddingHorizontal: 6,
                            borderRadius: RADIUS.xs,
                            alignItems: 'center',
                            backgroundColor: c.surface2,
                          }}
                        >
                          <Txt
                            style={{
                              fontSize: rem(FONT.caption2),
                              fontWeight: '700',
                              color: badge(r.kind),
                            }}
                          >
                            {r.badge}
                          </Txt>
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Txt numberOfLines={1} style={small}>
                            {r.title}
                          </Txt>
                          <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
                            {r.sub}
                          </Txt>
                        </View>
                        <Txt tone={r.plus ? 'good' : 'ink'} bold num style={small}>
                          {r.amount}
                        </Txt>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <Card>
                <Txt tone="muted" testID="funds-empty" style={small}>
                  {H.empty}
                </Txt>
              </Card>
            )}
            {res.hasMore ? (
              <Btn block testID="funds-more" disabled={loading} onPress={() => void load(page + 1)}>
                {H.more}
              </Btn>
            ) : null}
            {failed ? (
              <Txt tone="muted" style={small}>
                {H.loadFail}
              </Txt>
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}
