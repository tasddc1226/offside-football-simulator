import CupMatchStatus from '../../owner/CupMatchStatus';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { createCupAdmin, emptyCupAdmin } from '@offside/app-core/admin/cupPredictions';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import { kstDateTime as kst } from '@offside/app-core/boardText';
import { predictionPercentages } from '@offside/app-core/cupPredictions';
import { roundLabel } from '../../owner/cupText';
import { Btn } from '../../../ui/Btn';
import { Txt } from '../../../ui/Txt';
import { useColors } from '../../../theme/useColors';
import { TextBox, confirmAsync } from '../../board/parts';

export default function AdminCupPredictions() {
  const [s, setS] = useState(emptyCupAdmin);
  const [reason, setReason] = useState('');
  const model = useMemo(() => createCupAdmin(setS), []);
  const c = useColors();
  useEffect(() => {
    void model.load();
    return model.dispose;
  }, [model]);
  const seasons = [...new Set(s.cups.map((x) => x.cup.season))];
  async function recover() {
    if (!(await confirmAsync(L.adminRecover, L.adminRecoverConfirm))) return;
    if (await model.recover(reason)) setReason('');
  }
  return (
    <View style={{ gap: 12 }}>
      <Txt v="h2">{L.adminPredictionTitle}</Txt>
      <Txt v="sm" tone="muted">
        {L.adminPredictionNote}
      </Txt>
      <Txt>{L.adminSeason}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {seasons.map((n) => (
          <Btn
            key={n}
            disabled={s.busy}
            kind={s.season === n ? 'accent' : 'default'}
            onPress={() => void model.season(n)}
          >
            {n}
          </Btn>
        ))}
      </View>
      <Txt>{L.adminCompetition}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {s.cups
          .filter((x) => x.cup.season === s.season)
          .map((x) => (
            <Btn
              key={x.cup.id}
              disabled={s.busy}
              kind={s.cupId === x.cup.id ? 'accent' : 'default'}
              onPress={() => void model.select(x.cup.id)}
            >
              {L.edition({ n: x.cup.edition })}
            </Btn>
          ))}
      </View>
      <Btn disabled={s.loading || s.busy} onPress={() => void model.refresh()}>
        {L.adminRefresh}
      </Btn>
      {s.error ? <Txt accessibilityRole="alert">{s.error}</Txt> : null}
      {s.loading ? (
        <Txt>{L.loading}</Txt>
      ) : s.report ? (
        <>
          <Txt>
            {L.adminPeople} {s.report.participants} · {L.adminTotal}{' '}
            {s.report.items.reduce((n, x) => n + x.total, 0)}
          </Txt>
          {s.report.items.map((x) => {
            const m = x.match;
            const pct = predictionPercentages({ ...x, matchId: m.id });
            return (
              <View
                key={m.id}
                style={{ gap: 10, borderTopWidth: 1, borderColor: c.line, paddingVertical: 14 }}
              >
                <Txt v="xs" tone="muted">
                  {roundLabel(m.round)} {m.group ? L.groupName({ no: m.group }) : ''} · {kst(m.at)}
                </Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Txt bold style={{ flex: 1, textAlign: 'right' }}>
                    {x.homeName || L.tbd}
                  </Txt>
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <CupMatchStatus m={m} />
                    <Txt bold>{m.played ? `${m.homeGoals} : ${m.awayGoals}` : 'vs'}</Txt>
                  </View>
                  <Txt bold style={{ flex: 1 }}>
                    {x.awayName || L.tbd}
                  </Txt>
                </View>
                <Txt v="sm">
                  {L.predictionHome} {pct.home}% ·{' '}
                  {m.round.startsWith('g') ? `${L.predictionDraw} ${pct.draw}% · ` : ''}
                  {L.predictionAway} {pct.away}%
                </Txt>
                <Txt v="xs" tone="muted">
                  {L.adminTotal} {x.total} · {L.adminHits} {x.hits} · {L.adminGranted} {x.granted}
                  {m.played
                    ? ` · ${L.adminPending} ${x.pending} · ${L.adminUnpaid} ${x.unpaid}`
                    : ''}
                </Txt>
                <Btn
                  disabled={s.busy}
                  onPress={() => {
                    setReason('');
                    void model.details(m.id);
                  }}
                >
                  {L.adminDetails}
                </Btn>
                {s.matchId === m.id ? (
                  <View
                    style={{ gap: 12, borderLeftWidth: 2, borderColor: c.accent, paddingLeft: 12 }}
                  >
                    <Btn disabled={s.busy} onPress={model.close}>
                      {L.adminClose}
                    </Btn>
                    {s.detailLoading ? <Txt>{L.loading}</Txt> : null}
                    {(s.rows?.items ?? []).map((r) => (
                      <View key={r.profileId} style={{ gap: 4 }}>
                        <Txt bold>{r.nickname}</Txt>
                        <Txt v="xs">{r.profileId}</Txt>
                        <Txt v="sm">
                          {r.pick === 'home'
                            ? L.predictionHome
                            : r.pick === 'away'
                              ? L.predictionAway
                              : L.predictionDraw}{' '}
                          ·{' '}
                          {r.correct === null
                            ? m.played
                              ? L.adminPending
                              : L.predictionSelected
                            : r.correct
                              ? L.predictionHit
                              : L.predictionMiss}
                          {r.rewardedAt
                            ? ` · ${L.predictionRewarded}`
                            : r.correct
                              ? ` · ${L.adminUnpaid}`
                              : ''}
                        </Txt>
                        <Txt v="xs" tone="muted">
                          {kst(r.updatedAt)}
                        </Txt>
                      </View>
                    ))}
                    {s.rows?.next ? (
                      <Btn
                        disabled={s.detailLoading || s.busy}
                        onPress={() => void model.details(m.id, true)}
                      >
                        {L.adminMore}
                      </Btn>
                    ) : null}
                    {m.played ? (
                      <>
                        <Txt v="sm">{L.adminReason}</Txt>
                        <TextBox
                          accessibilityLabel={L.adminReason}
                          value={reason}
                          onChangeText={setReason}
                          maxLength={200}
                          editable={!s.busy}
                        />
                        <Btn
                          disabled={s.busy || reason.trim().length < 5 || !(x.pending + x.unpaid)}
                          onPress={() => void recover()}
                        >
                          {s.busy ? L.loading : L.adminRecover}
                        </Btn>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      ) : (
        <Txt>{L.adminNoCups}</Txt>
      )}
    </View>
  );
}
