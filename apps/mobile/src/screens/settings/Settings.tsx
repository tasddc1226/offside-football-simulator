// 환경설정 화면(웹 Settings.svelte, T-10-009 · T-10-021) — 다크 모드 · 선수 이름 공개(T-10-065) 켜기/끄기, 백업,
// 구단 이름·엠블럼, 도움말·서비스 정책 링크. 이 설정들은 이 기기에만 저장된다. 계정·운영 도구는 구단주 화면에 있다.
// 앱에서 뺀 것(웹 전용): 효과음·배경음악·음량·음악 출처, '홈 화면에 추가하기' 안내.
import { nativeAnalytics } from '../../analytics';
import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { namePublicEnabled, setNamePublic } from '@offside/app-core/namePublic';
import { saveKey } from '@offside/game/storage';
import { SiteFooter } from '../../components/SiteFooter';
import { goFairness } from '../../game/nav';
import { openWeb } from '../../platform/openWeb';
import { appBuildInfo } from '../../platform/updates';
import { prefs } from '../../store';
import { useColors, useIsDark } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Card, Press, Screen, Topbar, Txt } from '../../ui';
import { BackupSettings } from './BackupSettings';
import { ClubCustomSettings } from './ClubCustomSettings';
import { AdFreeSettings } from './AdFreeSettings';
import { PushSettings } from './PushSettings';
import { ReviewSettings } from './ReviewSettings';
import { SelectField, SettingsCard, SettingsLabel, SettingsRow, Switch } from './parts';
import { settingsText as L } from '@offside/app-core/i18n/ko/settings';
import { LOCALE_NAMES, LOCALES, type Locale } from '@offside/app-core/i18n/core';
import { useSnapshot } from 'valtio';
import { saveLocale } from '../../platform/locale';

/** 정책·가이드는 웹 페이지를 앱 안 브라우저로 연다. id·onPress 항목은 앱 안 화면으로 간다. */
type LinkItem = { text: string; path: string } | { text: string; id: string; onPress: () => void };
function LinkList({ label, items }: { label: string; items: LinkItem[] }) {
  const c = useColors();
  return (
    <Card gap={0} style={{ padding: 0 }}>
      <View accessibilityLabel={label}>
        {items.map((it, i) => (
          <Press
            key={'id' in it ? it.id : it.path}
            scale={0.985}
            accessibilityRole="link"
            testID={`link-${'id' in it ? it.id : it.path.replaceAll('/', '')}`}
            onPress={() => ('id' in it ? it.onPress() : openWeb(it.path))}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 52,
              paddingHorizontal: 18,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: c.line,
            }}
          >
            <Txt style={{ fontSize: rem(0.9375), fontWeight: '600' }}>{it.text}</Txt>
            <Txt tone="accent" accessible={false}>
              ›
            </Txt>
          </Press>
        ))}
      </View>
    </Card>
  );
}

function Group({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 2, marginTop: 6 }}>
      <Txt tone="accent" v="eyebrow" style={{ paddingHorizontal: 2 }}>
        {eyebrow}
      </Txt>
      <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 8, paddingHorizontal: 2 }}>
        {title}
      </Txt>
      {children}
    </View>
  );
}

/** 앱 버전·OTA 업데이트 ID. 새 업데이트가 적용됐는지 확인할 때 본다. */
function BuildInfo() {
  const { version, build, updateId } = appBuildInfo();
  return (
    <Txt
      tone="muted"
      selectable
      testID="build-info"
      style={{ fontSize: rem(0.75), textAlign: 'center', paddingTop: 8 }}
    >
      {L.appVersion({ version, build })} ·{' '}
      {updateId ? L.updateId({ id: updateId }) : L.updateEmbedded}
    </Txt>
  );
}

export default function Settings() {
  const dark = useIsDark();
  const consent = useSyncExternalStore(nativeAnalytics.onConsent, nativeAnalytics.getConsent);
  const [namePublic, setNamePublicState] = useState(namePublicEnabled());
  const { lang } = useSnapshot(prefs);

  /** 언어: 이 기기에 저장하고 루트를 다시 그린다(_layout의 key). */
  const setLang = (l: Locale) => {
    saveLocale(l);
    prefs.lang = l;
  };

  /** 다크 모드: 고른 테마를 이 기기에 저장한다(고르지 않았으면 시스템 설정을 따른다). */
  const setDark = (on: boolean) => {
    const theme = on ? 'dark' : 'light';
    prefs.theme = theme;
    saveKey('ft_theme', theme);
  };

  return (
    <Screen>
      <Topbar />
      <View style={{ paddingHorizontal: 2, paddingTop: 4 }}>
        <Txt v="eyebrow">Settings</Txt>
        <Txt v="h1" accessibilityRole="header" style={{ marginTop: 2 }}>
          {L.title}
        </Txt>
      </View>

      <SettingsCard>
        <SettingsRow>
          <SettingsLabel eyebrow="Display" title={L.darkTitle} muted={L.darkBodyApp} />
          <Switch value={dark} onChange={setDark} label={L.darkTitle} testID="dark" />
        </SettingsRow>
        <SettingsRow first={false}>
          <SettingsLabel title={L.langTitle} muted={L.langBody} />
          <SelectField
            value={lang}
            options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
            onChange={setLang}
            label={L.langTitle}
            testID="lang"
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard>
        <SettingsRow>
          <SettingsLabel eyebrow="Privacy" title={L.namePublicTitle} muted={L.namePublicBody} />
          <Switch
            value={namePublic}
            onChange={(on) => {
              setNamePublic(on);
              setNamePublicState(on);
            }}
            label={L.namePublicTitle}
            testID="name-public"
          />
        </SettingsRow>
      </SettingsCard>

      {nativeAnalytics.enabled() ? (
        <SettingsCard>
          <SettingsRow>
            <SettingsLabel eyebrow="Privacy" title={L.analyticsTitle} muted={L.analyticsBody} />
            <Switch
              value={consent === 'granted'}
              onChange={(on) => nativeAnalytics.setConsent(on ? 'granted' : 'denied')}
              label={L.analyticsTitle}
              testID="analytics-consent"
            />
          </SettingsRow>
        </SettingsCard>
      ) : null}

      {/* T-10-116 진행 중 커리어 백업·불러오기 */}
      <BackupSettings />
      <AdFreeSettings />
      <PushSettings />
      <ReviewSettings />
      <ClubCustomSettings />

      <Group eyebrow="Help" title={L.help}>
        <LinkList
          label={L.help}
          items={[
            { text: L.guide, path: '/guide/' },
            { text: L.faq, path: '/faq/' },
            { text: L.fairness, id: 'fairness', onPress: goFairness },
          ]}
        />
      </Group>

      <Group eyebrow="Legal" title={L.legal}>
        <LinkList
          label={L.legal}
          items={[
            { text: L.terms, path: '/legal/terms/' },
            { text: L.privacy, path: '/legal/privacy/' },
          ]}
        />
      </Group>

      <BuildInfo />
      <SiteFooter />
    </Screen>
  );
}
