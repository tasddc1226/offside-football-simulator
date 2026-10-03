// T-11-015 라운지 채팅(웹 Chat.svelte) — 모두가 보는 실시간 공개 채팅. 누구나 읽고, 로그인하고 닉네임을 정하면 쓴다.
// 남의 메시지는 신고하고 작성자를 차단한다(앱스토어 UGC 정책) — 여럿이 신고하면 모두의 화면에서 가려진다.
// 운영자는 메시지를 가리고 작성자를 정지한다.
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
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
import { goBack, goHome } from '../../game/nav';
import { startAppleLogin, startGoogleLogin } from '../../platform/auth';
import { openWeb } from '../../platform/openWeb';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { AppleLoginButton, useAppleLogin } from '../../ui/AppleLoginButton';
import { Btn } from '../../ui/Btn';
import { Pill } from '../../ui/bits';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { TextBox, confirmAsync } from '../board/parts';

const small = { fontSize: rem(0.75) } as const;

/** 입력칸 — 글자를 칠 때마다 메시지 목록까지 다시 그리지 않도록 입력 상태를 따로 둔다. */
type InputHandle = { restore(body: string): void };
function ChatInput(props: {
  onFocus: () => void;
  onResize: () => void;
  send: (body: string) => boolean;
  ref: Ref<InputHandle>;
}) {
  const c = useColors();
  const [text, setText] = useState('');
  const [height, setHeight] = useState(48);
  useImperativeHandle(props.ref, () => ({ restore: (body) => setText((t) => t || body) }), []);
  const submit = () => {
    const body = text.trim();
    if (body && props.send(body)) {
      setText('');
      setHeight(48);
    }
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
      <TextBox
        testID="chat-input"
        accessibilityLabel="채팅 메시지"
        placeholder="메시지 입력"
        multiline
        scrollEnabled={height >= 112}
        onFocus={props.onFocus}
        onContentSizeChange={(e) => {
          setHeight(Math.min(112, Math.max(48, e.nativeEvent.contentSize.height)));
          props.onResize();
        }}
        maxLength={CHAT_BODY_MAX}
        value={text}
        onChangeText={setText}
        submitBehavior="newline"
        style={{
          flex: 1,
          height: !text ? 48 : Platform.OS === 'ios' ? undefined : height,
          minHeight: 48,
          maxHeight: 112,
          borderRadius: 22,
        }}
      />
      <Press
        testID="chat-send"
        accessibilityLabel="보내기"
        accessibilityState={{ disabled: !text.trim() }}
        disabled={!text.trim()}
        onPress={submit}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: c.pitch,
          opacity: text.trim() ? 1 : 0.45,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
          <Path
            d="M12 19V5m-6 6 6-6 6 6"
            stroke={c.onPitch}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Press>
    </View>
  );
}

