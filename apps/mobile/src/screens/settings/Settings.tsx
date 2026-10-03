// 환경설정 화면(웹 Settings.svelte, T-10-009 · T-10-021) — 다크 모드 · 선수 이름 공개(T-10-065) 켜기/끄기, 백업,
// 구단 이름·엠블럼, 도움말·서비스 정책 링크. 이 설정들은 이 기기에만 저장된다. 계정·운영 도구는 구단주 화면에 있다.
// 앱에서 뺀 것(웹 전용): 효과음·배경음악·음량·음악 출처, '홈 화면에 추가하기' 안내.
import { nativeAnalytics } from '../../analytics';
import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { namePublicEnabled, setNamePublic } from '@offside/app-core/namePublic';
import { saveKey } from '@offside/game/season';
import { SiteFooter } from '../../components/SiteFooter';
import { openWeb } from '../../platform/openWeb';
import { prefs } from '../../store';
import { useColors, useIsDark } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Card, Press, Screen, Topbar, Txt } from '../../ui';
import { BackupSettings } from './BackupSettings';
import { ClubCustomSettings } from './ClubCustomSettings';
import { SettingsCard, SettingsLabel, SettingsRow, Switch } from './parts';

/** 정책·가이드는 웹 페이지를 앱 안 브라우저로 연다. */
function LinkList({ label, items }: { label: string; items: { text: string; path: string }[] }) {
  const c = useColors();
  return (
    <Card gap={0} style={{ padding: 0 }}>
      <View accessibilityLabel={label}>
        {items.map((it, i) => (
          <Press
            key={it.path}
            scale={0.985}
            accessibilityRole="link"
            testID={`link-${it.path.replaceAll('/', '')}`}
            onPress={() => openWeb(it.path)}
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

export default function Settings() {
  const dark = useIsDark();
  const consent = useSyncExternalStore(nativeAnalytics.onConsent, nativeAnalytics.getConsent);
  const [namePublic, setNamePublicState] = useState(namePublicEnabled());

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
          환경설정
        </Txt>
      </View>

      <SettingsCard>
        <SettingsRow>
          <SettingsLabel
            eyebrow="Display"
            title="다크 모드"
            muted="어두운 화면으로 봐요. 이 기기에 저장돼요."
          />
          <Switch value={dark} onChange={setDark} label="다크 모드" testID="dark" />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard>
        <SettingsRow>
          <SettingsLabel
            eyebrow="Privacy"
            title="선수 이름 공개"
            muted="홈 라이브 현황·명예의 전당·서버 최초 업적에 선수 이름이 보여요. 끄면 '익명의 공격수'처럼 표시되고, 다음 시즌 기록부터 반영돼요. 실명은 쓰지 않는 게 좋아요."
          />
          <Switch
            value={namePublic}
            onChange={(on) => {
              setNamePublic(on);
              setNamePublicState(on);
            }}
            label="선수 이름 공개"
            testID="name-public"
          />
        </SettingsRow>
      </SettingsCard>

      {nativeAnalytics.enabled() ? (
        <SettingsCard>
          <SettingsRow>
            <SettingsLabel
              eyebrow="Privacy"
              title="앱 이용 분석 동의 (선택)"
              muted="동의하면 Google Analytics로 화면 방문과 커리어 시작·진행·은퇴, 기기·앱 버전·세션 정보를 분석해요. 선수 이름·계정 정보·저장 파일은 보내지 않아요. 언제든 끌 수 있고, 동의 전 활동은 전송하지 않아요."
            />
            <Switch
              value={consent === 'granted'}
              onChange={(on) => nativeAnalytics.setConsent(on ? 'granted' : 'denied')}
              label="앱 이용 분석 동의 (선택)"
              testID="analytics-consent"
            />
          </SettingsRow>
        </SettingsCard>
      ) : null}

      {/* T-10-116 진행 중 커리어 백업·불러오기 */}
      <BackupSettings />
      <ClubCustomSettings />

      <Group eyebrow="Help" title="도움말">
        <LinkList
          label="도움말"
          items={[
            { text: '게임 가이드', path: '/guide/' },
            { text: '자주 묻는 질문', path: '/faq/' },
          ]}
        />
      </Group>

      <Group eyebrow="Legal" title="서비스 정책">
        <LinkList
          label="서비스 정책"
          items={[
            { text: '이용약관', path: '/legal/terms/' },
            { text: '개인정보 처리방침', path: '/legal/privacy/' },
          ]}
        />
      </Group>

      <SiteFooter />
    </Screen>
  );
}
