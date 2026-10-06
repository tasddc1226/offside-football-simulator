// 국적 고르기(웹 NationPicker.svelte): 한글·초성으로 찾는 목록. 연맹별로 묶어 가나다순, 대한민국은 맨 위.
// 웹은 입력 칸 아래 콤보박스를 펼치지만, 앱은 키보드가 아래 목록을 가리므로 입력 칸을 누르면 아래에서 올라오는
// 창(Modal)에 검색 칸 + 목록을 띄우고 KeyboardAvoidingView로 키보드 위에 맞춘다.
import { useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SectionList,
  TextInput,
  View,
  type SectionListData,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flagOf, nationOf, type Nation } from '@offside/game/nation';
import { nationGroups, type NationGroup } from '@offside/app-core/nationSearch';
import { createText as L } from '@offside/app-core/i18n/ko/create';
import { alpha } from '../../theme/colors';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Press, Txt } from '../../ui';
import { tn } from '@offside/game/i18n/names';

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
  const groups = useMemo(() => nationGroups(query), [query]);

  const show = () => {
    // 이름·체격 입력의 포커스를 남기면 검색 창을 닫을 때 그 키보드가 다시 올라온다.
    Keyboard.dismiss();
    setQuery('');
    setOpen(true);
  };
  const hide = () => {
    Keyboard.dismiss();
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
        accessibilityLabel={L.nationA11y({ name: tn(selected.ko) })}
        accessibilityHint={L.nationHint}
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
          {tn(selected.ko)}
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
          <Press
            onPress={hide}
            accessibilityLabel={L.nationCloseLabel}
            style={{ flex: 1 }}
            scale={1}
          >
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
                accessibilityLabel={L.nationSearchLabel}
                placeholder={L.nationSearchPlaceholder}
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
                accessibilityLabel={L.close}
                style={{
                  minWidth: 48,
                  minHeight: 48,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Txt tone="muted" bold>
                  {L.close}
                </Txt>
              </Press>
            </View>
            <SectionList<Nation, NationGroup>
              sections={groups}
              keyExtractor={(n) => n.code}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              stickySectionHeadersEnabled
              initialNumToRender={24}
              contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}
              renderSectionHeader={({
                section,
              }: {
                section: SectionListData<Nation, NationGroup>;
              }) => (
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
                    accessibilityLabel={tn(n.ko)}
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
                      {tn(n.ko)}
                    </Txt>
                  </Press>
                );
              }}
              ListEmptyComponent={
                <Txt tone="muted" center style={{ paddingVertical: 14, paddingHorizontal: 10 }}>
                  {L.nationEmpty}
                </Txt>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
