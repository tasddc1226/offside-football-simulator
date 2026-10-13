import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { LegendView } from '@offside/app-core/state';
import {
  loadRetiredLook,
  pickRetiredLook,
  retiredLookRows,
  saveRetiredLook,
} from '@offside/app-core/retiredLook';
import { retiredAvatarSpec, primeAvatarSpec } from '@offside/game/avatar';
import { retiredLookText as L } from '@offside/app-core/i18n/ko/retiredLook';
import { avatarLookText as A } from '@offside/app-core/i18n/ko/avatarLook';
import { appState } from '../../store';
import { toast } from '../../game/host';
import { TeamDialog } from '../../components/TeamDialog';
import { useColors } from '../../theme/useColors';
import { Btn, Press, Txt } from '../../ui';
import { PixelAvatar } from '../../ui/PixelAvatar';

export default function RetiredLook({ v, close }: { v: LegendView; close: () => void }) {
  const c = useColors();
  const [career] = useState(v);
  const [draft, setDraft] = useState(v.avatarLook ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [locked, setLocked] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [original, setOriginal] = useState(v.avatarLook ?? null);
  useEffect(() => {
    let active = true;
    void loadRetiredLook(appState, career)
      .then((r) => {
        if (!active) return;
        if (r.ok) {
          setOriginal(r.policy.look);
          setDraft(r.policy.look);
          setAllowed(r.policy.remaining === 1);
          setLocked(r.policy.lockedReason ? L[r.policy.lockedReason] : '');
        } else setError(r.message);
      })
      .catch(() => {
        if (active) setError(L.checkFailed);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [career]);
  const editingView = { ...v, avatarLook: original };
  const rows = retiredLookRows(editingView, draft);
  async function save() {
    if (busy || checking || !allowed || draft === original) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await saveRetiredLook(appState, editingView, draft);
      if (r.ok) {
        toast(r.message);
        close();
      } else setError(r.message);
    } catch {
      setError(L.failed);
    } finally {
      setBusy(false);
    }
  }
  const cancel = () => {
    if (!busy) close();
  };
  return (
    <TeamDialog
      title={L.title}
      close={cancel}
      footer={
        <View style={{ gap: 8 }}>
          {confirming ? <Txt>{L.confirmNote}</Txt> : null}
          {error ? (
            <Txt accessibilityRole="alert" style={{ color: c.bad }}>
              {error}
            </Txt>
          ) : null}
          {confirming ? (
            <Btn disabled={busy} onPress={() => setConfirming(false)}>
              {L.back}
            </Btn>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn disabled={busy} style={{ flex: 1 }} onPress={cancel}>
              {L.cancel}
            </Btn>
            <Btn
              kind="primary"
              testID="retired-look-save"
              disabled={busy || checking || !allowed || draft === original}
              style={{ flex: 1 }}
              onPress={() => void save()}
            >
              {busy ? L.saving : confirming ? L.confirm : L.save}
            </Btn>
          </View>
        </View>
      }
    >
      <Txt tone="muted">{L.intro}</Txt>
      <Txt tone="muted">{L.policy}</Txt>
      <View
        style={{ flexDirection: 'row', justifyContent: 'center', gap: 32 }}
        testID="retired-look-previews"
      >
        <View style={{ alignItems: 'center', gap: 6 }}>
          <PixelAvatar spec={retiredAvatarSpec(v.avatarId!, v.age, draft)} width={60} />
          <Txt>{L.retiredPreview}</Txt>
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <PixelAvatar
            spec={primeAvatarSpec({
              id: v.avatarId!,
              lastClub: v.lastClub,
              lastClubId: v.lastClubId,
              look: draft,
            })}
            width={60}
          />
          <Txt>{L.kitPreview}</Txt>
        </View>
      </View>
      {checking ? <Txt>{L.checking}</Txt> : null}
      {locked ? <Txt>{locked}</Txt> : null}
      {allowed && !confirming ? (
        <>
          <Txt tone="muted">{L.recordNote}</Txt>
          {rows.map((r) => (
            <View key={r.item} style={{ gap: 8 }} testID={`retired-look-${r.item}`}>
              <Txt bold>{r.name}</Txt>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={r.name}
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
              >
                {r.options.map((o) => (
                  <Press
                    key={o.value}
                    disabled={busy}
                    testID={`retired-look-${r.item}-${o.value}`}
                    accessibilityRole="radio"
                    accessibilityLabel={o.label ?? A.pickAria({ item: r.name, n: o.value + 1 })}
                    accessibilityState={{ selected: r.current === o.value, disabled: busy }}
                    onPress={() => setDraft(pickRetiredLook(draft, r.item, o.value))}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      maxWidth: '100%',
                      paddingHorizontal: o.swatch ? 6 : 12,
                      paddingVertical: 6,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: r.current === o.value ? 3 : 1,
                      borderColor: r.current === o.value ? c.accent : c.line,
                      borderRadius: 24,
                    }}
                  >
                    {o.swatch ? (
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: o.swatch,
                          borderColor: c.line,
                          borderWidth: 1,
                        }}
                      />
                    ) : (
                      <Txt>{o.label}</Txt>
                    )}
                  </Press>
                ))}
              </View>
            </View>
          ))}
          <Btn
            testID="retired-look-reset"
            disabled={busy || draft === null}
            onPress={() => setDraft(null)}
          >
            {L.reset}
          </Btn>
        </>
      ) : null}
    </TeamDialog>
  );
}
