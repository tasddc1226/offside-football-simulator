// T-11-015 라운지 채팅(웹 Chat.svelte) — 모두가 보는 실시간 공개 채팅. 누구나 읽고, 로그인하고 닉네임을 정하면 쓴다.
// 남의 메시지는 신고하고 작성자를 차단한다(앱스토어 UGC 정책) — 여럿이 신고하면 모두의 화면에서 가려진다.
// 운영자는 메시지를 가리고 작성자를 정지한다.
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ADMIN_NICKNAME,
  COMMENT_REPORT_REASONS,
  type CommentReportReason,
} from '@offside/contracts/board-limits';
import { CHAT_BODY_MAX, CHAT_MUTE_DAYS } from '@offside/contracts/chat';
import * as api from '@offside/app-core/api/chat';
import {
  CHAT_REJECT_TEXT,
  EMPTY_CHAT,
  chatMutedText,
  chatTime,
  type ChatMessage,
  type ChatSession,
  type ChatView,
} from '@offside/app-core/api/chat';
import type { ApiResult } from '@offside/app-core/api/client';
import { REPORT_REASON_LABEL } from '@offside/app-core/boardText';
import { NicknameForm } from '../../components/NicknameForm';
import { toast } from '../../game/host';
import { goHome } from '../../game/nav';
import { startAppleLogin, startGoogleLogin } from '../../platform/auth';
import { openWeb } from '../../platform/openWeb';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { BackBar } from '../../ui/ActionBar';
import { AppleLoginButton, useAppleLogin } from '../../ui/AppleLoginButton';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/bits';
import { Press } from '../../ui/Press';
import { Screen } from '../../ui/Screen';
import { Topbar } from '../../ui/Topbar';
import { Txt } from '../../ui/Txt';
import { TextBox, confirmAsync } from '../board/parts';

const small = { fontSize: rem(0.75) } as const;

/** 입력칸 — 글자를 칠 때마다 메시지 목록까지 다시 그리지 않도록 입력 상태를 따로 둔다. */
type InputHandle = { restore(body: string): void };
function ChatInput(props: {
  nickname: string;
  send: (body: string) => boolean;
  ref: Ref<InputHandle>;
}) {
  const [text, setText] = useState('');
  useImperativeHandle(props.ref, () => ({ restore: (body) => setText((t) => t || body) }), []);
  const submit = () => {
    const body = text.trim();
    if (body && props.send(body)) setText('');
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <TextBox
        testID="chat-input"
        accessibilityLabel="채팅 메시지"
        placeholder={`${props.nickname} 이름으로 보내요`}
        maxLength={CHAT_BODY_MAX}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        submitBehavior="submit"
        returnKeyType="send"
        style={{ flex: 1 }}
      />
      <Btn kind="primary" testID="chat-send" disabled={!text.trim()} onPress={submit}>
        보내기
      </Btn>
    </View>
  );
}

