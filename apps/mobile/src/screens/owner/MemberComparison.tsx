import { useState } from 'react';
import { View, TextInput, ScrollView } from 'react-native';
import { fetchMembership } from '@offside/app-core/api/membership';
import { getMyCareers } from '@offside/app-core/api/client';
import type { PublicHofEntry } from '@offside/contracts';
import { membershipText as L } from '@offside/app-core/i18n/ko/membership';
import { go } from '../../game/nav';
import { Card, Btn, Txt } from '../../ui';
import { useColors } from '../../theme/useColors';
export function MemberComparison() {
  const c = useColors();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [entries, setEntries] = useState<PublicHofEntry[]>([]),
    [selected, setSelected] = useState<string[]>([]);
  const chosen = selected.flatMap((id) => entries.filter((e) => e.id === id));
  const metrics = ['peak', 'apps', 'goals', 'assists', 'trophies', 'legendScore'] as const;
  async function show() {
    if (open) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError('');
    const m = await fetchMembership();
    if (!m.ok) {
      setError(L.error);
      setBusy(false);
      return;
    }
    if (!m.data.membership.active) {
      setBusy(false);
      go('membership');
      return;
    }
    const r = await getMyCareers();
    setBusy(false);
    if (r.ok) {
      setEntries(r.data.entries);
      setOpen(true);
    } else setError(L.failed);
  }
  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((v) => v !== id) : ids.length < 3 ? [...ids, id] : ids,
    );
  return (
    <Card gap={12}>
      <Btn testID="member-compare" disabled={busy} onPress={() => void show()}>
        {L.compare}
      </Btn>
      {error ? <Txt>{error}</Txt> : null}
      {open ? (
        <>
          <Txt>{L.comparePick}</Txt>
          {entries.length ? (
            <>
              <TextInput
                accessibilityLabel={L.search}
                placeholder={L.search}
                placeholderTextColor={c.muted}
                value={query}
                onChangeText={setQuery}
                style={{
                  minHeight: 48,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: c.line,
                  color: c.ink,
                  borderRadius: 8,
                }}
              />
              <ScrollView
                style={{ maxHeight: 240 }}
                nestedScrollEnabled
                contentContainerStyle={{ gap: 8 }}
              >
                {entries
                  .filter((e) => (e.name ?? '').toLowerCase().includes(query.toLowerCase()))
                  .slice(0, 100)
                  .map((e) => (
                    <Btn
                      key={e.id}
                      kind={selected.includes(e.id) ? 'primary' : 'default'}
                      disabled={selected.length === 3 && !selected.includes(e.id)}
                      onPress={() => toggle(e.id)}
                    >
                      {e.name ?? e.id} · {L.season} {e.season ?? 0}
                    </Btn>
                  ))}
              </ScrollView>
              {chosen.length ? (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Txt style={{ flex: 1 }}>{L.metric}</Txt>
                    {chosen.map((e) => (
                      <Txt key={e.id} bold style={{ flex: 1 }}>
                        {e.name ?? e.id}
                      </Txt>
                    ))}
                  </View>
                  {metrics.map((key) => (
                    <View
                      key={key}
                      style={{
                        flexDirection: 'row',
                        gap: 6,
                        borderTopWidth: 1,
                        borderColor: c.line,
                        paddingTop: 10,
                      }}
                    >
                      <Txt style={{ flex: 1 }}>{L[key]}</Txt>
                      {chosen.map((e) => (
                        <Txt key={e.id} style={{ flex: 1 }}>
                          {e[key].toLocaleString()}
                        </Txt>
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Txt>{L.compareEmpty}</Txt>
          )}
        </>
      ) : null}
    </Card>
  );
}
