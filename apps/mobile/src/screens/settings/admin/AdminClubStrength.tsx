import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { fetchStrengthHistory, type StrengthHistory } from '@offside/app-core/api/club-strength';
import { T, leagueName, clubName, strengthReason } from '@offside/app-core/admin/club-strength';
import { kstDateTime } from '@offside/app-core/boardText';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { Btn } from '../../../ui/Btn';
import { Txt } from '../../../ui/Txt';

export default function AdminClubStrength() {
  const [report, setReport] = useState<StrengthHistory | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  async function load(before?: string, fresh = false) {
    setBusy(true);
    const r = await fetchStrengthHistory(before, fresh);
    if (!r.ok) {
      setStatus('error');
      setBusy(false);
      return;
    }
    setReport((old) =>
      before && old ? { ...r.data, runs: [...old.runs, ...r.data.runs] } : r.data,
    );
    setStatus('ready');
    setBusy(false);
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <View testID="admin-club-strength" style={{ gap: 14 }}>
      <Txt v="h2">{T.title}</Txt>
      <Btn disabled={busy} onPress={() => void load(undefined, true)}>
        {T.refresh}
      </Btn>
      <Txt tone="muted">{T.note}</Txt>
      <LoadState status={status} failText={T.fail} retry={() => void load(undefined, true)}>
        {report ? (
          <>
            <Txt>
              {T.version}: v{report.current.v}
              {'\n'}
              {T.asOf}: {report.current.asOf}
            </Txt>
            {report.runs.map((run) => (
              <View key={run.day} style={{ gap: 10 }}>
                <Txt bold>
                  {kstDateTime(run.at)} · v{run.version}
                </Txt>
                {run.leagues.map((league) => {
                  const id = run.day + league.league;
                  return (
                    <View key={league.league} style={{ gap: 8 }}>
                      <Btn onPress={() => setOpen(open === id ? null : id)}>
                        {leagueName(league.league)} · {T[league.status]}
                      </Btn>
                      {open === id ? (
                        <>
                          <Txt tone="muted">{strengthReason(league.reason)}</Txt>
                          {league.season ? (
                            <Txt>
                              {T.season}: {league.season}
                            </Txt>
                          ) : null}
                          {league.status === 'failed' ? (
                            <Txt tone="muted">{league.reason}</Txt>
                          ) : null}
                          {league.changes.map((row) => (
                            <View
                              key={row.id}
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 8,
                              }}
                            >
                              <Txt style={{ flexShrink: 1 }}>{clubName(row.id)}</Txt>
                              <Txt bold>
                                {row.before} → {row.after} ({row.after - row.before > 0 ? '+' : ''}
                                {row.after - row.before})
                              </Txt>
                            </View>
                          ))}
                        </>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
            {!report.runs.length ? <Txt tone="muted">{T.empty}</Txt> : null}
            {report.nextBefore ? (
              <Btn disabled={busy} onPress={() => void load(report.nextBefore!)}>
                {T.more}
              </Btn>
            ) : null}
          </>
        ) : null}
      </LoadState>
    </View>
  );
}
