import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSnapshot } from 'valtio';
import { NotificationIdSchema, type AppNotification } from '@offside/contracts';
import { inboxState, inbox, loadInbox, openInbox, openInboxTarget } from '../../platform/inbox';
import { Btn, Card, Press, Screen, Txt } from '../../ui';
import { useColors } from '../../theme/useColors';

const labels: Record<AppNotification['kind'], string> = {
  news: '새 소식',
  test: '알림 테스트',
  return: '다시 킥오프',
  team: '내 팀',
  market: '이적시장',
  social: '친구',
};
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
        ← {id ? '알림함' : '이전으로'}
      </Btn>
      <View style={{ gap: 6, paddingVertical: 8 }}>
        <Txt v="h1" accessibilityRole="header">
          알림함
        </Txt>
        <Txt tone="muted">받은 알림을 90일간 보관해요.</Txt>
      </View>
      {id ? (
        <>
          {detail ? (
            <Card gap={14} testID="inbox-detail">
              <Txt tone="accent" v="sm">
                {labels[detail.kind]}
              </Txt>
              <Txt v="h2" accessibilityRole="header">
                {detail.title}
              </Txt>
              <Txt>{detail.body}</Txt>
              <Txt tone="muted" v="sm">
                {stamp(detail.createdAt)}
              </Txt>
              <Btn block kind="primary" onPress={() => openInboxTarget(detail.target)}>
                관련 내용 보기
              </Btn>
              {!detail.readAt ? (
                <Btn block disabled={state.busy} onPress={() => void inbox.read(detail.id)}>
                  읽음으로 표시
                </Btn>
              ) : null}
            </Card>
          ) : !state.busy && !state.error ? (
            <Txt tone="muted">이 알림을 찾을 수 없어요.</Txt>
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
              전체
            </Btn>
            <Btn
              kind={state.onlyUnread ? 'primary' : 'ghost'}
              disabled={state.busy}
              onPress={() => void loadInbox({ unread: true })}
            >
              읽지 않음 {state.unreadCount}
            </Btn>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn disabled={state.busy} onPress={() => void loadInbox({ refresh: true })}>
              새로고침
            </Btn>
            <Btn
              disabled={state.busy || !state.items.length || !state.unreadCount}
              onPress={() => void inbox.readAll()}
            >
              모두 읽음
            </Btn>
          </View>
          {state.items.map((item) => (
            <Press
              key={item.id}
              testID={`inbox-item-${item.id}`}
              disabled={state.busy}
              accessibilityLabel={`${item.readAt ? '' : '읽지 않음, '}${item.title}, ${item.body}`}
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
                  {labels[item.kind]}
                </Txt>
                {!item.readAt ? (
                  <Txt tone="accent" v="sm">
                    읽지 않음
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
              <Txt tone="muted">
                {state.onlyUnread ? '읽지 않은 알림이 없어요.' : '아직 받은 알림이 없어요.'}
              </Txt>
            </Card>
          ) : null}
          {state.nextCursor ? (
            <Btn block disabled={state.busy} onPress={() => void loadInbox({ more: true })}>
              이전 알림 더 보기
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
          <Txt tone="muted">알림 확인 중…</Txt>
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
            다시 시도
          </Btn>
        </Card>
      ) : null}
    </Screen>
  );
}
