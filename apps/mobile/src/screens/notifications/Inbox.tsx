import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { useSnapshot } from 'valtio';
import {
  NotificationIdSchema,
  type AppNotification,
  type NotificationTarget,
} from '@offside/contracts';
import { inboxState, inbox, loadInbox, openInbox, openInboxTarget } from '../../platform/inbox';
import { Btn, Card, Press, Screen, Txt as BaseTxt } from '../../ui';
import type { TxtProps } from '../../ui/Txt';
import { useColors } from '../../theme/useColors';
import { inboxText as L } from '@offside/app-core/i18n/ko/inbox';
import { intlLocale } from '@offside/app-core/i18n/core';

// 큰 시스템 글자에서도 고정 줄 높이로 글리프가 잘리지 않게 기본 서체의 줄 높이를 사용한다.
function InboxText({ style, ...props }: TxtProps) {
  const { fontScale } = useWindowDimensions();
  return (
    <BaseTxt
      key={fontScale}
      {...props}
      style={[style, fontScale > 1.2 && { lineHeight: undefined }]}
    />
  );
}

const labels = (): Record<AppNotification['kind'], string> => ({
  news: L.kindNews,
  test: L.kindTest,
  return: L.kindReturn,
  team: L.kindTeam,
  market: L.kindMarket,
  social: L.kindSocial,
  community: L.kindCommunity,
});
const paths = {
  back: 'm15 18-6-6 6-6',
  next: 'm9 6 6 6-6 6',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  check: 'm5 12 4 4L19 6',
};
function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={paths[name]}
        fill="none"
        stroke={c.muted}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function stamp(at: string) {
  return new Date(at).toLocaleString(intlLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function dayLabel(at: string) {
  const date = new Date(at);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return L.today;
  if (date.toDateString() === yesterday.toDateString()) return L.yesterday;
  return date.toLocaleDateString(intlLocale(), {
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}
function targetLabel(target: NotificationTarget, kind?: AppNotification['kind']) {
  if (target.type === 'board') return target.board === 'release' ? L.goRelease : L.goNotice;
  if (target.screen === 'team' && kind === 'social') return L.goFriends;
  if (target.screen === 'team' && kind === 'team') return L.goMatches;
  return {
    home: L.goHome,
    owner: L.goOwner,
    team: L.goTeam,
    market: L.goMarket,
    settings: L.goSettings,
    chat: L.goChat,
  }[target.screen];
}

export default function Inbox() {
  const { fontScale, height } = useWindowDimensions();
  const scrollControls = fontScale > 1.3 || height < 500;
  const state = useSnapshot(inboxState);
  const params = useLocalSearchParams<{ id?: string }>();
  const id =
    typeof params.id === 'string' && NotificationIdSchema.safeParse(params.id).success
      ? params.id
      : null;
  const c = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    void loadInbox().then(() => {
      if (id) void inbox.open(id);
    });
  }, [id, state.revision]);
  useEffect(() => {
    setNotice('');
  }, [id, state.onlyUnread, state.revision]);
  const detail = id && state.detail?.id === id ? state.detail : null;
  async function refresh() {
    if (state.busy || refreshing) return;
    setNotice('');
    setRefreshing(true);
    try {
      await loadInbox({ refresh: true });
    } finally {
      setRefreshing(false);
    }
  }
  async function readAll() {
    setNotice('');
    await inbox.readAll();
    if (!inboxState.error) setNotice(L.readAllDone);
  }
  const error = state.error ? (
    <Card gap={12}>
      <InboxText tone="bad" accessibilityLiveRegion="polite">
        {state.error}
      </InboxText>
      <Btn block disabled={state.busy} onPress={() => (id ? void inbox.open(id) : void refresh())}>
        {L.retry}
      </Btn>
    </Card>
  ) : null;
  const loading =
    state.busy && !refreshing ? (
      <View
        accessibilityLiveRegion="polite"
        style={{ gap: 8, alignItems: 'center', paddingVertical: 24 }}
      >
        <ActivityIndicator color={c.accentText} />
        <InboxText tone="muted">{L.checking}</InboxText>
      </View>
    ) : null;
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Press
        scale={1}
        testID="inbox-back"
        accessibilityLabel={id ? L.backToInbox : L.backPrev}
        onPress={() =>
          id
            ? router.dismissTo('/notifications')
            : router.canGoBack()
              ? router.back()
              : router.replace('/')
        }
        style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="back" size={24} />
      </Press>
      <InboxText v="h1" accessibilityRole="header" style={{ flex: 1 }}>
        {id ? L.detailTitle : L.title}
      </InboxText>
      {!id ? (
        <Press
          scale={1}
          testID="inbox-refresh"
          accessibilityLabel={L.refreshAria}
          accessibilityState={{ disabled: state.busy || refreshing, busy: refreshing }}
          disabled={state.busy || refreshing}
          onPress={() => void refresh()}
          style={{
            minWidth: 48,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: state.busy ? 0.5 : 1,
          }}
        >
          {refreshing ? (
            <ActivityIndicator color={c.accentText} />
          ) : (
            <Icon name="refresh" size={24} />
          )}
        </Press>
      ) : null}
    </View>
  );

  if (id)
    return (
      <Screen gap={20}>
        {header}
        {detail ? (
          <Card gap={20} testID="inbox-detail">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <InboxText tone="accent" bold>
                {labels()[detail.kind]}
              </InboxText>
              <InboxText tone="muted" v="sm">
                {detail.readAt ? L.read : L.unread}
              </InboxText>
            </View>
            <InboxText v="h1" accessibilityRole="header">
              {detail.title}
            </InboxText>
            <InboxText tone="muted" v="sm">
              {stamp(detail.createdAt)}
            </InboxText>
            <View style={{ height: 1, backgroundColor: c.line }} />
            <InboxText selectable style={{ fontSize: 16, lineHeight: 27 }}>
              {detail.body}
            </InboxText>
            <Btn
              block
              kind="primary"
              onPress={() => openInboxTarget(detail.target, detail.kind, detail.id)}
            >
              {targetLabel(detail.target, detail.kind)}
            </Btn>
            {!detail.readAt && !state.busy ? (
              <Btn block onPress={() => void inbox.read(detail.id)}>
                {L.markRead}
              </Btn>
            ) : null}
          </Card>
        ) : !state.busy && !state.error ? (
          <Card gap={12}>
            <InboxText bold>{L.notFound}</InboxText>
            <InboxText tone="muted">{L.notFoundBody}</InboxText>
            <Btn block onPress={() => router.dismissTo('/notifications')}>
              {L.backToInbox}
            </Btn>
          </Card>
        ) : null}
        {error}
        {loading}
      </Screen>
    );

  const controls = (
    <View
      style={{
        paddingHorizontal: scrollControls ? 0 : 16,
        paddingBottom: 12,
        gap: 12,
        width: '100%',
        maxWidth: 720,
        alignSelf: 'center',
      }}
    >
      {header}
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          padding: 4,
          borderRadius: 16,
          backgroundColor: c.surface2,
          borderWidth: 1,
          borderColor: c.line,
        }}
      >
        {[false, true].map((unread) => (
          <Press
            key={String(unread)}
            scale={1}
            testID={unread ? 'inbox-filter-unread' : 'inbox-filter-all'}
            accessibilityRole="tab"
            accessibilityLabel={unread ? L.unreadAriaN({ n: state.unreadCount }) : L.allAria}
            accessibilityState={{ selected: state.onlyUnread === unread, disabled: state.busy }}
            disabled={state.busy}
            onPress={() => void loadInbox({ unread })}
            style={{
              flex: 1,
              minHeight: 48,
              padding: 10,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: state.onlyUnread === unread ? c.pitch : 'transparent',
              opacity: state.busy ? 0.6 : 1,
            }}
          >
            <InboxText
              bold
              center
              style={{ color: state.onlyUnread === unread ? c.onPitch : c.muted }}
            >
              {unread ? L.unreadN({ n: state.unreadCount }) : L.all}
            </InboxText>
          </Press>
        ))}
      </View>
    </View>
  );

  return (
    <Screen fixed gap={0} style={{ paddingHorizontal: 0 }}>
      {!scrollControls ? controls : null}
      <FlatList
        key={String(state.onlyUnread)}
        data={state.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32,
          maxWidth: 720,
          width: '100%',
          alignSelf: 'center',
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={c.accentText}
            colors={[c.accentText]}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 8 }}>
            {scrollControls ? controls : null}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <InboxText tone="muted" v="sm">
                {L.recent90}
              </InboxText>
              <Press
                scale={1}
                testID="inbox-read-all"
                disabled={state.busy || !state.items.length || !state.unreadCount}
                accessibilityState={{
                  disabled: state.busy || !state.items.length || !state.unreadCount,
                }}
                onPress={() => void readAll()}
                style={{
                  minHeight: 48,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  opacity: state.busy || !state.items.length || !state.unreadCount ? 0.45 : 1,
                }}
              >
                <InboxText tone="accent" bold>
                  {L.readAll}
                </InboxText>
              </Press>
            </View>
            {notice ? (
              <InboxText tone="good" accessibilityLiveRegion="polite">
                {notice}
              </InboxText>
            ) : null}
            {error}
          </View>
        }
        renderItem={({ item, index }) => {
          const date = dayLabel(item.createdAt);
          const first = index === 0 || date !== dayLabel(state.items[index - 1].createdAt);
          return (
            <View>
              {first ? (
                <InboxText
                  bold
                  tone="muted"
                  accessibilityRole="header"
                  style={{ paddingTop: index ? 24 : 8, paddingBottom: 12 }}
                >
                  {date}
                </InboxText>
              ) : null}
              <Press
                scale={1}
                testID={`inbox-item-${item.id}`}
                accessibilityLabel={`${item.readAt ? L.read : L.unread}, ${labels()[item.kind]}, ${item.title}, ${item.body}, ${stamp(item.createdAt)}`}
                accessibilityHint={L.itemHint}
                onPress={() => openInbox(item.id)}
                style={{
                  padding: 16,
                  gap: 8,
                  marginBottom: 8,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: c.line,
                  backgroundColor: item.readAt ? c.surface2 : c.surface,
                }}
              >
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
                >
                  <InboxText tone={item.readAt ? 'muted' : 'accent'} v="sm" bold>
                    {labels()[item.kind]}
                  </InboxText>
                  <InboxText tone={item.readAt ? 'muted' : 'accent'} v="sm" bold={!item.readAt}>
                    {`· ${item.readAt ? L.read : L.unread}`}
                  </InboxText>
                  <InboxText tone="muted" v="sm" style={{ marginLeft: 'auto' }}>
                    {new Date(item.createdAt).toLocaleTimeString(intlLocale(), {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </InboxText>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <InboxText bold={!item.readAt} style={{ fontSize: 16, lineHeight: 24 }}>
                      {item.title}
                    </InboxText>
                    <InboxText tone="muted" numberOfLines={fontScale > 1.3 ? undefined : 2}>
                      {item.body}
                    </InboxText>
                  </View>
                  <Icon name="next" />
                </View>
              </Press>
            </View>
          );
        }}
        ListEmptyComponent={
          !state.busy && !state.error && state.loaded ? (
            <View
              style={{ alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 48 }}
            >
              <View style={{ padding: 20, borderRadius: 24, backgroundColor: c.surface }}>
                <Icon name={state.onlyUnread ? 'check' : 'bell'} size={32} />
              </View>
              <InboxText v="h2" center>
                {state.onlyUnread ? L.emptyUnread : L.empty}
              </InboxText>
              <InboxText tone="muted" center>
                {state.onlyUnread ? L.emptyUnreadBody : L.emptyBody}
              </InboxText>
              {state.onlyUnread ? (
                <Btn onPress={() => void loadInbox({ unread: false })}>{L.seeAll}</Btn>
              ) : null}
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={{ gap: 12, paddingTop: 12 }}>
            {loading}
            {state.nextCursor ? (
              <Btn block disabled={state.busy} onPress={() => void loadInbox({ more: true })}>
                {L.more}
              </Btn>
            ) : null}
          </View>
        }
      />
    </Screen>
  );
}
