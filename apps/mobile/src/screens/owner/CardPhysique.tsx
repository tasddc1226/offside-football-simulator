import { useState, useEffect } from 'react';
import { TextInput } from 'react-native';
import { fetchCardPhysique, saveCardPhysique } from '@offside/app-core/api/cardPhysique';
import {
  BODY_DEFAULT,
  RETIRED_BODY_LIMITS,
  retiredWeightLimits,
  validRetiredBody,
  type RetiredPhysique,
} from '@offside/contracts/body';
import { iapText as L } from '@offside/app-core/i18n/ko/iap';
import { renameText as RN } from '@offside/app-core/i18n/ko/rename';
import { PopSheet } from '../../ui/PopSheet';
import { Txt, Btn } from '../../ui';
import { useInputStyle } from '../create/parts';
import { revealFocusedInput } from '../../ui/scroll';
import { IapPacks } from './IapPacks';
import { iapItems, useIapItems } from '../../platform/iapItems';

export function CardPhysique({
  id,
  name,
  onClose,
  onDone,
}: {
  id: string;
  name: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [card, setCard] = useState<RetiredPhysique | null>(null);
  const [h, setH] = useState(''),
    [w, setW] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const input = useInputStyle();
  const iap = useIapItems(true);
  const lastGrant = iap.items?.physique;
  useEffect(() => {
    let live = true;
    void fetchCardPhysique(id).then((r) => {
      if (!live) return;
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      setCard(r.data);
      setH((old) => old || String(r.data.height ?? BODY_DEFAULT[r.data.pos].h));
      setW((old) => old || String(r.data.weight ?? BODY_DEFAULT[r.data.pos].w));
    });
    return () => {
      live = false;
    };
  }, [id, lastGrant]);
  const limits = card && RETIRED_BODY_LIMITS[card.pos];
  const weights = card && retiredWeightLimits(card.pos, Number(h));
  async function save() {
    if (!card || busy) return;
    setBusy(true);
    try {
      const r = await saveCardPhysique(id, Number(h), Number(w), card.revision);
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      if (iapItems.items) iapItems.items = { ...iapItems.items, physique: r.data.tickets };
      onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <PopSheet label={L.physiqueTitle} onClose={onClose}>
      <Txt v="h3">
        {name} · {L.physiqueTitle}
      </Txt>
      <Txt>{L.physiqueNote}</Txt>
      {card && limits && weights ? (
        <>
          <Txt>
            {L.physiqueHave} · {card.tickets}
          </Txt>
          {card.listed ? (
            <Txt>{L.physiqueListed}</Txt>
          ) : (
            <>
              <Txt>
                {L.physiqueHeight} · {limits.minH}–{limits.maxH}
              </Txt>
              <TextInput
                accessibilityLabel={L.physiqueHeight}
                value={h}
                onChangeText={setH}
                editable={!busy}
                onFocus={revealFocusedInput}
                keyboardType="number-pad"
                style={input}
              />
              <Txt>
                {L.physiqueWeight} · {weights.min}–{weights.max}
              </Txt>
              <TextInput
                accessibilityLabel={L.physiqueWeight}
                value={w}
                onChangeText={setW}
                editable={!busy}
                onFocus={revealFocusedInput}
                keyboardType="number-pad"
                style={input}
              />
              {card.tickets ? (
                <Btn
                  block
                  disabled={
                    busy ||
                    !validRetiredBody(card.pos, Number(h), Number(w)) ||
                    (Number(h) === card.height && Number(w) === card.weight)
                  }
                  onPress={() => void save()}
                >
                  {L.physiqueApply}
                </Btn>
              ) : (
                <IapPacks item="physique" />
              )}
            </>
          )}
        </>
      ) : null}
      <Btn block disabled={busy} onPress={onClose}>
        {RN.close}
      </Btn>
      {error ? <Txt accessibilityRole="alert">{error}</Txt> : null}
    </PopSheet>
  );
}
