import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  PlayerManagement,
  MANAGE_SORTS,
  MANAGE_SORT_LABEL,
  MANAGE_PAGE,
  manageNations,
  manageRowInfo,
  manageLockTag,
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
import type { TeamPlayer } from '@offside/app-core/api/team';
import { CARD_TIER_SWATCH } from '@offside/app-core/seasonRecap';
import { cardTier } from '@offside/contracts/card-tier';
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
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
import { PopSheet } from '../../ui/PopSheet';
import { useFooterSlot } from '../../ui/footerSlot';
import { useColors } from '../../theme/useColors';
import { alpha, mix } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
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
  const local = useMemo(() => localCareerNames(), []);
  // T-11-377 이름 변경권으로 바꾼 이름(목록을 다시 받기 전까지 바로 보인다)과 열린 창의 선수.
  const [renamed, setRenamed] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<{ careerId: string; name: string } | null>(null);
  const nameOf = (p: TeamPlayer) =>
    renamed[p.careerId] ?? local.get(p.careerId) ?? playerName(p.publicName, p.pos, p.number);
  // 이름 검색은 화면에 보이는 이름으로 한다(매니저는 한 번 만들어 두고 최신 이름을 읽는다).
  const namer = useRef(nameOf);
  namer.current = nameOf;
  const manager = useMemo(() => new PlayerManagement((p) => namer.current(p)), []);
  const [state, setState] = useState(manager.state);
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
  // T-11-841 포지션 · 국적 · 이름으로 거르고 정렬한다(받은 목록 안에서만, 서버를 다시 부르지 않는다).
  const shown = manageView(state.players, state.filter, state.sort, nameOf);
  const nations = useMemo(() => manageNations(state.players), [state.players]);
  const filtered = !!(state.filter.pos || state.filter.nation || state.filter.q);
  // 수백 명이어도 처음엔 MANAGE_PAGE명만 그린다. 필터 · 정렬을 바꾸면 다시 처음부터.
  const [limit, setLimit] = useState(MANAGE_PAGE);
  useEffect(() => setLimit(MANAGE_PAGE), [state.filter, state.sort]);
  const rows = shown.slice(0, limit);
  const [menuFor, setMenuFor] = useState<{ id: string; name: string } | null>(null);
  const [whyFor, setWhyFor] = useState<string | null>(null);

  // 고른 선수 합계 · 방출 버튼은 화면 아래 고정 줄(이전으로 바 위)에 올린다.
  const setDock = useFooterSlot();
  const lossNote = enhanceLossNote(selected);
  const dock = selected.length ? (
    <View
      testID="player-release-summary"
      style={{
        backgroundColor: alpha(c.bg, 0.97),
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingTop: 12,
        paddingHorizontal: 16,
        gap: 8,
      }}
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Txt>{M.dockSum({ n: selected.length })}</Txt>
        <Txt style={{ fontFamily: DISPLAY[700], fontSize: rem(FONT.title1), color: c.accentText }}>
          {`+${fundsText(amount)}`}
        </Txt>
      </View>
      {state.confirm ? (
        <>
          <Txt>{releaseConfirmText(selected.length, amount)}</Txt>
          {lossNote ? <Txt v="sm">{lossNote}</Txt> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Btn block disabled={state.busy} onPress={() => manager.confirm(false)}>
                {M.close}
              </Btn>
            </View>
            <View style={{ flex: 1 }}>
              <Btn
                block
                kind="danger"
                testID="players-release-confirm"
                disabled={state.busy}
                onPress={() => void manager.release()}
              >
                {M.releaseBtn({ n: selected.length })}
              </Btn>
            </View>
          </View>
        </>
      ) : (
        <>
          <Txt tone="bad" v="sm">
            {M.dockWarn}
          </Txt>
          <Btn
            block
            kind="danger"
            testID="players-release"
            disabled={state.busy}
            onPress={() => manager.confirm(true)}
          >
            {M.releaseBtn({ n: selected.length })}
          </Btn>
        </>
      )}
    </View>
  ) : null;
  useEffect(() => {
    setDock?.(dock);
    // 그릴 내용을 바꾸는 값이 바뀔 때만 다시 올린다.
  }, [selected.length, amount, state.confirm, state.busy, lossNote, c, setDock]);
  useEffect(() => () => setDock?.(null), [setDock]);

  const small = { fontSize: rem(FONT.caption) } as const;
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
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: RADIUS.md,
                  backgroundColor: c.surface,
                }}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Circle cx={11} cy={11} r={7} stroke={c.muted} strokeWidth={2.2} />
                  <Path
                    d="m20 20-3.5-3.5"
                    stroke={c.muted}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                </Svg>
                <TextInput
                  testID="players-search"
                  value={state.filter.q ?? ''}
                  onChangeText={(q) => manager.setFilter({ q: q || undefined })}
                  placeholder={L.searchPlaceholder}
                  placeholderTextColor={c.muted}
                  accessibilityLabel={L.searchLabel}
                  autoCorrect={false}
                  returnKeyType="search"
                  style={{ flex: 1, color: c.ink, fontSize: rem(FONT.body), paddingVertical: 10 }}
                />
              </View>
              {/* 포지션 칩은 좁은 화면에서도 한 줄(넘치면 가로로 민다). */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
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
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
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
                </View>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label={L.sortLabel}
                    testID="players-sort"
                    value={state.sort}
                    options={MANAGE_SORTS.map((k) => ({ value: k, label: MANAGE_SORT_LABEL[k]() }))}
                    onChange={(v) => manager.setSort(v)}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Txt tone="muted" testID="players-count" style={small}>
                  {L.shownCount({ n: shown.length, total: state.players.length })}
                </Txt>
                {filtered ? (
                  <Press
                    testID="players-reset"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() =>
                      manager.setFilter({ pos: undefined, nation: undefined, q: undefined })
                    }
                  >
                    <Txt tone="accent" style={small}>
                      {L.filterReset}
                    </Txt>
                  </Press>
                ) : null}
                <Press
                  testID="players-pick-all"
                  accessibilityRole="button"
                  hitSlop={8}
                  disabled={state.busy || state.confirm || !manager.eligible.length}
                  onPress={() => manager.selectAll()}
                  style={{ marginLeft: 'auto' }}
                >
                  <Txt tone="accent" bold style={small}>
                    {state.selected.size ? M.pickNone : L.pickLimit}
                  </Txt>
                </Press>
              </View>
            </View>
          ) : null}
          <View>
            {rows.length ? (
              rows.map((p) => {
                const locked = releaseLock(p, state.lineup);
                const tag = manageLockTag(p, state.lineup);
                const on = state.selected.has(p.careerId);
                const sw = CARD_TIER_SWATCH[cardTier(p.legendScore, p.peak)];
                const name = nameOf(p);
                const disabled = !!locked || state.busy || state.confirm;
                return (
                  <View
                    key={p.careerId}
                    testID={`managed-player-${p.careerId}`}
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: c.line,
                      backgroundColor: on ? mix(c.bad, c.bg, 0.07) : 'transparent',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64 }}>
                      <Press
                        accessibilityRole="checkbox"
                        accessibilityLabel={M.releasePickLabel({ name })}
                        accessibilityHint={locked ?? undefined}
                        accessibilityState={{ checked: on, disabled }}
                        disabled={disabled}
                        onPress={() => manager.toggle(p.careerId)}
                        style={{
                          width: 40,
                          height: 56,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            borderWidth: 2,
                            borderColor: locked ? c.line : on ? c.bad : c.muted,
                            backgroundColor: on ? c.bad : 'transparent',
                          }}
                        />
                      </Press>
                      <Press
                        testID={`player-detail-${p.careerId}`}
                        accessibilityRole="button"
                        accessibilityLabel={L.openRecord({ name })}
                        disabled={state.busy}
                        onPress={() => void openPublicLegendById(p.careerId)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingVertical: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 9,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: sw.base,
                            borderWidth: 1.5,
                            borderColor: sw.line,
                          }}
                        >
                          <Txt
                            num
                            style={{
                              color: sw.ink,
                              fontFamily: DISPLAY[700],
                              fontSize: rem(FONT.body),
                            }}
                          >
                            {p.peak}
                          </Txt>
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Txt bold numberOfLines={1}>
                            {name}
                          </Txt>
                          <Txt tone="muted" style={small}>
                            {manageRowInfo(p)}
                          </Txt>
                        </View>
                      </Press>
                      {tag ? (
                        <Press
                          testID={`release-tag-${p.careerId}`}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: whyFor === p.careerId }}
                          hitSlop={6}
                          onPress={() => setWhyFor(whyFor === p.careerId ? null : p.careerId)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: RADIUS.pill,
                            borderWidth: 1,
                            borderColor: c.line,
                            backgroundColor: c.surface,
                          }}
                        >
                          <Txt tone="muted" bold style={{ fontSize: rem(FONT.caption) }}>
                            {tag}
                          </Txt>
                        </Press>
                      ) : (
                        <View style={{ alignItems: 'flex-end', paddingLeft: 4 }}>
                          <Txt tone="muted" style={{ fontSize: 11 }}>
                            {L.releaseValueLabel}
                          </Txt>
                          <Txt num bold style={small}>
                            {fundsText(releaseValue(p, state.rate))}
                          </Txt>
                        </View>
                      )}
                      <Press
                        testID={`player-more-${p.careerId}`}
                        accessibilityRole="button"
                        accessibilityLabel={L.moreActions({ name })}
                        disabled={state.busy}
                        onPress={() => setMenuFor({ id: p.careerId, name })}
                        style={{
                          width: 40,
                          height: 44,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill={c.muted}>
                          <Circle cx={5} cy={12} r={2} />
                          <Circle cx={12} cy={12} r={2} />
                          <Circle cx={19} cy={12} r={2} />
                        </Svg>
                      </Press>
                    </View>
                    {locked && whyFor === p.careerId ? (
                      <Txt tone="muted" style={{ ...small, paddingLeft: 44, paddingBottom: 10 }}>
                        {locked}
                      </Txt>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Txt tone="muted">{state.players.length ? L.filterEmpty : L.noOwned}</Txt>
            )}
          </View>
          {shown.length > rows.length ? (
            <Btn testID="players-more" onPress={() => setLimit((n) => n + MANAGE_PAGE)}>
              {L.showMore({ n: shown.length - rows.length })}
            </Btn>
          ) : null}
          {/* 아래 고정 줄을 받을 화면이 아니면 목록 아래에 그린다. */}
          {!setDock && dock ? <Card>{dock}</Card> : null}
        </>
      )}
      {menuFor ? (
        <PopSheet label={menuFor.name} onClose={() => setMenuFor(null)} testID="player-menu">
          <View style={{ gap: 8 }}>
            <Txt bold>{menuFor.name}</Txt>
            <Btn
              block
              testID={`player-rename-${menuFor.id}`}
              accessibilityLabel={RN.entryLabel({ name: menuFor.name })}
              onPress={() => {
                setRenaming({ careerId: menuFor.id, name: menuFor.name });
                setMenuFor(null);
              }}
            >
              {RN.entry}
            </Btn>
            {physiqueOn ? (
              <Btn
                block
                onPress={() => {
                  setEditing({ id: menuFor.id, name: menuFor.name });
                  setMenuFor(null);
                }}
              >
                {I.physiqueTitle}
              </Btn>
            ) : null}
            <Btn block onPress={() => setMenuFor(null)}>
              {M.close}
            </Btn>
          </View>
        </PopSheet>
      ) : null}
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
