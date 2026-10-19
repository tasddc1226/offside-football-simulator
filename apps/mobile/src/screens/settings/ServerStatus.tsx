// T-11-321 설정의 '서버 상태'(웹 ServerStatus.svelte). 값은 app-core serverStatusView, 펼칠 때만 불러온다.
import { RADIUS } from '@offside/app-core/design-tokens';
import { loadServerStatus, type ServerStatusView } from '@offside/app-core/serverStatus';
import { serverStatusText as L } from '@offside/app-core/i18n/ko/serverStatus';
import { useState } from 'react';
import { View } from 'react-native';
import { useColors } from '../../theme/useColors';
import { Txt } from '../../ui';
import { SettingsCard, SettingsLabel, SettingsTrigger } from './parts';
import { Skeleton } from '../../ui/Skeleton';

export function ServerStatus() {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ServerStatusView | 'error' | null>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && (view === null || view === 'error')) {
      setView(null);
      void loadServerStatus().then(setView);
    }
  };

  const dot = { ok: c.good, slow: c.accent, down: c.bad, unknown: c.muted };
  const chart = (label: string, bar: 'reqBar' | 'avgBar', tone: string, id: string) =>
    view && view !== 'error' ? (
      <View style={{ gap: 4 }} testID={`server-status-${id}`}>
        <Txt v="xs" tone="muted">
          {label}
        </Txt>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 2,
            height: 56,
            borderBottomWidth: 1,
            borderBottomColor: c.line,
          }}
        >
          {view.hours.map((h, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: `${Math.max(2, h[bar] * 100)}%`,
                backgroundColor: tone,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[0, 12, 23].map((i) => (
            <Txt key={i} v="xs" tone="muted">
              {view.hours[i]?.label}
            </Txt>
          ))}
        </View>
      </View>
    ) : null;

  return (
    <SettingsCard>
      <SettingsTrigger
        chev="▼"
        expanded={open}
        testID="settings-open-server-status"
        label={L.title}
        onPress={toggle}
      >
        <SettingsLabel eyebrow="Status" title={L.title} muted={L.intro} />
      </SettingsTrigger>
      {open ? (
        <View style={{ gap: 12, marginTop: 12 }}>
          {view === null ? (
            <Skeleton rows={2} />
          ) : view === 'error' ? (
            <Txt v="sm" tone="muted">
              {L.error}
            </Txt>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: RADIUS.xs,
                    backgroundColor: dot[view.level],
                  }}
                />
                <Txt bold testID="server-status-level">
                  {view.headline}
                </Txt>
              </View>
              {view.trend ? <Txt v="sm">{view.trend}</Txt> : null}
              {view.recent.length ? (
                <View style={{ gap: 6 }}>
                  <Txt v="sm" bold>
                    {L.recentTitle}
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
                    {view.recent.map(([term, value]) => (
                      <View key={term} style={{ width: '50%', gap: 2 }}>
                        <Txt v="xs" tone="muted">
                          {term}
                        </Txt>
                        <Txt num bold>
                          {value}
                        </Txt>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              <Txt v="sm" bold>
                {L.hoursTitle}
              </Txt>
              {chart(L.hoursRequests, 'reqBar', c.accent, 'requests')}
              {chart(L.hoursAvg, 'avgBar', c.muted, 'avg')}
              {view.days.length ? (
                <View style={{ gap: 4 }}>
                  <Txt v="sm" bold>
                    {L.daysTitle}
                  </Txt>
                  {[
                    { day: L.colDay, requests: L.colRequests, avg: L.colAvg, slow: L.colSlow },
                    ...view.days,
                  ].map((d, i) => (
                    <View key={d.day} style={{ flexDirection: 'row', gap: 8 }}>
                      {[d.day, d.requests, d.avg, d.slow].map((cell, j) => (
                        <Txt
                          key={j}
                          v="xs"
                          num={j > 0}
                          tone={i === 0 ? 'muted' : undefined}
                          style={{ flex: j === 0 ? 0.8 : 1, textAlign: j === 0 ? 'left' : 'right' }}
                        >
                          {cell}
                        </Txt>
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
              <Txt v="xs" tone="muted">
                {L.note}
              </Txt>
            </>
          )}
        </View>
      ) : null}
    </SettingsCard>
  );
}
