// T-11-263 매출(웹 admin/AdminRevenue.svelte): 기간(오늘 · 7일 · 30일 · 90일) 합 · 날짜별 · 상품별 · 스토어별 · 최근 결제.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as api from '@offside/app-core/api/admin';
import type { AdminRevenue as Revenue } from '@offside/app-core/api/admin';
import {
  ADMIN_REVENUE_DAYS,
  REVENUE_NOTE,
  adsSince,
  nick,
  periodLabel,
  productLine,
  productName,
  recentLine,
  revenueSummary,
  storeName,
  won,
} from '@offside/app-core/admin/users';
import { kstDateTime as kst } from '@offside/app-core/boardText';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Txt } from '../../../ui/Txt';
import { Seg, TabOpt } from '../../board/parts';

export default function AdminRevenue() {
  const c = useColors();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Revenue | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');

  async function load(d = days) {
    setStatus('loading');
    const r = await api.fetchRevenue(d);
    if (!r.ok) {
      setStatus('error');
      return;
    }
    setData(r.data);
    setStatus('ready');
  }
  useEffect(() => void load(), []);

  const small = { fontSize: rem(0.8125) } as const;
  const tiny = { fontSize: rem(0.75) } as const;
  const row = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: c.line,
  } as const;
  const none = (
    <Txt tone="muted" style={small}>
      없어요.
    </Txt>
  );
  const r = data;
  const max = r ? Math.max(1, ...r.daily.map((d) => d.krw)) : 1;
  return (
    <View testID="admin-revenue" style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="h2" accessibilityRole="header">
          매출
        </Txt>
        <Btn sm testID="refresh-revenue" onPress={() => void load()}>
          새로고침
        </Btn>
      </View>
      <Seg cols={4} label="매출 기간">
        {ADMIN_REVENUE_DAYS.map((n) => (
          <TabOpt
            key={n}
            tight
            title={periodLabel(n)}
            selected={days === n}
            testID={`revenue-days-${n}`}
            onPress={() => {
              setDays(n);
              void load(n);
            }}
          />
        ))}
      </Seg>
      <Txt tone="muted" style={tiny}>
        {REVENUE_NOTE}
      </Txt>
      <LoadState status={status} failText="매출을 불러오지 못했어요." retry={() => void load()}>
        {r ? (
          <>
            <Txt tone="muted" style={tiny}>
              {`${kst(r.generatedAt)} 기준 · ${r.days === 1 ? '오늘' : `최근 ${r.days}일`}`}
            </Txt>
            <View testID="revenue-summary">
              {revenueSummary(r).map(([label, v]) => (
                <View key={label} style={row}>
                  <Txt tone="muted" style={small}>
                    {label}
                  </Txt>
                  <Txt num style={[small, { flexShrink: 1, textAlign: 'right' }]}>
                    {v}
                  </Txt>
                </View>
              ))}
            </View>
            {adsSince(r) ? (
              <Txt tone="muted" style={tiny}>
                {adsSince(r)}
              </Txt>
            ) : null}
            {r.daily.length > 1 ? (
              <View style={{ gap: 6 }}>
                <Txt bold style={small}>
                  날짜별 매출
                </Txt>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80 }}>
                  {r.daily.map((d) => (
                    <View
                      key={d.day}
                      accessibilityLabel={`${d.day} ${won(d.krw)}`}
                      style={{
                        flex: 1,
                        height: `${Math.max(1, Math.round((d.krw / max) * 100))}%`,
                        backgroundColor: c.accent,
                        borderTopLeftRadius: 2,
                        borderTopRightRadius: 2,
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            <View style={{ gap: 4 }}>
              <Txt bold style={small}>
                상품별
              </Txt>
              {r.products.length
                ? r.products.map((p) => (
                    <View key={p.productId} style={row}>
                      <Txt style={small}>{productName(p.productId)}</Txt>
                      <Txt num bold style={small}>
                        {productLine(p)}
                      </Txt>
                    </View>
                  ))
                : none}
            </View>
            <View style={{ gap: 4 }}>
              <Txt bold style={small}>
                스토어별
              </Txt>
              {r.stores.length
                ? r.stores.map((s) => (
                    <View key={s.store} style={row}>
                      <Txt style={small}>{storeName(s.store)}</Txt>
                      <Txt num bold style={small}>
                        {`${s.count}건 · ${won(s.krw)}`}
                      </Txt>
                    </View>
                  ))
                : none}
            </View>
            <View style={{ gap: 4 }}>
              <Txt bold style={small}>
                최근 결제
              </Txt>
              {r.recent.length
                ? r.recent.map((x, i) => (
                    <View
                      key={i}
                      style={[row, { flexDirection: 'column', alignItems: 'flex-start' }]}
                    >
                      <Txt style={small}>{productName(x.productId)}</Txt>
                      <Txt tone="muted" style={tiny}>
                        {`${nick(x.nickname)} · ${recentLine(x)}`}
                      </Txt>
                    </View>
                  ))
                : none}
            </View>
          </>
        ) : null}
      </LoadState>
    </View>
  );
}
