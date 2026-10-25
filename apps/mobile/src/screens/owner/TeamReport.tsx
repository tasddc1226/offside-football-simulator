// T-11-379 경기 리포트(웹 team/TeamReport.svelte · TeamSeasonReport.svelte) — 경기 결과의 기대 득점 · 진단 한 줄 ·
// 줄 비교 · 고칠 곳, 시즌 통계의 리포트 묶음. T-11-498 줄 비교는 접지 않고 가운데 선 기준 막대로 보인다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { View } from 'react-native';
import type { TeamMatch, TeamStatsReport } from '@offside/app-core/api/team';
import { seasonReportView, teamMatchReport } from '@offside/app-core/matchReport';
import { matchReportText as L } from '@offside/app-core/i18n/ko/matchReport';
import { signedNum } from '@offside/app-core/teamText';
import type { ReportLine } from '@offside/contracts/owner-team';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Txt } from '../../ui';

/** 차이 30점이면 막대가 한쪽 끝까지 간다(줄 비교는 대개 ±30 안에 있다). */
const half = (edge: number) => `${Math.max(2, Math.min(50, (Math.abs(edge) / 30) * 50))}%` as const;

export function TeamReport({
  m,
  fix,
}: {
  m: TeamMatch;
  /** 고칠 곳 — 내 편성을 고칠 수 있을 때만 준다. */
  fix?: ((line: ReportLine) => { pos: string; go: () => void } | null) | undefined;
}) {
  const c = useColors();
  const r = teamMatchReport(m);
  if (!r) return null;
  const target = r.weak && fix ? fix(r.weak) : null;
  return (
    <View
      style={{ gap: 10, padding: 14, borderRadius: RADIUS.md, backgroundColor: c.surface2 }}
      testID="team-report"
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}
      >
        <Txt bold accessibilityRole="header" style={{ fontSize: rem(FONT.body) }}>
          {L.nextTitle}
        </Txt>
        <Txt tone="muted" style={{ fontFamily: DISPLAY[700] }} testID="team-report-xg">
          {r.xgText}
        </Txt>
      </View>
      <Txt v="sm" testID="team-report-diagnosis">
        {r.diagnosis}
      </Txt>
      {r.rows.map((row) => {
        const up = row.edge >= 0;
        const weak = row.line === r.weak;
        return (
          <View
            key={row.line}
            accessible
            accessibilityLabel={L.lineAria({ line: row.label, mine: row.mine, opp: row.opp })}
            style={{ gap: 4 }}
            testID={`team-report-line-${row.line}`}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Txt v="sm" bold={weak} style={[{ flexShrink: 1 }, weak ? { color: c.bad } : null]}>
                {row.label}
              </Txt>
              <Txt v="sm">
                <Txt v="xs" tone="muted">{`${row.mine} : ${row.opp} `}</Txt>
                <Txt v="sm" style={{ fontFamily: DISPLAY[700], color: up ? c.good : c.bad }}>
                  {signedNum(Math.round(row.edge))}
                </Txt>
              </Txt>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: c.line }}>
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  borderRadius: 4,
                  width: half(row.edge),
                  backgroundColor: up ? c.good : c.bad,
                  ...(up ? { left: '50%' } : { right: '50%' }),
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: -3,
                  bottom: -3,
                  width: 2,
                  marginLeft: -1,
                  backgroundColor: c.faint,
                }}
              />
            </View>
          </View>
        );
      })}
      <Txt tone="muted" v="xs">
        {`${L.axisNote} ${L.wallNote}`}
      </Txt>
      <Txt tone="muted" v="xs">
        {L.xgHint}
      </Txt>
      {target ? (
        <Btn
          block
          onPress={target.go}
          accessibilityLabel={L.fixAria({ pos: target.pos })}
          testID="team-report-fix"
        >
          {L.fix({ pos: target.pos })}
        </Btn>
      ) : null}
    </View>
  );
}

export function TeamSeasonReport({ report }: { report: TeamStatsReport | undefined }) {
  const c = useColors();
  if (!report) return null;
  const v = seasonReportView(report);
  const pair = (k: string, label: string, value: string, neg = false) => (
    <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <Txt v="sm" style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      <Txt v="sm" bold style={{ textAlign: 'right', ...(neg ? { color: c.bad } : null) }}>
        {value}
      </Txt>
    </View>
  );
  return (
    <View style={{ gap: 8 }} testID="team-season-report">
      <Txt bold style={{ fontSize: rem(FONT.body1) }}>
        {L.seasonTitle}
      </Txt>
      {v ? (
        <>
          <Txt v="sm">{v.xg}</Txt>
          <Txt v="sm">{`${v.finish} ${v.behind}`}</Txt>
          <Txt tone="muted" v="xs">
            {L.seasonEdges}
          </Txt>
          {v.edges.map((e) =>
            pair(e.label, e.label, signedNum(Math.round(e.edge * 10) / 10), e.edge < 0),
          )}
          {v.formations.length ? (
            <>
              <Txt tone="muted" v="xs">
                {L.seasonFormations}
              </Txt>
              {v.formations.map((f) => pair(f.formation, f.formation, f.text))}
            </>
          ) : null}
        </>
      ) : (
        <Txt tone="muted" v="sm">
          {L.seasonEmpty}
        </Txt>
      )}
    </View>
  );
}
