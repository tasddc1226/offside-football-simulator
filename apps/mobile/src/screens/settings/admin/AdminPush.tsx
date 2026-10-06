import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { PushPerformance, PushMetrics } from '@offside/contracts';
import { fetchPushPerformance } from '@offside/app-core/api/admin';
import { kstDateTime as kst } from '@offside/app-core/boardText';
import {
  PUSH_CATEGORY_LABELS as labels,
  PUSH_METRIC_LABELS,
  pushClickRate,
  PUSH_METRICS_HELP,
  PUSH_TARGET_HELP,
  PUSH_RECEIPT_HELP,
} from '@offside/app-core/pushPerformance';
import { Txt as BaseTxt, type TxtProps } from '../../../ui/Txt';
import { Btn } from '../../../ui/Btn';
import { Press } from '../../../ui/Press';
import { useColors } from '../../../theme/useColors';
import { Seg, TabOpt } from '../../board/parts';

function Txt({ style, ...props }: TxtProps) {
  return <BaseTxt {...props} style={[{ lineHeight: undefined }, style]} />;
}
function ResultRow({
  item,
  title,
  subtitle,
}: {
  item: PushMetrics;
  title: string;
  subtitle?: string;
}) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.line }}>
      <Press
        accessibilityLabel={`${title}, 클릭률 ${pushClickRate(item)}, 상세 결과 ${expanded ? '접기' : '보기'}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={{ paddingVertical: 12, gap: 8, minHeight: 48 }}
      >
        <Txt bold>{title}</Txt>
        {subtitle ? <Txt tone="muted">{subtitle}</Txt> : null}
        <Txt>{`클릭률 ${pushClickRate(item)} · 클릭 ${item.clicked.toLocaleString()} · 이동 ${item.targetOpened.toLocaleString()}`}</Txt>
        <Txt tone="muted">{`접수 ${item.accepted.toLocaleString()} · 전달 확인 ${item.confirmed.toLocaleString()} · ${expanded ? '접기' : '상세 보기'}`}</Txt>
      </Press>
      {expanded ? (
        <View style={{ gap: 8, paddingBottom: 12 }}>
          {PUSH_METRIC_LABELS.map((metric) => (
            <View
              key={metric.key}
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Txt tone="muted">{metric.label}</Txt>
              <Txt>{item[metric.key].toLocaleString()}</Txt>
            </View>
          ))}
          <Txt tone="muted">{`접수된 알림 ${item.acceptedRecipients.toLocaleString()} · 클릭한 알림 ${item.clicked.toLocaleString()}`}</Txt>
        </View>
      ) : null}
    </View>
  );
}

export default function AdminPush() {
  const c = useColors();
  const [days, setDays] = useState(7);
  const [tests, setTests] = useState(false);
  const [data, setData] = useState<PushPerformance | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [help, setHelp] = useState(false);
  const [daily, setDaily] = useState(false);
  const revision = useRef(0);
  const page = useRef(0);
  const through = useRef<string | undefined>(undefined);
  const load = useCallback(
    async (fresh = false, more = false) => {
      const rev = ++revision.current;
      setBusy(true);
      setError('');
      const next = more ? page.current + 1 : 0;
      const result = await fetchPushPerformance(
        days,
        tests,
        next,
        fresh,
        more ? through.current : undefined,
      );
      if (rev !== revision.current) return;
      setBusy(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      page.current = next;
      through.current = result.data.cohortThrough;
      setData((old) =>
        more && old
          ? { ...result.data, campaigns: [...old.campaigns, ...result.data.campaigns] }
          : result.data,
      );
    },
    [days, tests],
  );
  useEffect(() => {
    setData(null);
    void load();
    return () => {
      revision.current++;
    };
  }, [load]);
  const stats = data
    ? [
        [
          '발송 접수',
          data.totals.accepted.toLocaleString(),
          `전달 확인 ${data.totals.confirmed.toLocaleString()}`,
        ],
        [
          '클릭률',
          pushClickRate(data.totals),
          `클릭 ${data.totals.clicked} / 접수 알림 ${data.totals.acceptedRecipients}`,
        ],
        ['연결 화면 이동', data.totals.targetOpened.toLocaleString(), '클릭 후 24시간'],
        [
          '실패 / 결과 불명',
          `${data.totals.failed} / ${data.totals.unknown}`,
          `취소 ${data.totals.cancelled} · 진행 중 ${data.totals.pending}`,
        ],
      ]
    : [];
  return (
    <View testID="admin-push" style={{ gap: 14 }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Txt v="h2" accessibilityRole="header">
          앱 푸시
        </Txt>
        <Btn sm disabled={busy} onPress={() => void load(true)}>
          {busy ? '불러오는 중…' : '새로고침'}
        </Btn>
      </View>
      <Seg cols={3} label="푸시 집계 기간">
        {[7, 30, 90].map((n) => (
          <TabOpt
            key={n}
            testID={`push-period-${n}`}
            title={`최근 ${n}일`}
            selected={days === n}
            onPress={() => setDays(n)}
          />
        ))}
      </Seg>
      <Press
        accessibilityState={{ selected: tests, disabled: busy }}
        disabled={busy}
        onPress={() => setTests(!tests)}
        style={{
          minHeight: 48,
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 10,
          padding: 12,
        }}
      >
        <Txt>{`테스트 푸시 ${tests ? '포함' : '제외'}`}</Txt>
      </Press>
      {error ? (
        <>
          <Txt tone="bad" accessibilityLiveRegion="polite">
            {error}
          </Txt>
          <Btn disabled={busy} onPress={() => void load(true)}>
            다시 시도
          </Btn>
        </>
      ) : null}
      {busy && !data ? (
        <Txt tone="muted" accessibilityLiveRegion="polite">
          발송 결과를 불러오는 중…
        </Txt>
      ) : null}
      {data ? (
        <>
          <Txt tone="muted">{`${kst(data.generatedAt)} 기준 · KST · 1분 캐시`}</Txt>
          <Txt tone="muted">
            클릭·이동은 업데이트된 앱에서 수집해요. 업데이트 전 클릭은 포함되지 않아요.
          </Txt>
          <View style={{ gap: 10 }}>
            {stats.map(([label, value, sub]) => (
              <View
                key={label}
                style={{
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: 12,
                  padding: 12,
                  gap: 4,
                }}
              >
                <Txt tone="muted">{label}</Txt>
                <Txt v="h2" bold>
                  {value}
                </Txt>
                <Txt tone="muted">{sub}</Txt>
              </View>
            ))}
          </View>
          <Press
            accessibilityState={{ expanded: help }}
            onPress={() => setHelp(!help)}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Txt bold>집계 기준 {help ? '접기' : '보기'}</Txt>
          </Press>
          {help ? (
            <View style={{ gap: 8 }}>
              <Txt tone="muted">{PUSH_METRICS_HELP}</Txt>
              <Txt tone="muted">{PUSH_RECEIPT_HELP}</Txt>
              <Txt tone="muted">{PUSH_TARGET_HELP}</Txt>
              <Txt tone="muted">{`알림 생성일을 기준으로 묶어요. 추적 시작: ${kst(data.trackingStartedAt)}. 이전 발송은 남아 있는 결과만 보여요. 클릭 추적은 업데이트된 앱에서 시작돼요. 기록은 90일 보관하며, 계정을 삭제하면 함께 지워져요.`}</Txt>
            </View>
          ) : null}
          <Txt v="h3" accessibilityRole="header">
            종류별 성과
          </Txt>
          {data.categories.length ? (
            data.categories.map((item) => (
              <ResultRow key={item.category} item={item} title={labels[item.category]} />
            ))
          ) : (
            <Txt tone="muted">이 기간에 발송된 푸시가 없어요.</Txt>
          )}
          {data.daily.length ? (
            <>
              <Press
                accessibilityState={{ expanded: daily }}
                onPress={() => setDaily(!daily)}
                style={{ minHeight: 48, justifyContent: 'center' }}
              >
                <Txt bold>일별 추이 {daily ? '접기' : '보기'}</Txt>
              </Press>
              {daily
                ? data.daily.map((day) => (
                    <View key={day.day} style={{ gap: 4 }}>
                      <Txt bold>{day.day}</Txt>
                      <Txt tone="muted">{`접수 ${day.accepted} · 클릭 ${day.clicked} · 이동 ${day.targetOpened}`}</Txt>
                    </View>
                  ))
                : null}
            </>
          ) : null}
          <Txt v="h3" accessibilityRole="header">
            발송별 결과
          </Txt>
          <Txt tone="muted">최근 발송부터 보여요. 각 항목을 누르면 전체 결과를 볼 수 있어요.</Txt>
          {data.campaigns.length ? (
            data.campaigns.map((item) => (
              <ResultRow
                key={item.id}
                item={item}
                title={item.title}
                subtitle={`${labels[item.category]} · ${kst(item.createdAt)}`}
              />
            ))
          ) : (
            <Txt tone="muted">발송 기록이 없어요.</Txt>
          )}
          {data.hasMore ? (
            <Btn block disabled={busy} onPress={() => void load(false, true)}>
              더 보기
            </Btn>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
