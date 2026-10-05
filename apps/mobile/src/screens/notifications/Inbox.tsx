import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSnapshot } from 'valtio';
import { NotificationIdSchema, type AppNotification } from '@offside/contracts';
import { inboxState, inbox, loadInbox, openInbox, openInboxTarget } from '../../platform/inbox';
import { Btn, Card, Press, Screen, Txt } from '../../ui';
import { useColors } from '../../theme/useColors';
import { inboxText as L } from '@offside/app-core/i18n/ko/inbox';

const labels = (): Record<AppNotification['kind'], string> => ({
  news: L.kindNews,
  test: L.kindTest,
  return: L.kindReturn,
  team: L.kindTeam,
  market: L.kindMarket,
  social: L.kindSocial,
});
function stamp(at: string) {
  return new Date(at).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
export default function Inbox() {
  const state = useSnapshot(inboxState);
  const params = useLocalSearchParams<{ id?: string }>();
  const id =
    typeof params.id === 'string' && NotificationIdSchema.safeParse(params.id).success
      ? params.id
      : null;
  const c = useColors();
  useEffect(() => {
    void loadInbox().then(() => {
      if (id) void inbox.open(id);
    });
  }, [id, state.revision]);
  const detail = id && state.detail?.id === id ? state.detail : null;
  return (
    <Screen>
      <Btn
        kind="ghost"
        onPress={() =>
          id
            ? router.replace('/notifications')
            : router.canGoBack()
              ? router.back()
              : router.replace('/')
        }
        style={{ alignSelf: 'flex-start' }}
      >
        {`← ${id ? L.title : L.back}`}
      </Btn>
      <View style={{ gap: 6, paddingVertical: 8 }}>
        <Txt v="h1" accessibilityRole="header">
          {L.title}
        </Txt>
        <Txt tone="muted">{L.keepNote}</Txt>
      </View>
      {id ? (
        <>
          {detail ? (
            <Card gap={14} testID="inbox-detail">
              <Txt tone="accent" v="sm">
                {labels()[detail.kind]}
              </Txt>
              <Txt v="h2" accessibilityRole="header">
                {detail.title}
              </Txt>
              <Txt>{detail.body}</Txt>
              <Txt tone="muted" v="sm">
                {stamp(detail.createdAt)}
              </Txt>
              <Btn block kind="primary" onPress={() => openInboxTarget(detail.target)}>
                {L.viewRelated}
              </Btn>
              {!detail.readAt ? (
                <Btn block disabled={state.busy} onPress={() => void inbox.read(detail.id)}>
                  {L.markRead}
                </Btn>
              ) : null}
            </Card>
          ) : !state.busy && !state.error ? (
            <Txt tone="muted">{L.notFound}</Txt>
          ) : null}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn
              kind={!state.onlyUnread ? 'primary' : 'ghost'}
              disabled={state.busy}
              onPress={() => void loadInbox({ unread: false })}
            >
              {L.all}
            </Btn>
            <Btn
              kind={state.onlyUnread ? 'primary' : 'ghost'}
              disabled={state.busy}
              onPress={() => void loadInbox({ unread: true })}
            >
              {L.unreadN({ n: state.unreadCount })}
            </Btn>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn disabled={state.busy} onPress={() => void loadInbox({ refresh: true })}>
              {L.refresh}
            </Btn>
            <Btn
              disabled={state.busy || !state.items.length || !state.unreadCount}
              onPress={() => void inbox.readAll()}
            >
              {L.readAll}
            </Btn>
          </View>
          {state.items.map((item) => (
            <Press
              key={item.id}
              testID={`inbox-item-${item.id}`}
              disabled={state.busy}
              accessibilityLabel={`${item.readAt ? '' : L.unreadAria}${item.title}, ${item.body}`}
              onPress={() => openInbox(item.id)}
              style={{
                padding: 16,
                gap: 8,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: item.readAt ? c.line : c.accentText,
                backgroundColor: c.surface,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt tone="accent" v="sm" style={{ flex: 1 }}>
                  {labels()[item.kind]}
                </Txt>
                {!item.readAt ? (
                  <Txt tone="accent" v="sm">
                    {L.unread}
                  </Txt>
                ) : null}
              </View>
              <Txt bold>{item.title}</Txt>
              <Txt tone="muted">{item.body}</Txt>
              <Txt tone="muted" v="sm">
                {stamp(item.createdAt)}
              </Txt>
            </Press>
          ))}
          {state.loaded && !state.items.length && !state.busy ? (
            <Card>
              <Txt tone="muted">{state.onlyUnread ? L.emptyUnread : L.empty}</Txt>
            </Card>
          ) : null}
          {state.nextCursor ? (
            <Btn block disabled={state.busy} onPress={() => void loadInbox({ more: true })}>
              {L.more}
            </Btn>
          ) : null}
        </>
      )}
      {state.busy ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ gap: 8, alignItems: 'center', padding: 12 }}
        >
          <ActivityIndicator color={c.accentText} />
          <Txt tone="muted">{L.checking}</Txt>
        </View>
      ) : null}
      {state.error ? (
        <Card gap={8}>
          <Txt tone="bad" accessibilityLiveRegion="polite">
            {state.error}
          </Txt>
          <Btn
            block
            disabled={state.busy}
            onPress={() => (id ? void inbox.open(id) : void loadInbox({ refresh: true }))}
          >
            {L.retry}
          </Btn>
        </Card>
      ) : null}
    </Screen>
  );
}
