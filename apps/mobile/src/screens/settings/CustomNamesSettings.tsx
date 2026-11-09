// 설정 화면의 '대회·수상 이름 바꾸기' 카드(웹 CustomNamesSettings.svelte, T-11-647) — 대회·수상·리그 이름을 이 기기에서만
// 바꾸고, 에디트 파일로 옮긴다. 저장은 웹과 같은 @offside/app-core/customNames(host의 set·reset·export·import).
// 앱과 다른 곳: 에디트 파일은 파일 대신 공유 시트(JSON 글) · 붙여넣기(구단 이름 카드와 같다).
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSnapshot } from 'valtio';
import {
  CUSTOM_NAME_MAX,
  CUSTOM_NAMES_LIMIT,
  CUSTOM_NAMES_NO_SPACE,
} from '@offside/app-core/customNames';
import {
  customNameCatalog,
  customNameSectionKey,
  type CustomNameGroup,
} from '@offside/app-core/customNamesCatalog';
import { customNamesText as T } from '@offside/app-core/i18n/ko/customNames';
import { tn, withDefaultNames } from '@offside/game/i18n/names';
import {
  exportCompIcons,
  exportCustomNames,
  importCompIcons,
  importCustomNames,
  resetCompIcons,
  resetCustomNames,
  setCustomName,
  toast,
} from '../../game/host';
import { appState, compIcons, customNames as customNamesState } from '../../store';
import { hasCompEmblem } from '@offside/app-core/compEmblem';
import { COMP_ICONS_NO_SPACE } from '@offside/app-core/compIcons';
import { compIconsText as CI } from '@offside/app-core/i18n/ko/compIcons';
import { CompIcon } from '../../ui/CompIcon';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Btn, Row, Txt } from '../../ui';
import { SettingsCard, SettingsLabel, SettingsTrigger, TextField } from './parts';

/** 한 번에 그리는 줄 수(더 보기로 늘린다). */
const PAGE = 40;
const original = (ko: string) => withDefaultNames(() => tn(ko));
const GROUPS: { id: CustomNameGroup; label: () => string }[] = [
  { id: 'comp', label: () => T.groupComp },
  { id: 'award', label: () => T.groupAward },
  { id: 'league', label: () => T.groupLeague },
];

/** 다 쓰고(포커스가 떠나거나 완료) 나서야 저장하는 입력 칸. 저장된 값이 바뀌면 칸도 따라간다. */
function CommitInput({
  value,
  onCommit,
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
} & Omit<React.ComponentProps<typeof TextField>, 'value' | 'onChangeText' | 'onEndEditing'>) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <TextField
      {...rest}
      value={draft}
      onChangeText={setDraft}
      onEndEditing={() => draft !== value && onCommit(draft)}
    />
  );
}

function rename(ko: string, value: string, changed: number) {
  if (setCustomName(ko, value)) return;
  toast(changed >= CUSTOM_NAMES_LIMIT ? T.limit : T.noSpace);
}

