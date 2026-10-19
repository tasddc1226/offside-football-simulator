import { RADIUS } from '@offside/app-core/design-tokens';
import { useCallback, useEffect, useRef, useState } from 'react';
import AdminCupPush from './AdminCupPush';
import { View } from 'react-native';
import type { PushPerformance, PushMetrics, PushCategory } from '@offside/contracts';
import { fetchPushPerformance } from '@offside/app-core/api/admin';
import { kstDateTime as kst } from '@offside/app-core/boardText';
import {
  PUSH_CATEGORY_LABELS as labels,
  PUSH_METRIC_LABELS,
  pushClickRate,
  pushStatus,
  pushAdminText as L,
  retentionText as R,
  RETENTION_METRICS,
} from '@offside/app-core/pushPerformance';
import { Txt as BaseTxt, type TxtProps } from '../../../ui/Txt';
import { Btn } from '../../../ui/Btn';
import { Press } from '../../../ui/Press';
import { useColors } from '../../../theme/useColors';

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
        accessibilityLabel={`${title}, ${L.details}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={{ paddingVertical: 12, gap: 8, minHeight: 48 }}
      >
        <Txt bold>{title}</Txt>
        {subtitle ? <Txt tone="muted">{subtitle}</Txt> : null}
        <Txt>{`${L.deviceAccepted} ${item.accepted.toLocaleString()}`}</Txt>
        {pushStatus(item) ? (
          <Txt tone={item.failed + item.unknown > 0 ? 'bad' : 'muted'}>{pushStatus(item)}</Txt>
        ) : null}
        <Txt tone="muted">{expanded ? L.collapse : L.details}</Txt>
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
          <Txt>{`${L.clickRate} ${pushClickRate(item)}`}</Txt>
          <Txt tone="muted">{`${L.acceptedNotifications} ${item.acceptedRecipients.toLocaleString()} · ${L.clicked} ${item.clicked.toLocaleString()} · ${L.targetOpened} ${item.targetOpened.toLocaleString()}`}</Txt>
          {item.failed + item.unknown + item.cancelled > 0 ? (
            <Txt tone="muted">{L.failureHelp}</Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function AdminPush() {
  const c = useColors();
  const [period, setPeriod] = useState('7');
  const [category, setCategory] = useState<PushCategory | undefined>();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [issues, setIssues] = useState(false);
  const [tests, setTests] = useState(false);
  const [data, setData] = useState<PushPerformance | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [help, setHelp] = useState(false);
  const [analysis, setAnalysis] = useState(false);
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
        period === 'yesterday' ? 1 : Number(period),
        tests,
        next,
        fresh,
        more ? through.current : undefined,
        { previous: period === 'yesterday', category, issues },
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
          ? {
              ...result.data,
              campaigns: [...old.campaigns, ...result.data.campaigns],
              cups: [...(old.cups ?? []), ...(result.data.cups ?? [])],
            }
          : result.data,
      );
    },
    [period, tests, category, issues],
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
          L.deviceAccepted,
          data.totals.accepted.toLocaleString(),
          `${L.providerConfirmed} ${data.totals.confirmed.toLocaleString()}`,
        ],
        [
          `${L.failed} / ${L.unknown}`,
          `${data.totals.failed} / ${data.totals.unknown}`,
          `${L.cancelled} ${data.totals.cancelled}`,
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
          {L.title}
        </Txt>
        <Btn sm disabled={busy} onPress={() => void load(true)}>
          {busy ? L.loading : L.refresh}
        </Btn>
      </View>
      <View
        accessibilityLabel={L.period}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
      >
        {(
          [
            ['1', L.today],
            ['yesterday', L.yesterday],
            ['7', L.week],
            ['30', L.month],
            ['90', L.quarter],
          ] as const
        ).map(([value, label]) => (
          <Press
            key={value}
            testID={`push-period-${value}`}
            accessibilityState={{ selected: period === value, disabled: busy }}
            disabled={busy}
            onPress={() => setPeriod(value)}
            style={{
              minHeight: 48,
              minWidth: 48,
              padding: 10,
              borderWidth: 1,
              borderColor: period === value ? c.ink : c.line,
              borderRadius: RADIUS.sm,
              justifyContent: 'center',
            }}
          >
            <Txt>{label}</Txt>
          </Press>
        ))}
      </View>
      <Btn
        disabled={busy}
        onPress={() => setCategoryOpen(!categoryOpen)}
      >{`${L.category}: ${category ? labels[category] : L.all}`}</Btn>
      {categoryOpen ? (
        <View style={{ gap: 8 }}>
          {(['', ...Object.keys(labels)] as const).map((value) => (
            <Press
              key={value}
              accessibilityState={{ selected: (category ?? '') === value, disabled: busy }}
              disabled={busy}
              onPress={() => {
                setCategory(value ? (value as PushCategory) : undefined);
                setCategoryOpen(false);
              }}
              style={{ minHeight: 48, justifyContent: 'center', padding: 8 }}
            >
              <Txt>{value ? labels[value as PushCategory] : L.all}</Txt>
            </Press>
          ))}
        </View>
      ) : null}
      <Press
        accessibilityRole="checkbox"
        accessibilityState={{ checked: tests, disabled: busy }}
        disabled={busy}
        onPress={() => setTests(!tests)}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Txt>{`${tests ? '☑' : '☐'} ${L.tests}`}</Txt>
      </Press>
      {error ? (
        <>
          <Txt tone="bad" accessibilityLiveRegion="polite">
            {error}
          </Txt>
          <Btn disabled={busy} onPress={() => void load(true)}>
            {L.retry}
          </Btn>
        </>
      ) : null}
      {busy && !data ? (
        <Txt tone="muted" accessibilityLiveRegion="polite">
          {L.loading}
        </Txt>
      ) : null}
      {data ? (
        <>
          <Txt tone="muted">{`${kst(data.generatedAt)} ${L.asOf}\n${L.range}: ${kst(data.from)} – ${kst(data.cohortThrough)}`}</Txt>
          <Txt v="h3" accessibilityRole="header">
            {L.summary}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {stats.map(([label, value, sub]) => (
              <View
                key={label}
                style={{
                  flex: 1,
                  minWidth: 110,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: RADIUS.md,
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
          <Txt>
            {pushStatus({ ...data.totals, failed: 0, unknown: 0, cancelled: 0 }) ||
              `${L.pending} 0`}
          </Txt>
          <Press
            accessibilityState={{ expanded: help }}
            onPress={() => setHelp(!help)}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Txt bold>{`${L.help} ${help ? L.collapse : L.expand}`}</Txt>
          </Press>
          {help ? (
            <View style={{ gap: 8 }}>
              <Txt tone="muted">{L.queueHelp}</Txt>
              <Txt tone="muted">{L.receiptHelp}</Txt>
              <Txt tone="muted">{L.metricsHelp}</Txt>
              <Txt tone="muted">{L.failureHelp}</Txt>
            </View>
          ) : null}
          <Txt v="h3" accessibilityRole="header">
            {L.recent}
          </Txt>
          <Press
            accessibilityRole="checkbox"
            accessibilityState={{ checked: issues, disabled: busy }}
            disabled={busy}
            onPress={() => setIssues(!issues)}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Txt>{`${issues ? '☑' : '☐'} ${L.issues}`}</Txt>
          </Press>
          {issues ? <Txt tone="muted">{L.issuesHelp}</Txt> : null}
          <Txt tone="muted">{L.recentHelp}</Txt>
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
            <Txt tone="muted">{L.empty}</Txt>
          )}
          {data.hasMore ? (
            <Btn block disabled={busy} onPress={() => void load(false, true)}>
              {L.more}
            </Btn>
          ) : null}
          <Press
            accessibilityState={{ expanded: analysis }}
            onPress={() => setAnalysis(!analysis)}
            style={{
              minHeight: 48,
              justifyContent: 'center',
              borderTopWidth: 1,
              borderTopColor: c.line,
            }}
          >
            <Txt bold>{`${L.analysis} ${analysis ? L.collapse : L.expand}`}</Txt>
          </Press>
          {analysis ? (
            <View style={{ gap: 16 }}>
              <Txt>{`${L.clickRate} ${pushClickRate(data.totals)} · ${L.targetOpened} ${data.totals.targetOpened}`}</Txt>
              <AdminCupPush items={data.cups} />
              <View
                testID="career-retention-performance"
                style={{ gap: 12, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 16 }}
              >
                <Txt v="h3" accessibilityRole="header">
                  {R.title}
                </Txt>
                <Txt tone="muted">{R.policy}</Txt>
                {(data.retention ?? []).length ? (
                  data.retention!.map((item) => (
                    <View
                      key={item.stage}
                      style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}
                    >
                      <Txt bold>
                        {R[item.stage === 1 ? 'stage1' : item.stage === 2 ? 'stage2' : 'stage3']}
                      </Txt>
                      {RETENTION_METRICS.map((key) => (
                        <View
                          key={key}
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <Txt tone="muted" style={{ flexShrink: 1 }}>
                            {R[key]}
                          </Txt>
                          <Txt>{item[key].toLocaleString()}</Txt>
                        </View>
                      ))}
                    </View>
                  ))
                ) : (
                  <Txt tone="muted">{R.empty}</Txt>
                )}
                <Txt tone="muted">{R.help}</Txt>
              </View>

              <Txt v="h3" accessibilityRole="header">
                {L.categories}
              </Txt>
              {data.categories.map((item) => (
                <ResultRow key={item.category} item={item} title={labels[item.category]} />
              ))}
              <Txt v="h3" accessibilityRole="header">
                {L.daily}
              </Txt>
              {data.daily.map((day) => (
                <View key={day.day}>
                  <Txt bold>{day.day}</Txt>
                  <Txt tone="muted">{`${L.deviceAccepted} ${day.accepted} · ${L.clicked} ${day.clicked} · ${L.targetOpened} ${day.targetOpened}`}</Txt>
                </View>
              ))}
              <Txt tone="muted">{L.targetHelp}</Txt>
              <Txt tone="muted">{`${L.trackingHelp} ${L.trackingStart}: ${kst(data.trackingStartedAt)}`}</Txt>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
