import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  PlayerManagement,
  MANAGE_SORTS,
  MANAGE_SORT_LABEL,
  manageNations,
  manageRowInfo,
  manageView,
} from '@offside/app-core/playerManagement';
import {
  releaseLock,
  releaseAmount,
  releaseValue,
  releaseConfirmText,
  fundsText,
  nationName,
  MARKET_POS_FILTERS,
} from '@offside/app-core/market';
import { POS } from '@offside/game/data';
import { FilterChip } from './MarketParts';
import { SelectField } from '../settings/parts';
import { enhanceLossNote } from '@offside/app-core/cardEnhance';
import { localCareerNames } from '@offside/game/hof-store';
import { playerName } from '@offside/app-core/format';
import { marketText as M } from '@offside/app-core/i18n/ko/market';
import { ownerPlayersText as L } from '@offside/app-core/i18n/ko/ownerPlayers';
import { openPublicLegendById } from '../../game/host';
import { Btn, Card, Press, Txt } from '../../ui';
import { useColors } from '../../theme/useColors';
import { renameText as RN } from '@offside/app-core/i18n/ko/rename';
import { RenameSheet } from '../rename/RenameSheet';
import { Skeleton } from '../../ui/Skeleton';

import { fetchPhysiqueItems } from '@offside/app-core/api/cup';
import { iapText as I } from '@offside/app-core/i18n/ko/iap';
import { CardPhysique } from './CardPhysique';
export function PlayerRelease({ season }: { season: number }) {
  const [physiqueOn, setPhysiqueOn] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    void fetchPhysiqueItems().then((r) => setPhysiqueOn(r.ok && r.data.physique !== undefined));
  }, []);
  const manager = useMemo(() => new PlayerManagement(), []);
  const [state, setState] = useState(manager.state);
  const local = useMemo(() => localCareerNames(), []);
  // T-11-377 이름 변경권으로 바꾼 이름(목록을 다시 받기 전까지 바로 보인다)과 열린 창의 선수.
  const [renamed, setRenamed] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<{ careerId: string; name: string } | null>(null);
  const c = useColors();
  useEffect(() => {
    const unsub = manager.subscribe(setState);
    void manager.load(season);
    return () => {
      unsub();
      manager.dispose();
    };
  }, [manager, season]);
  const selected = manager.selectedPlayers;
  const amount = releaseAmount(selected, state.rate);
  // T-11-841 포지션 · 국적 필터와 정렬(받은 목록 안에서만, 서버를 다시 부르지 않는다).
  const shown = useMemo(
    () => manageView(state.players, state.filter, state.sort),
    [state.players, state.filter, state.sort],
  );
  const nations = useMemo(() => manageNations(state.players), [state.players]);
  const filtered = !!(state.filter.pos || state.filter.nation);
  const nameOf = (p: (typeof state.players)[number]) =>
    renamed[p.careerId] ?? local.get(p.careerId) ?? playerName(p.publicName, p.pos, p.number);
  return (
    <View style={{ gap: 12 }} testID="player-management">
      {editing && (
        <CardPhysique
          {...editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void manager.load(season);
          }}
        />
      )}
      <Txt tone="muted">{M.releaseIntro}</Txt>
      {state.notice ? (
        <Txt accessibilityLiveRegion="polite" tone="good">
          {state.notice}
        </Txt>
      ) : null}
      {state.error ? (
        <>
          <Txt accessibilityRole="alert">{state.error}</Txt>
          <Btn disabled={state.busy} onPress={() => void manager.load(season)}>
            {L.retry}
          </Btn>
        </>
      ) : null}
      {state.loading ? (
        <Skeleton rows={5} />
      ) : (
        <>
          {state.players.length ? (
            <View style={{ gap: 10 }} testID="players-filters">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {MARKET_POS_FILTERS.map((p) => (
                  <FilterChip
                    key={p ?? 'all'}
                    on={state.filter.pos === p}
                    label={p ? POS[p].label : M.posAll}
                    testID={`players-pos-${p ?? 'all'}`}
                    onPress={() => manager.setFilter({ pos: p })}
                  />
                ))}
              </View>
              <SelectField
                label={L.filterNation}
                testID="players-nation"
                value={state.filter.nation ?? ''}
                options={[
                  { value: '', label: L.nationAll },
                  ...nations.map((n) => ({
                    value: n.code,
                    label: `${nationName(n.code)} (${n.n})`,
                  })),
                ]}
                onChange={(v) => manager.setFilter({ nation: v || undefined })}
              />
              <SelectField
                label={L.sortLabel}
                testID="players-sort"
                value={state.sort}
                options={MANAGE_SORTS.map((k) => ({ value: k, label: MANAGE_SORT_LABEL[k]() }))}
                onChange={(v) => manager.setSort(v)}
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <Txt tone="muted" testID="players-count">
                  {L.shownCount({ n: shown.length, total: state.players.length })}
                </Txt>
                {filtered ? (
                  <Press
                    testID="players-reset"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => manager.setFilter({ pos: undefined, nation: undefined })}
                  >
                    <Txt tone="accent">{L.filterReset}</Txt>
                  </Press>
                ) : null}
              </View>
            </View>
          ) : null}
          <Btn
            testID="players-pick-all"
            disabled={state.busy || state.confirm || !manager.eligible.length}
            onPress={() => manager.selectAll()}
          >
            {state.selected.size ? M.pickNone : L.pickLimit}
          </Btn>
          {shown.length ? (
            shown.map((p) => {
              const locked = releaseLock(p, state.lineup);
              return (
                <View
                  key={p.careerId}
                  testID={`managed-player-${p.careerId}`}
                  style={{ gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line }}
                >
                  {physiqueOn && (
                    <Btn
                      sm
                      disabled={state.busy}
                      onPress={() => setEditing({ id: p.careerId, name: nameOf(p) })}
                    >
                      {I.physiqueTitle}
                    </Btn>
                  )}
                  <Press
                    accessibilityRole="checkbox"
                    accessibilityLabel={M.releasePickLabel({ name: nameOf(p) })}
                    accessibilityState={{
                      checked: state.selected.has(p.careerId),
                      disabled: !!locked || state.busy || state.confirm,
                    }}
                    disabled={!!locked || state.busy || state.confirm}
                    onPress={() => manager.toggle(p.careerId)}
                  >
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: locked ? c.muted : c.good,
                          backgroundColor: state.selected.has(p.careerId) ? c.good : 'transparent',
                        }}
                      />
                      <View style={{ gap: 4, flex: 1, minWidth: 0 }}>
                        <Txt bold>{nameOf(p)}</Txt>
                        <Txt tone="muted">{manageRowInfo(p)}</Txt>
                        {locked ? (
                          <Txt tone="muted">{locked}</Txt>
                        ) : (
                          <Txt>
                            {M.releaseGets({ amount: fundsText(releaseValue(p, state.rate)) })}
                          </Txt>
                        )}
                      </View>
                    </View>
                  </Press>
                  <Btn
                    sm
                    testID={`player-detail-${p.careerId}`}
                    disabled={state.busy}
                    onPress={() => void openPublicLegendById(p.careerId)}
                  >
                    {L.viewRecord}
                  </Btn>
                  <Btn
                    sm
                    testID={`player-rename-${p.careerId}`}
                    accessibilityLabel={RN.entryLabel({ name: nameOf(p) })}
                    disabled={state.busy}
                    onPress={() => setRenaming({ careerId: p.careerId, name: nameOf(p) })}
                  >
                    {RN.entry}
                  </Btn>
                </View>
              );
            })
          ) : (
            <Txt tone="muted">{state.players.length ? L.filterEmpty : L.noOwned}</Txt>
          )}
          {selected.length ? (
            <Card gap={12} testID="player-release-summary">
              <Txt bold>{`${M.dockSum({ n: selected.length })} · ${fundsText(amount)}`}</Txt>
              {state.confirm ? (
                <>
                  <Txt>{releaseConfirmText(selected.length, amount)}</Txt>
                  {enhanceLossNote(selected) ? <Txt v="sm">{enhanceLossNote(selected)}</Txt> : null}
                  <View style={{ gap: 8 }}>
                    <Btn disabled={state.busy} onPress={() => manager.confirm(false)}>
                      {M.close}
                    </Btn>
                    <Btn
                      kind="danger"
                      testID="players-release-confirm"
                      disabled={state.busy}
                      onPress={() => void manager.release()}
                    >
                      {M.releaseBtn({ n: selected.length })}
                    </Btn>
                  </View>
                </>
              ) : (
                <>
                  <Txt tone="muted">{M.dockWarn}</Txt>
                  <Btn
                    kind="danger"
                    testID="players-release"
                    disabled={state.busy}
                    onPress={() => manager.confirm(true)}
                  >
                    {M.releaseBtn({ n: selected.length })}
                  </Btn>
                </>
              )}
            </Card>
          ) : null}
        </>
      )}
      {renaming ? (
        <RenameSheet
          careerId={renaming.careerId}
          name={renaming.name}
          close={() => setRenaming(null)}
          onDone={(n) => setRenamed((m) => ({ ...m, [renaming.careerId]: n }))}
        />
      ) : null}
    </View>
  );
}