export function CustomNamesSettings() {
  const c = useColors();
  const { map } = useSnapshot(customNamesState);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<CustomNameGroup>('comp');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [importOpen, setImportOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const catalog = useMemo(() => (open ? customNameCatalog(appState.G) : null), [open]);
  const changed = Object.keys(map).length;
  // T-11-681 리그·대회 로고(이 기기에만). 에디트 파일에 이름과 함께 싣는다.
  const icons = useSnapshot(compIcons).map;
  const changedIcons = Object.keys(icons).length;
  const q = query.trim().toLowerCase();
  const items = (catalog?.[group] ?? []).filter(
    (x) => !q || `${x.ko} ${original(x.ko)} ${map[x.ko] ?? ''}`.toLowerCase().includes(q),
  );

  async function exportFile() {
    try {
      const text = JSON.stringify(
        { ...(JSON.parse(exportCustomNames()) as object), icons: exportCompIcons() },
        null,
        1,
      );
      await Share.share({ title: 'offside-names.json', message: text });
    } catch {
      toast(T.shareFail);
    }
  }
  function doImport(text: string) {
    const n = importCustomNames(text);
    if (n < 0) return toast(n === CUSTOM_NAMES_NO_SPACE ? T.noSpace : T.badFile);
    const got = importCompIcons(JSON.parse(text) as unknown);
    toast(
      got === COMP_ICONS_NO_SPACE
        ? CI.noSpace
        : got > 0
          ? `${T.imported({ n })} · ${CI.imported({ n: got })}`
          : T.imported({ n }),
    );
    setPasted('');
    setImportOpen(false);
  }
  async function pasteFromClipboard() {
    try {
      const t = await Clipboard.getStringAsync();
      if (!t.trim()) return toast(T.clipEmpty);
      setPasted(t);
    } catch {
      toast(T.clipFail);
    }
  }
  function resetAll() {
    Alert.alert(T.resetAll, T.resetAllConfirm, [
      { text: T.cancel, style: 'cancel' },
      {
        text: T.revert,
        style: 'destructive',
        onPress: () => {
          resetCustomNames();
          resetCompIcons();
          toast(T.allReset);
        },
      },
    ]);
  }

  return (
    <SettingsCard>
      <SettingsTrigger
        chev="▼"
        expanded={open}
        testID="settings-open-names"
        label={T.title}
        onPress={() => setOpen(!open)}
      >
        <SettingsLabel eyebrow="Name settings" title={T.title} />
      </SettingsTrigger>
      {open ? (
        <View
          style={{
            gap: 10,
            marginTop: 14,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: c.line,
          }}
        >
          <Txt tone="muted" v="sm">
            {T.intro}
          </Txt>
          <Txt tone="muted" v="xs">
            {T.local}
          </Txt>
          <View
            accessibilityLabel={T.group}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
          >
            {GROUPS.map((g) => (
              <Btn
                key={g.id}
                sm
                kind={group === g.id ? 'accent' : 'ghost'}
                testID={`name-group-${g.id}`}
                accessibilityState={{ selected: group === g.id }}
                onPress={() => {
                  setGroup(g.id);
                  setShown(PAGE);
                }}
              >
                {g.label()}
              </Btn>
            ))}
          </View>
          <TextField
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              setShown(PAGE);
            }}
            placeholder={T.search}
            accessibilityLabel={T.search}
            returnKeyType="search"
            testID="names-search"
          />
          {changed || changedIcons ? (
            <Txt tone="muted" v="xs" testID="names-changed">
              {[
                changed ? T.changed({ n: changed }) : '',
                changedIcons ? CI.changed({ n: changedIcons }) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
          ) : null}
          {items.length ? (
            <View style={{ gap: 8 }}>
              {items.slice(0, shown).map((x, i) => {
                const base = original(x.ko);
                const value = map[x.ko] ?? '';
                const head = i === 0 || items[i - 1]!.sec !== x.sec;
                return (
                  <View key={x.ko} style={{ gap: 8 }}>
                    {head ? (
                      <Txt
                        tone="muted"
                        v="xs"
                        testID={`name-sec-${x.sec}`}
                        style={{ fontWeight: '700', marginTop: i === 0 ? 0 : 6 }}
                      >
                        {T[customNameSectionKey(x.sec)]}
                      </Txt>
                    ) : null}
                    <View
                      testID={`name-${x.ko}`}
                      style={{
                        borderWidth: 1,
                        borderColor: c.line,
                        borderRadius: RADIUS.md,
                        padding: 8,
                        gap: 6,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {hasCompEmblem(x.ko) ? <CompIcon ko={x.ko} size={28} /> : null}
                        <Txt style={{ flexShrink: 1, fontSize: rem(FONT.body2) }}>{base}</Txt>
                        {icons[x.ko] ? (
                          <Txt tone="muted" v="xs">
                            {CI.custom}
                          </Txt>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <CommitInput
                          value={value}
                          onCommit={(v) => rename(x.ko, v, changed)}
                          maxLength={CUSTOM_NAME_MAX}
                          placeholder={base}
                          accessibilityLabel={T.nameLabel({ name: base })}
                          style={{ flex: 1, minWidth: 0 }}
                        />
                        {value ? (
                          <Btn sm testID="name-reset" onPress={() => rename(x.ko, '', changed)}>
                            {T.reset}
                          </Btn>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
              {items.length > shown ? (
                <Btn sm testID="names-more" onPress={() => setShown(shown + PAGE)}>
                  {T.more({ n: Math.min(PAGE, items.length - shown) })}
                </Btn>
              ) : null}
            </View>
          ) : (
            <Txt tone="muted" v="sm">
              {T.noMatch}
            </Txt>
          )}
          <Row gap={8}>
            <Btn sm testID="export-names" onPress={() => void exportFile()}>
              {T.exportFile}
            </Btn>
            <Btn sm testID="import-names" onPress={() => setImportOpen(!importOpen)}>
              {T.importFile}
            </Btn>
            <Btn sm disabled={!changed && !changedIcons} onPress={resetAll}>
              {T.resetAll}
            </Btn>
          </Row>
          {importOpen ? (
            <View style={{ gap: 8 }}>
              <TextField
                value={pasted}
                onChangeText={setPasted}
                multiline
                placeholder={T.importPlaceholder}
                accessibilityLabel={T.importPasteLabel}
                testID="import-names-text"
                returnKeyType="default"
                style={{ minHeight: 80, maxHeight: 140, fontSize: 14 }}
              />
              <Row gap={8}>
                <Btn sm disabled={!pasted.trim()} onPress={() => doImport(pasted)}>
                  {T.importBtn}
                </Btn>
                <Btn sm onPress={() => void pasteFromClipboard()}>
                  {T.pasteClipboard}
                </Btn>
              </Row>
            </View>
          ) : null}
        </View>
      ) : null}
    </SettingsCard>
  );
}