export default function Chat() {
  const c = useColors();
  const apple = useAppleLogin();
  const [view, setView] = useState<ChatView>(EMPTY_CHAT);
  const input = useRef<InputHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const session = useRef<ChatSession | null>(null);
  const list = useRef<ScrollView>(null);
  /** 맨 아래 가까이 보고 있을 때만 새 줄을 따라 내려간다. */
  const atBottom = useRef(true);
  /** 지난번에 그린 메시지 배열 — 줄이 바뀔 때만 따라 내려간다(접속자 수만 바뀌면 그대로). */
  const shown = useRef(EMPTY_CHAT.messages);

  const connect = () => {
    session.current?.close();
    session.current = api.openChat(
      (v) => {
        const grew = v.messages !== shown.current;
        shown.current = v.messages;
        setView(v);
        const fromMe = v.messages.at(-1)?.author === v.me?.author;
        if (grew && (atBottom.current || fromMe))
          requestAnimationFrame(() => list.current?.scrollToEnd());
      },
      (code, restore) => {
        toast(CHAT_REJECT_TEXT[code]);
        if (restore) input.current?.restore(restore);
      },
    );
  };
  useEffect(() => {
    connect();
    return () => session.current?.close();
  }, []);

  const mine = (m: ChatMessage) => !!view.me && m.author === view.me.author;
  function send(body: string) {
    if (session.current?.send(body)) return true;
    toast('연결 중이에요. 잠시 뒤 다시 보내 주세요.');
    return false;
  }
  /** 요청 하나를 보내고 성공하면 패널을 닫고 알린다. */
  async function run<T>(p: Promise<ApiResult<T>>, done: string) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) return (toast(r.error.message), null);
    setSelected(null);
    toast(done);
    return r;
  }
  async function report(m: ChatMessage, reason: CommentReportReason) {
    if (await run(api.reportChat(m.id, { reason }), '신고했어요. 운영자가 확인할게요.'))
      session.current?.drop(m.id);
  }
  async function block(m: ChatMessage) {
    const ok = await confirmAsync(
      `${m.nickname}님을 차단할까요?`,
      '이 사람의 메시지와 댓글이 더는 보이지 않아요.',
      '차단',
    );
    if (!ok) return;
    const r = await run(api.blockChatAuthor(m.id), `${m.nickname}님을 차단했어요`);
    if (r) session.current?.block(r.data.author);
  }
  async function mute(m: ChatMessage, days: (typeof CHAT_MUTE_DAYS)[number]) {
    const ok = await confirmAsync(
      `${m.nickname}님의 채팅을 ${days}일 정지할까요?`,
      '이 메시지도 가려져요.',
      '정지',
    );
    if (ok) await run(api.adminMuteChat(m.id, { days }), `${m.nickname}님을 ${days}일 정지했어요`);
  }

  const panel = {
    marginTop: 8,
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: c.surface2,
  } as const;
  const gate = {
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.line,
  } as const;
  const me = view.me;
  return (
    <Screen fixed footer={<BackBar fallback={goHome} testID="back" />}>
      <Topbar />
      <Card gap={10} style={{ flex: 1, minHeight: 0 }}>
        <View testID="chat" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Txt v="eyebrow">Lounge</Txt>
            <Txt v="h1" accessibilityRole="header">
              라운지 채팅
            </Txt>
          </View>
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }} testID="chat-status">
            {view.status === 'open'
              ? `● ${view.online}명 접속`
              : view.status === 'retrying'
                ? '다시 연결하는 중…'
                : '연결하는 중…'}
          </Txt>
        </View>
        <Txt tone="muted" style={small}>
          {
            '모두가 보는 공개 채팅이에요. 링크는 보낼 수 없고, 욕설·비방·광고·개인정보는 가리고 이용을 제한해요('
          }
          <Txt
            tone="muted"
            style={[small, { textDecorationLine: 'underline' }]}
            accessibilityRole="link"
            onPress={() => openWeb('/legal/terms/')}
          >
            이용약관
          </Txt>
          {').'}
        </Txt>
        <ScrollView
          ref={list}
          testID="chat-list"
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, minHeight: 120 }}
          contentContainerStyle={{ gap: 8, flexGrow: 1 }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
          }}
          scrollEventThrottle={64}
        >
          {view.messages.length ? (
            view.messages.map((m) => (
              <View
                key={m.id}
                testID={`chat-msg-${m.id}`}
                style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 6 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {m.admin ? (
                    <Pill tone="good">{ADMIN_NICKNAME}</Pill>
                  ) : (
                    <Txt bold tone={mine(m) ? 'accent' : 'ink'}>
                      {m.nickname}
                    </Txt>
                  )}
                  <Txt tone="muted" style={small}>
                    {chatTime(m.at)}
                  </Txt>
                  {!mine(m) && (!m.admin || me?.admin) ? (
                    <Press
                      testID="chat-more"
                      accessibilityLabel={`${m.nickname}님 메시지 신고·차단`}
                      onPress={() => setSelected(selected === m.id ? null : m.id)}
                      style={{
                        marginLeft: 'auto',
                        minHeight: 28,
                        justifyContent: 'center',
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: c.line,
                        backgroundColor: c.surface,
                      }}
                    >
                      <Txt style={{ fontSize: rem(0.875), fontWeight: '700' }}>⋯</Txt>
                    </Press>
                  ) : null}
                </View>
                <Txt style={{ marginTop: 2 }}>{m.body}</Txt>
                {selected === m.id ? (
                  <View testID="report-panel" style={panel}>
                    {me?.admin ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 6,
                          alignItems: 'center',
                        }}
                      >
                        <Txt style={{ fontSize: rem(0.8125) }}>운영</Txt>
                        <Btn
                          sm
                          testID="chat-hide"
                          disabled={busy}
                          onPress={() => void run(api.adminHideChat(m.id), '메시지를 가렸어요')}
                        >
                          가리기
                        </Btn>
                        {!m.admin
                          ? CHAT_MUTE_DAYS.map((d) => (
                              <Btn
                                key={d}
                                sm
                                testID={`chat-mute-${d}`}
                                disabled={busy}
                                onPress={() => void mute(m, d)}
                              >
                                {`${d}일 정지`}
                              </Btn>
                            ))
                          : null}
                      </View>
                    ) : null}
                    {!m.admin ? (
                      <>
                        <Txt style={{ fontSize: rem(0.8125) }}>
                          신고하는 이유를 골라 주세요. 신고한 메시지는 내 화면에서 숨겨요.
                        </Txt>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {COMMENT_REPORT_REASONS.map((reason) => (
                            <Btn
                              key={reason}
                              sm
                              testID={`report-${reason}`}
                              disabled={busy}
                              onPress={() => void report(m, reason)}
                            >
                              {REPORT_REASON_LABEL[reason]}
                            </Btn>
                          ))}
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <Txt tone="muted" style={[small, { flex: 1 }]}>
                            {`${m.nickname}님의 메시지를 모두 숨기려면`}
                          </Txt>
                          <Btn sm testID="chat-block" disabled={busy} onPress={() => void block(m)}>
                            작성자 차단
                          </Btn>
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Txt tone="muted" style={{ margin: 'auto', fontSize: rem(0.8125) }}>
              {view.status === 'open' ? '아직 조용해요. 첫 인사를 건네 보세요!' : '불러오는 중…'}
            </Txt>
          )}
        </ScrollView>

        {view.write ? (
          <ChatInput ref={input} nickname={me?.nickname ?? ''} send={send} />
        ) : view.status !== 'open' ? null : !me || me.reason === 'login' ? (
          <View testID="chat-gate-login" style={gate}>
            <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
              {apple
                ? '구글이나 Apple로 로그인하면 채팅에 참여할 수 있어요.'
                : '구글로 로그인하면 채팅에 참여할 수 있어요.'}
            </Txt>
            <Btn
              kind="primary"
              testID="chat-login"
              onPress={() => void startGoogleLogin({ chat: true })}
            >
              구글로 로그인
            </Btn>
            {apple ? (
              <AppleLoginButton
                testID="chat-login-apple"
                onPress={() => void startAppleLogin({ chat: true })}
              />
            ) : null}
          </View>
        ) : me.reason === 'nickname' ? (
          <View testID="chat-gate-nickname" style={gate}>
            <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
              채팅에 쓸 닉네임을 먼저 정해 주세요. 댓글 닉네임과 같아요.
            </Txt>
            <NicknameForm onsaved={connect} />
          </View>
        ) : (
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }} testID="chat-gate-muted">
            {chatMutedText(me.mutedUntil)}
          </Txt>
        )}
      </Card>
    </Screen>
  );
}
