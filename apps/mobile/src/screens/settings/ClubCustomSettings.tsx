// 설정 화면의 '구단 이름·엠블럼 변경' 카드(웹 ClubCustomSettings.svelte, T-10-009) — 리그별 클럽 이름·엠블럼 편집,
// 에디트 파일 내보내기/가져오기. 저장·동기화는 웹과 같은 @offside/app-core/clubCustom(host의 set·reset·export·import).
// 앱과 다른 곳: ① 엠블럼 이미지 올리기는 이미지 선택 라이브러리가 없어 뺐다(이미 계정에서 받은 이미지는 '이미지 빼기'만
// 된다). ② 색은 색 선택 칸 대신 #rrggbb 입력 + 색 견본 고르기. ③ 에디트 파일은 파일 대신 공유 시트(JSON 글) · 붙여넣기.
import { useEffect, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSnapshot } from 'valtio';
import { LEAGUES } from '@offside/game/data';
import { CLUB_NAME_MAX, LOGO_TEXT_MAX, logoOf, type ClubLogo } from '@offside/game/clubs';
import { clubsIn } from '@offside/game/engine';
import { CLUB_SYNC_TEXT } from '@offside/app-core/clubCustom';
import {
  exportClubCustom,
  importClubCustom,
  resetClubCustom,
  setClubCustom,
  toast,
} from '../../game/host';
import { clubCustom as clubCustomState } from '../../store';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Btn, ClubBadge, Press, Row, Txt } from '../../ui';
import { SelectField, SettingsCard, SettingsLabel, SettingsTrigger, TextField } from './parts';
import { clubText as T } from '@offside/app-core/i18n/ko/club';
import { tn } from '@offside/game/i18n/names';

const fail = () => toast(T.noSpace);

/** 색 견본(웹 <input type=color> 자리). */
const SWATCHES = [
  '#ffffff',
  '#14201a',
  '#c0392f',
  '#e67e22',
  '#f0b437',
  '#1e7a50',
  '#1c4a35',
  '#1f63a8',
  '#0b2a5b',
  '#7336b0',
  '#e84393',
  '#5c6b62',
];
const HEX6 = /^#[0-9a-f]{6}$/i;
const HEX3 = /^#[0-9a-f]{3}$/i;
/** #rgb → #rrggbb, 잘못된 값은 null. */
function normHex(v: string): string | null {
  const t = v.trim();
  const h = t.startsWith('#') ? t : `#${t}`;
  if (HEX6.test(h)) return h.toLowerCase();
  if (HEX3.test(h)) return `#${[...h.slice(1)].map((x) => x + x).join('')}`.toLowerCase();
  return null;
}

/** 다 쓰고(포커스가 떠나거나 완료) 나서야 저장하는 입력 칸(웹 onchange). 저장된 값이 바뀌면 칸도 따라간다. */
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

