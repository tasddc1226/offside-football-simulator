// 환경설정 화면(웹 Settings.svelte, T-10-009 · T-10-021) — 다크 모드 · 선수 이름 공개(T-10-065) 켜기/끄기, 백업,
// 구단 이름·엠블럼, 도움말·서비스 정책 링크. 이 설정들은 이 기기에만 저장된다. 계정·운영 도구는 구단주 화면에 있다.
// 앱에서 뺀 것(웹 전용): 효과음·배경음악·음량·음악 출처, '홈 화면에 추가하기' 안내.
import { FONT } from '@offside/app-core/design-tokens';
import { publicDocPath } from '@offside/app-core/links';
import { setTextSize, TEXT_SIZES } from '@offside/app-core/textSize';
import { REVEAL_SHORT_KEY } from '@offside/app-core/reveal';
import { keyMomentsOn, setKeyMomentsOn } from '@offside/app-core/keyMomentPref';
import { keyMomentText as KM } from '@offside/app-core/i18n/ko/keyMoment';
import { revealText as RV } from '@offside/app-core/i18n/ko/reveal';
import { useTextSize } from '../../theme/useTextSize';
import { nativeAnalytics } from '../../analytics';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { namePublicEnabled, setNamePublic } from '@offside/app-core/namePublic';
import { saveKey } from '@offside/game/storage';
import { buzz } from '../../game/host';
import { SiteFooter } from '../../components/SiteFooter';
import { go, goFairness, goHome, goTypeDex, takeFocus } from '../../game/nav';
import { Account } from '../owner/Account';
import { LoginButtons } from '../owner/LoginButtons';
import { accountCache } from '../../store';
import { isMember } from '@offside/app-core/account';
import { fetchOwnerSummary } from '@offside/app-core/api/ownerSummary';
import { ownerText as OL } from '@offside/app-core/i18n/ko/owner';
import { replayCoach } from '../../components/Coachmark';
import { tutorialText as TU } from '@offside/app-core/i18n/ko/tutorial';
import { scrollBackTo } from '../../ui/scroll';
import { ItemsHint } from '../../components/ItemsHint';
import { firstGuideText as FG } from '@offside/app-core/i18n/ko/firstGuide';
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
import { ServerStatus } from './ServerStatus';
import {
  SelectField,
  SettingsCard,
  SettingsLabel,
  SettingsRow,
  SettingsTrigger,
  Switch,
} from './parts';
import { settingsText as L } from '@offside/app-core/i18n/ko/settings';
import { LOCALE_NAMES, LOCALES, type Locale } from '@offside/app-core/i18n/core';
import { useSnapshot } from 'valtio';
import { saveLocale } from '../../platform/locale';

/** 정책·가이드는 웹 페이지를 앱 안 브라우저로 연다. id·onPress 항목은 앱 안 화면으로 간다. */
type LinkItem =
  { text: string; path: string; id?: string } | { text: string; id: string; onPress: () => void };
