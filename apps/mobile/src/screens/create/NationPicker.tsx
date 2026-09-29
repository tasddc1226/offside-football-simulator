// 국적 고르기(웹 NationPicker.svelte): 한글·초성으로 찾는 목록. 연맹별로 묶어 가나다순, 대한민국은 맨 위.
// 웹은 입력 칸 아래 콤보박스를 펼치지만, 앱은 키보드가 아래 목록을 가리므로 입력 칸을 누르면 아래에서 올라오는
// 창(Modal)에 검색 칸 + 목록을 띄우고 KeyboardAvoidingView로 키보드 위에 맞춘다.
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SectionList,
  TextInput,
  View,
  type SectionListData,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONFEDS, CONF_ORDER, DEFAULT_NATION, NATIONS } from '@offside/contracts/nations';
import { KR, flagOf, nationOf, type Nation } from '@offside/game/nation';
import { koMatchAt } from '@offside/app-core/koSearch';
import { alpha } from '../../theme/colors';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Press, Txt } from '../../ui';

const byKo = new Intl.Collator('ko').compare;
interface Group {
  key: string;
  label: string;
  data: Nation[];
}
const GROUPS: Group[] = [
  { key: 'KR', label: '기본', data: [KR] },
  ...CONF_ORDER.map((conf) => ({
    key: conf,
    label: `${CONFEDS[conf].region} (${conf})`,
    data: NATIONS.filter((n) => n.conf === conf && n.code !== DEFAULT_NATION).sort((a, b) =>
      byKo(a.ko, b.ko),
    ),
  })),
];

export function NationPicker({
  value,
  onChange,
  testID,
}: {
  value: string;
  onChange: (code: string) => void;
  testID?: string;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = nationOf({ nation: value });

  // 검색 중엔 연맹 묶음 대신 한 목록으로, 이름이 검색어로 시작하는 나라부터.
  const groups = useMemo<Group[]>(() => {
    if (!query) return GROUPS;
    const hits = NATIONS.map((n) => ({ n, at: koMatchAt(n.ko, query) }))
      .filter((h) => h.at >= 0)
      .sort((a, b) => a.at - b.at || byKo(a.n.ko, b.n.ko));
    return hits.length
      ? [{ key: 'hits', label: `검색 결과 ${hits.length}`, data: hits.map((h) => h.n) }]
      : [];
  }, [query]);

  const show = () => {
    setQuery('');
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (n: Nation) => {
    onChange(n.code);
    hide();
  };

  return (
    <>
      <Press
        scale={0.99}
        onPress={show}
        {...(testID ? { testID } : {})}
        accessibilityLabel={`국적 ${selected.ko}`}
        accessibilityHint="누르면 나라를 검색해서 고를 수 있어요"
        accessibilityRole="combobox"
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 48,
          paddingHorizontal: 13,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 10,
          backgroundColor: c.surface2,
        }}
      >
        <Txt style={{ fontSize: rem(1.125) }} accessibilityElementsHidden>
          {flagOf(selected.code)}
        </Txt>
        <Txt numberOfLines={1} style={{ flex: 1, fontSize: 16 }}>
          {selected.ko}
        </Txt>
        <Txt tone="muted" accessibilityElementsHidden>
          ▾
        </Txt>
      </Press>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={hide}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim }}
        >
          {/* 바깥을 누르면 닫는다 */}
          <Press onPress={hide} accessibilityLabel="국적 고르기 닫기" style={{ flex: 1 }} scale={1}>
            <View style={{ flex: 1 }} />
          </Press>
          <View
            style={{
              height: '80%',
              backgroundColor: c.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 12,
                paddingBottom: 8,
              }}
            >
              <TextInput
                {...(testID ? { testID: `${testID}-search` } : {})}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                returnKeyType="search"
                accessibilityLabel="국적 검색"
                placeholder="나라 이름이나 초성(ㅂㄹㅈ)"
                placeholderTextColor={c.muted}
                value={query}
                onChangeText={setQuery}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: 10,
                  backgroundColor: c.surface2,
                  paddingVertical: 11,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: c.ink,
                }}
              />
              <Press
                onPress={hide}
                accessibilityLabel="닫기"
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}
              >
                <Txt tone="muted" bold>
                  닫기
                </Txt>
              </Press>
            </View>
            <SectionList<Nation, Group>
              sections={groups}
              keyExtractor={(n) => n.code}
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled
              initialNumToRender={24}
              contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}
              renderSectionHeader={({ section }: { section: SectionListData<Nation, Group> }) => (
                <View
                  style={{
                    paddingTop: 8,
                    paddingBottom: 4,
                    paddingHorizontal: 10,
                    backgroundColor: c.surface,
                  }}
                >
                  <Txt
                    accessibilityRole="header"
                    style={{ color: c.muted, fontSize: rem(0.75), fontWeight: '600' }}
                  >
                    {section.label}
                  </Txt>
                </View>
              )}
              renderItem={({ item: n }) => {
                const on = n.code === value;
                return (
                  <Press
                    scale={0.99}
                    onPress={() => pick(n)}
                    testID={`nation-${n.code}`}
                    accessibilityLabel={n.ko}
                    accessibilityState={{ selected: on }}
                    style={(pressed) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: pressed ? alpha(c.ink, 0.06) : 'transparent',
                    })}
                  >
                    <Txt accessibilityElementsHidden>{flagOf(n.code)}</Txt>
                    <Txt
                      style={{ flex: 1, ...(on ? { fontWeight: '700', color: c.accentText } : {}) }}
                    >
                      {n.ko}
                    </Txt>
                  </Press>
                );
              }}
              ListEmptyComponent={
                <Txt tone="muted" center style={{ paddingVertical: 14, paddingHorizontal: 10 }}>
                  찾는 나라가 없어요
                </Txt>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