/** 색 한 칸: 견본 + #rrggbb 입력, 견본 누르면 견본 고르기. */
function ColorField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (hex: string) => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (v: string) => {
    const hex = normHex(v);
    if (!hex) return setDraft(value); // 잘못된 값은 되돌린다.
    setDraft(hex);
    if (hex !== value.toLowerCase()) onCommit(hex);
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Txt style={{ fontSize: rem(0.8125) }}>{label}</Txt>
        <Press
          accessibilityLabel={T.pickColor({ label })}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(!open)}
          hitSlop={4}
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 32,
              height: 28,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: value,
            }}
          />
        </Press>
        <TextField
          value={draft}
          onChangeText={setDraft}
          onEndEditing={() => commit(draft)}
          maxLength={7}
          accessibilityLabel={T.colorValue({ label })}
          style={{ width: 104, fontSize: 16 }}
        />
      </View>
      {open ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SWATCHES.map((hex) => (
            <Press
              key={hex}
              accessibilityLabel={`${label} ${hex}`}
              onPress={() => {
                setOpen(false);
                commit(hex);
              }}
              hitSlop={4}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: hex,
                borderWidth: hex.toLowerCase() === value.toLowerCase() ? 3 : 1,
                borderColor: hex.toLowerCase() === value.toLowerCase() ? c.accent : c.line,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ClubRow({
  club,
  logo,
  name,
  open,
  toggle,
}: {
  club: { id: string; name: string; baseName?: string | undefined };
  logo: ClubLogo;
  name: string;
  open: boolean;
  toggle: () => void;
}) {
  const c = useColors();
  const editLogo = (patch: Partial<ClubLogo>) => {
    if (!setClubCustom(club.id, { logo: { ...logo, ...patch } })) fail();
  };
  const dropImage = () => {
    const next = { ...logo };
    delete next.img;
    if (!setClubCustom(club.id, { logo: next })) fail();
  };
  return (
    <View
      testID={`club-${club.id}`}
      style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 8 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ClubBadge club={club} size={34} />
        <CommitInput
          value={name}
          onCommit={(v) => {
            if (!setClubCustom(club.id, { name: v })) fail();
          }}
          maxLength={CLUB_NAME_MAX}
          placeholder={tn(club.baseName ?? club.name)}
          accessibilityLabel={T.nameLabel({ name: tn(club.baseName ?? club.name) })}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Btn
          sm
          testID="logo"
          accessibilityLabel={T.emblemLabel({ name: tn(club.baseName ?? club.name) })}
          onPress={toggle}
        >
          {T.emblem}
        </Btn>
      </View>
      {open ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt style={{ fontSize: rem(0.8125) }}>{T.logoText}</Txt>
            <CommitInput
              value={logo.text}
              onCommit={(v) => editLogo({ text: v })}
              maxLength={LOGO_TEXT_MAX}
              accessibilityLabel={T.logoTextLabel}
              autoCapitalize="characters"
              style={{ width: rem(0.8125) * 4.5 + 24 }}
            />
          </View>
          <ColorField label={T.bg} value={logo.bg} onCommit={(hex) => editLogo({ bg: hex })} />
          <ColorField label={T.fg} value={logo.fg} onCommit={(hex) => editLogo({ fg: hex })} />
          <Row gap={8}>
            {logo.img ? (
              <Btn sm onPress={dropImage}>
                {T.dropImage}
              </Btn>
            ) : null}
            <Btn sm onPress={() => void resetClubCustom([club.id])}>
              {T.reset}
            </Btn>
          </Row>
        </View>
      ) : null}
    </View>
  );
}

export function ClubCustomSettings() {
  const c = useColors();
  const { map, status } = useSnapshot(clubCustomState);
  const [clubsOpen, setClubsOpen] = useState(false);
  const [leagueId, setLeagueId] = useState(LEAGUES[LEAGUES.length - 1]!.id);
  const [open, setOpen] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  // 이름 편집 결과가 다시 CLUBS에서 읽히도록 map(구독)을 함께 본다.
  const clubs = clubsIn(leagueId).map((cl) => ({ ...cl }));

  async function exportFile() {
    try {
      await Share.share({ title: 'offside-clubs.json', message: exportClubCustom() });
    } catch {
      toast(T.shareFail);
    }
  }
  function doImport(text: string) {
    const n = importClubCustom(text);
    toast(n < 0 ? T.badFile : T.imported({ n }));
    if (n >= 0) {
      setPasted('');
      setImportOpen(false);
    }
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
  function resetLeague() {
    resetClubCustom(clubsIn(leagueId).map((cl) => cl.id));
    toast(T.leagueReset);
  }
  function resetAll() {
    Alert.alert(T.resetAll, T.resetAllConfirm, [
      { text: T.cancel, style: 'cancel' },
      {
        text: T.revert,
        style: 'destructive',
        onPress: () => {
          resetClubCustom();
          toast(T.allReset);
        },
      },
    ]);
  }

  return (
    <SettingsCard>
      <SettingsTrigger
        chev="▼"
        expanded={clubsOpen}
        testID="settings-open-clubs"
        label={T.title}
        onPress={() => setClubsOpen(!clubsOpen)}
      >
        <SettingsLabel eyebrow="Team settings" title={T.title} />
      </SettingsTrigger>
      {clubsOpen ? (
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
          <Txt tone="muted" v="xs" accessibilityLiveRegion="polite" testID={`club-sync-${status}`}>
            {CLUB_SYNC_TEXT[status]}
          </Txt>
          <View style={{ gap: 6 }}>
            <Txt tone="muted" style={{ fontSize: rem(0.8125), fontWeight: '600' }}>
              {T.league}
            </Txt>
            <SelectField
              label={T.league}
              testID="club-league"
              value={leagueId}
              options={LEAGUES.map((L) => ({
                value: L.id,
                label: T.leagueOption({ name: tn(L.name), n: clubsIn(L.id).length }),
              }))}
              onChange={(v) => {
                setLeagueId(v);
                setOpen(null);
              }}
            />
          </View>
          <View style={{ gap: 8 }}>
            {clubs.map((cl) => (
              <ClubRow
                key={cl.id}
                club={cl}
                logo={logoOf(cl, map)}
                name={map[cl.id]?.name ?? ''}
                open={open === cl.id}
                toggle={() => setOpen(open === cl.id ? null : cl.id)}
              />
            ))}
          </View>
          <Row gap={8}>
            <Btn sm onPress={resetLeague}>
              {T.resetLeague}
            </Btn>
            <Btn sm testID="export-clubs" onPress={() => void exportFile()}>
              {T.exportFile}
            </Btn>
            <Btn sm testID="import-clubs" onPress={() => setImportOpen(!importOpen)}>
              {T.importFile}
            </Btn>
            <Btn sm onPress={resetAll}>
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
                testID="import-clubs-text"
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