export default function Chat() {
  const c = useColors();
  const apple = useAppleLogin();
  const insets = useSafeAreaInsets();
  const [keyboardUp, setKeyboardUp] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardUp(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardUp(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const [view, setView] = useState<ChatView>(EMPTY_CHAT);
  const input = useRef<InputHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const session = useRef<ChatSession | null>(null);
  const list = useRef<ScrollView>(null);
  /** 맨 아래 가까이 보고 있을 때만 새 줄을 따라 내려간다. */
  const atBottom = useRef(true);
  /** 첫 메시지 목록의 실제 높이가 정해진 뒤 입장 위치를 맞춘다. */
  const entering = useRef(true);
  /** 지난번에 그린 메시지 배열 — 줄이 바뀔 때만 따라 내려간다(접속자 수만 바뀌면 그대로). */
  const shown = useRef(EMPTY_CHAT.messages);
  useEffect(() => {
    // 키보드 애니메이션으로 목록 높이가 줄어든 뒤 최신 메시지를 입력칸 바로 위에 둔다.
    const opened = Keyboard.addListener('keyboardDidShow', () => {
      atBottom.current = true;
      list.current?.scrollToEnd({ animated: false });
    });
    return () => opened.remove();
  }, []);

  const connect = () => {
    session.current?.close();
    session.current = api.openChat(
      (v) => {
        const grew = v.messages !== shown.current;
        shown.current = v.messages;
        setView(v);
        const fromMe = v.messages.at(-1)?.author === v.me?.author;
        if (grew && (entering.current || atBottom.current || fromMe))
          requestAnimationFrame(() => list.current?.scrollToEnd({ animated: false }));
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: c.surface }}
    >
      <View
        style={{
          flex: 1,
          minHeight: 0,
          paddingTop: insets.top,
          paddingBottom: keyboardUp ? 0 : insets.bottom,
        }}
      >
        <View
          testID="chat"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: c.line,
          }}
        >
          <Press
            testID="back"
            accessibilityLabel="← 이전으로"
            onPress={() => goBack(goHome)}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
              <Path
                d="m14 5-7 7 7 7"
                stroke={c.ink}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Press>
          <View style={{ flex: 1 }}>
            <Txt bold accessibilityRole="header" style={{ fontSize: rem(1.125) }}>
              라운지 채팅
            </Txt>
            <Txt tone="muted" style={small} testID="chat-status">
              {view.status === 'open'
                ? `● ${view.online}명 접속`
                : view.status === 'retrying'
                  ? '다시 연결하는 중…'
                  : '연결하는 중…'}
            </Txt>
          </View>
          <Press
            accessibilityLabel="채팅 이용 안내"
            onPress={() =>
              Alert.alert(
                '채팅 이용 안내',
                '모두가 보는 공개 채팅이에요. 링크는 보낼 수 없고, 욕설·비방·광고·개인정보는 가리고 이용을 제한해요.',
                [{ text: '이용약관', onPress: () => openWeb('/legal/terms/') }, { text: '확인' }],
              )
            }
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
              <Circle cx={12} cy={12} r={9} stroke={c.ink} strokeWidth={1.8} fill="none" />
              <Path d="M12 11v6M12 7v1" stroke={c.ink} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Press>
        </View>
        <ScrollView
          ref={list}
          testID="chat-list"
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, minHeight: 0 }}
          keyboardDismissMode="interactive"
          onContentSizeChange={() => {
            if (view.status !== 'open') return;
            if (entering.current || atBottom.current)
              list.current?.scrollToEnd({ animated: false });
            entering.current = false;
          }}
          onLayout={() => {
            if (atBottom.current)
              requestAnimationFrame(() => list.current?.scrollToEnd({ animated: false }));
          }}
          contentContainerStyle={{
            gap: 12,
            flexGrow: 1,
            paddingVertical: 14,
            paddingHorizontal: 12,
          }}
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
                style={{
                  alignSelf: mine(m) ? 'flex-end' : 'flex-start',
                  alignItems: mine(m) ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {m.admin ? (
                    <Pill tone="good">{ADMIN_NICKNAME}</Pill>
                  ) : (
                    <Txt bold tone={mine(m) ? 'accent' : 'ink'}>
                      {m.nickname}
                    </Txt>
                  )}
                  {!mine(m) && (!m.admin || me?.admin) ? (
                    <Press
                      testID="chat-more"
                      accessibilityLabel={`${m.nickname}님 메시지 신고·차단`}
                      onPress={() => setSelected(selected === m.id ? null : m.id)}
                      style={{
                        width: 48,
                        minHeight: 48,
                        alignItems: 'center',
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
                <View
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 13,
                    borderWidth: 1,
                    borderColor: mine(m) ? c.pitch : c.line,
                    backgroundColor: mine(m) ? c.pitch : c.surface2,
                    borderRadius: 16,
                    borderTopLeftRadius: mine(m) ? 16 : 4,
                    borderTopRightRadius: mine(m) ? 4 : 16,
                  }}
                >
                  <Txt style={{ color: mine(m) ? c.onPitch : c.ink, fontSize: rem(0.9375) }}>
                    {m.body}
                  </Txt>
                </View>
                <Txt tone="muted" style={[small, { marginTop: 3 }]}>
                  {chatTime(m.at)}
                </Txt>
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
              {view.status === 'open' ? '아직 조용해요.' : '불러오는 중…'}
            </Txt>
          )}
        </ScrollView>

        <View
          testID="chat-composer"
          style={{
            flexShrink: 0,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: c.line,
          }}
        >
          {view.write ? (
            <ChatInput
              ref={input}
              onFocus={() => {
                atBottom.current = true;
                requestAnimationFrame(() => list.current?.scrollToEnd({ animated: false }));
              }}
              onResize={() => {
                if (atBottom.current)
                  requestAnimationFrame(() => list.current?.scrollToEnd({ animated: false }));
              }}
              send={send}
            />
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
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
