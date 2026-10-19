// T-11-379 경기 리포트(웹 team/TeamReport.svelte · TeamSeasonReport.svelte) — 경기 결과의 기대 득점 · 진단 한 줄 ·
// 접어 둔 줄 비교 · 고칠 곳, 시즌 통계의 리포트 묶음.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useState } from 'react';
import { View } from 'react-native';
import type { TeamMatch, TeamStatsReport } from '@offside/app-core/api/team';
import { seasonReportView, teamMatchReport } from '@offside/app-core/matchReport';
import { matchReportText as L } from '@offside/app-core/i18n/ko/matchReport';
import { signedNum } from '@offside/app-core/teamText';
import type { ReportLine } from '@offside/contracts/owner-team';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn, Txt } from '../../ui';

/** 줄 힘은 대개 40~100이라 그 구간을 막대 전체로 늘려 차이가 보이게 한다. */
const width = (x: number) => `${Math.max(4, Math.min(100, ((x - 40) / 60) * 100))}%` as const;

export function TeamReport({
  m,
  fix,
}: {
  m: TeamMatch;
  /** 고칠 곳 — 내 편성을 고칠 수 있을 때만 준다. */
  fix?: ((line: ReportLine) => { pos: string; go: () => void } | null) | undefined;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const r = teamMatchReport(m);
  if (!r) return null;
  const target = r.weak && fix ? fix(r.weak) : null;
  const bar = (x: number, color: string, end: boolean) => (
    <View
      style={{
        flex: 1,
        height: 6,
        borderRadius: 3,
        backgroundColor: c.line,
        overflow: 'hidden',
        flexDirection: 'row',
        justifyContent: end ? 'flex-end' : 'flex-start',
      }}
    >
      <View style={{ width: width(x), backgroundColor: color }} />
    </View>
  );
  return (
    <View
      style={{ gap: 8, padding: 12, borderRadius: RADIUS.md, backgroundColor: c.surface2 }}
      testID="team-report"
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}
      >
        <Txt bold>{L.title}</Txt>
        <Txt style={{ fontFamily: DISPLAY[700] }} testID="team-report-xg">
          {r.xgText}
        </Txt>
      </View>
      <Txt v="sm" testID="team-report-diagnosis">
        {r.diagnosis}
      </Txt>
      <Txt tone="muted" v="xs">
        {L.xgHint}
      </Txt>
      <View style={{ alignItems: 'flex-start' }}>
        <Btn sm onPress={() => setOpen(!open)} testID="team-report-compare">
          {open ? L.compareClose : L.compareOpen}
        </Btn>
      </View>
      {open ? (
        <View style={{ gap: 8 }}>
          {r.rows.map((row) => (
            <View
              key={row.line}
              accessible
              accessibilityLabel={L.lineAria({ line: row.label, mine: row.mine, opp: row.opp })}
              style={{ gap: 2 }}
              testID={`team-report-line-${row.line}`}
            >
              <Txt
                v="sm"
                bold={row.line === r.weak}
                style={row.line === r.weak ? { color: c.bad } : null}
              >
                {row.label}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Txt bold style={{ minWidth: rem(2) }}>
                  {row.mine}
                </Txt>
                {bar(row.mine, c.accent, true)}
                {bar(row.opp, c.muted, false)}
                <Txt bold style={{ minWidth: rem(2), textAlign: 'right' }}>
                  {row.opp}
                </Txt>
              </View>
            </View>
          ))}
          <Txt tone="muted" v="xs">
            {L.wallNote}
          </Txt>
        </View>
      ) : null}
      {target ? (
        <Btn
          sm
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
