// T-11-376 지난 시즌 선수 급여 막대와 급여 안내 시트(웹 team/TeamLineup.svelte 급여 막대 · SalaryGuide.svelte).
import { useState } from 'react';
import { View } from 'react-native';
import type { salaryBar } from '@offside/app-core/teamOwner';
import { salaryExamples, salaryRows } from '@offside/app-core/salary';
import { salaryText as S } from '@offside/app-core/i18n/ko/salary';
import { teamCoreText as TC } from '@offside/app-core/i18n/ko/teamCore';
import { useColors } from '../../theme/useColors';
import { Btn, Press, Row, Txt } from '../../ui';
import { PopSheet } from '../../ui/PopSheet';

type Bar = NonNullable<ReturnType<typeof salaryBar>>;

export function SalaryBar({ salary }: { salary: Bar }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const tone = salary.state === 'over' ? c.bad : salary.state === 'ok' ? c.good : c.warn;
  return (
    <>
      <Press
        testID="team-salary"
        accessibilityRole="button"
        accessibilityLabel={`${salary.label} · ${TC.salaryLeft({ n: salary.left })} · ${TC.salaryOpen}`}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 44,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: salary.state === 'over' || salary.state === 'full' ? tone : c.line,
          backgroundColor: c.surface2,
        }}
      >
        <View style={{ gap: 1 }}>
          <Txt v="sm" bold>
            {salary.label}
          </Txt>
          <Txt v="xs" bold style={{ color: tone }}>
            {salary.state === 'over' ? TC.salaryOver : TC.salaryLeft({ n: salary.left })}
          </Txt>
        </View>
        <View
          style={{
            flex: 1,
            height: 8,
            borderRadius: 999,
            backgroundColor: c.line,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.min(100, (salary.sum / Math.max(1, salary.budget)) * 100)}%`,
              height: '100%',
              borderRadius: 999,
              backgroundColor: tone,
            }}
          />
        </View>
        <Txt v="xs" tone="muted" bold>
          ?
        </Txt>
      </Press>
      {open ? (
        <SalaryGuide sum={salary.sum} budget={salary.budget} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 4 }}>
      {items.map((t) => (
        <Txt key={t} v="sm">{`· ${t}`}</Txt>
      ))}
    </View>
  );
}

export function SalaryGuide({
  sum,
  budget,
  onClose,
}: {
  sum: number;
  budget: number;
  onClose: () => void;
}) {
  const c = useColors();
  const stats = [
    [S.budget, budget],
    [S.used, sum],
    [S.left, Math.max(0, budget - sum)],
  ] as const;
  return (
    <PopSheet label={S.title} testID="salary-guide" onClose={onClose}>
      <View style={{ gap: 10 }}>
        <Txt v="h3" bold accessibilityRole="header">
          {S.title}
        </Txt>
        <Txt v="sm">{S.intro}</Txt>
        <Txt v="sm" tone="good" bold>
          {S.free}
        </Txt>
        <Row style={{ gap: 8 }}>
          {stats.map(([label, n]) => (
            <View
              key={label}
              style={{
                flex: 1,
                alignItems: 'center',
                padding: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: c.line,
                backgroundColor: c.surface2,
              }}
            >
              <Txt v="xs" tone="muted">
                {label}
              </Txt>
              <Txt v="h3" bold num>
                {String(n)}
              </Txt>
            </View>
          ))}
        </Row>
        <Txt v="body" bold>
          {S.tableTitle}
        </Txt>
        <Txt v="xs" tone="muted">
          {S.tableNote}
        </Txt>
        <View testID="salary-table">
          <Row
            style={{
              justifyContent: 'space-between',
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderColor: c.line,
            }}
          >
            <Txt v="xs" tone="muted" bold>
              {S.tableOvr}
            </Txt>
            <Txt v="xs" tone="muted" bold>
              {S.tableSalary}
            </Txt>
          </Row>
          {salaryRows().map((r) => (
            <Row
              key={r.band}
              style={{
                justifyContent: 'space-between',
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderColor: c.line,
              }}
            >
              <Txt v="sm">{r.band}</Txt>
              <Txt v="sm" bold num>
                {String(r.salary)}
              </Txt>
            </Row>
          ))}
        </View>
        <Txt v="body" bold>
          {S.examplesTitle({ budget })}
        </Txt>
        <Bullets items={salaryExamples(budget)} />
        <Txt v="xs" tone="muted">
          {S.examplesNote}
        </Txt>
        <Txt v="body" bold>
          {S.howTitle}
        </Txt>
        <Bullets items={[S.how1, S.how2, S.how3]} />
        <Txt v="body" bold>
          {S.whyTitle}
        </Txt>
        <Bullets items={[S.why1, S.why2, S.why3, S.why4]} />
        <Btn testID="salary-close" onPress={onClose}>
          {S.close}
        </Btn>
      </View>
    </PopSheet>
  );
}