function LinkList({ label, items }: { label: string; items: LinkItem[] }) {
  const c = useColors();
  return (
    <Card gap={0} style={{ padding: 0 }}>
      <View accessibilityLabel={label}>
        {items.map((it, i) => (
          <Press
            key={'path' in it ? (it.id ?? it.path) : it.id}
            scale={0.985}
            accessibilityRole="link"
            testID={`link-${'path' in it ? (it.id ?? it.path.replaceAll('/', '')) : it.id}`}
            onPress={() => ('onPress' in it ? it.onPress() : openWeb(it.path))}
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
            <Txt style={{ fontSize: rem(FONT.body1), fontWeight: '600' }}>{it.text}</Txt>
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
      style={{ fontSize: rem(FONT.caption), textAlign: 'center', paddingTop: 8 }}
    >
      {L.appVersion({ version, build })} ·{' '}
      {updateId ? L.updateId({ id: updateId }) : L.updateEmbedded}
    </Txt>
  );
}

function replayTutorial() {
  replayCoach();
  goHome();
}

export default function Settings() {
  const [focusBackup] = useState(() => takeFocus('backup'));
  // T-10-016 운영 도구 입구는 운영자에게만. 구글 연결 계정일 때만 서버에 묻는다(10분 메모, 익명이면 요청이 없다).
  const c = useColors();
  const cache = useSnapshot(accountCache);
  const acct = cache.value;
  const linked = !!acct && acct !== 'error' && isMember(acct);
  const guest = acct === null || (!!acct && acct !== 'error' && !isMember(acct));
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    setAdmin(false);
    if (linked) void fetchOwnerSummary().then((r) => alive && r.ok && setAdmin(r.data.admin));
    return () => {
      alive = false;
    };
  }, [linked]);
  const backupFocus = useRef(focusBackup);
  const dark = useIsDark();
  const textSize = useTextSize();
  const consent = useSyncExternalStore(nativeAnalytics.onConsent, nativeAnalytics.getConsent);
  const [namePublic, setNamePublicState] = useState(namePublicEnabled());
  const { lang, haptics, revealShort } = useSnapshot(prefs);

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

  /** T-11-426 결정적 장면 켜기 · 끄기: 이 기기에 저장한다(기본 켬). */
  const [keyMoments, setKeyMomentsState] = useState(keyMomentsOn());
  const setKeyMoments = (on: boolean) => {
    setKeyMomentsState(on);
    setKeyMomentsOn(on);
  };

  /** T-11-371 공개 연출 짧게: 이 기기에 저장한다. */
  const setRevealShort = (on: boolean) => {
    prefs.revealShort = on;
    saveKey(REVEAL_SHORT_KEY, on);
  };

  /** 진동: 이 기기에 저장한다. 켤 때 한 번 울려 어떤 느낌인지 보여 준다. */
  const setHaptics = (on: boolean) => {
    prefs.haptics = on;
    saveKey('ft_haptics', on);
    if (on) buzz();
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
      {/* T-11-567 계정(로그인 · 연동 · 로그아웃 · 탈퇴)과 운영 도구 입구는 내 구단 화면에서 설정 맨 위로 옮겼다. */}
      <View testID="account-slot" accessibilityLabel={OL.accountSection}>
        <SettingsCard>
          <Account />
          {guest ? (
            <View style={{ marginTop: 12 }}>
              <LoginButtons />
            </View>
          ) : null}
          {admin ? (
            <View
              style={{ marginTop: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: c.line }}
            >
              <SettingsTrigger testID="admin" label={OL.adminTools} onPress={() => go('admin')}>
                <SettingsLabel title={OL.adminTools} />
              </SettingsTrigger>
            </View>
          ) : null}
        </SettingsCard>
      </View>
      {/* T-11-355 상품 위치 안내(기기마다 닫을 때까지) */}
      <ItemsHint />

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
        <SettingsRow first={false}>
          <SettingsLabel title={L.textSizeTitle} muted={L.textSizeBody} />
          <SelectField
            value={textSize}
            options={TEXT_SIZES.map((value) => ({
              value,
              label: {
                small: L.textSizeSmall,
                standard: L.textSizeStandard,
                large: L.textSizeLarge,
                extraLarge: L.textSizeExtraLarge,
              }[value],
            }))}
            onChange={setTextSize}
            label={L.textSizeTitle}
            testID="text-size"
          />
        </SettingsRow>
        <SettingsRow first={false}>
          <SettingsLabel title={L.hapticsTitleApp} muted={L.hapticsBodyApp} />
          <Switch
            value={haptics}
            onChange={setHaptics}
            label={L.hapticsTitleApp}
            testID="haptics"
          />
        </SettingsRow>
        <SettingsRow first={false}>
          <SettingsLabel title={RV.shortTitle} muted={RV.shortBody} />
          <Switch
            value={revealShort}
            onChange={setRevealShort}
            label={RV.shortTitle}
            testID="reveal-short"
          />
        </SettingsRow>
        <SettingsRow first={false}>
          <SettingsLabel title={KM.settingTitle} muted={KM.settingBody} />
          <Switch
            value={keyMoments}
            onChange={setKeyMoments}
            label={KM.settingTitle}
            testID="key-moments"
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

      {/* T-10-116 진행 중 커리어 백업·불러오기. T-11-437 게임 화면 저장 위치 안내에서 왔으면 이 카드로 내린다. */}
      <View
        onLayout={(e) => {
          if (backupFocus.current) {
            backupFocus.current = false;
            scrollBackTo(e.nativeEvent.layout.y);
          }
        }}
      >
        <BackupSettings />
      </View>
      <AdFreeSettings />
      <PushSettings />
      <ReviewSettings />
      <ClubCustomSettings />

      <Group eyebrow="Help" title={L.help}>
        <LinkList
          label={L.help}
          items={[
            { text: L.guide, path: publicDocPath('/guide/'), id: 'guide' },
            { text: L.faq, path: publicDocPath('/faq/'), id: 'faq' },
            { text: L.fairness, id: 'fairness', onPress: goFairness },
            { text: FG.typeDex, id: 'type-dex', onPress: goTypeDex },
            // T-11-473 첫 커리어 따라가기 안내를 처음부터(홈으로 가서 새 커리어 버튼을 비춘다).
            { text: TU.replay, id: 'tutorial-replay', onPress: replayTutorial },
          ]}
        />
        {/* T-11-321 서버 상태(펼칠 때만 불러온다) */}
        <ServerStatus />
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
