import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { GoogleLoginButton } from '../../ui/GoogleLoginButton';
// T-11-015 라운지 채팅(웹 Chat.svelte) — 모두가 보는 실시간 공개 채팅. 누구나 읽고, 로그인하고 닉네임을 정하면 쓴다.
// 남의 메시지는 신고하고 작성자를 차단한다(앱스토어 UGC 정책) — 여럿이 신고하면 모두의 화면에서 가려진다.
// 운영자는 메시지를 가리고 작성자를 정지한다.
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import {
  ADMIN_NICKNAME,
  COMMENT_REPORT_REASONS,
  type CommentReportReason,
} from '@offside/contracts/board-limits';
import {
  CHAT_BODY_MAX,
  CHAT_MUTE_DAYS,
  CHAT_ROOMS,
  type ChatRoomKey,
} from '@offside/contracts/chat';
import { LOCALE_NAMES } from '@offside/contracts/i18n';
import { lastClosedSeason } from '@offside/contracts/service-seasons';
import * as api from '@offside/app-core/api/chat';
import { unblock as unblockApi } from '@offside/app-core/api/boards';
import type { ChatBlockResponse } from '@offside/contracts';
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
import { OwnerAvatar } from '../../components/OwnerAvatar';
import { TierBadge } from '../../components/TierBadge';
import { TitleBadge } from '../../components/TitleBadge';
import { toast } from '../../game/host';
import { go, goBack, goHome } from '../../game/nav';
import { hofStart } from '@offside/app-core/state';
import { appState } from '../../store';
import { startAppleLogin, startGoogleLogin } from '../../platform/auth';
import { openWeb } from '../../platform/openWeb';
import { markChatRead } from '../../platform/chatUnread';
import { chatText as L } from '@offside/app-core/i18n/ko/chat';
import { rem } from '../../theme/type';
import { alpha, mix } from '../../theme/colors';
import { useColors, useIsDark } from '../../theme/useColors';
import { AppleLoginButton, useAppleLogin } from '../../ui/AppleLoginButton';
import { Btn } from '../../ui/Btn';
import { Pill } from '../../ui/bits';
import { PopSheet } from '../../ui/PopSheet';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { useTranslations } from '../../ui/Translate';
import { TextBox, confirmAsync } from '../board/parts';
import { Skeleton } from '../../ui/Skeleton';
import type { FieldServerEvent } from '@offside/contracts/lounge-field';
import { LoungeField } from './lounge';

/** T-11-600 라운지 필드. Skia가 없는 옛 스토어 빌드(1.1.5 · 1.1.4 OTA)에서는 채팅만 보인다. */
const FIELD = LoungeField !== null;

const small = { fontSize: rem(FONT.caption) } as const;
/** T-11-573 말풍선 위 인용 한 줄 · 입력칸 위 답장 중 표시(색은 화면에서 넣는다). */
const quote = {
  flexDirection: 'row',
  gap: 6,
  maxWidth: '100%',
  marginBottom: 4,
  paddingVertical: 4,
  paddingHorizontal: 10,
  borderLeftWidth: 3,
  borderRadius: RADIUS.sm,
} as const;
/** 채팅 티어는 보낸 때의 지난 시즌 티어 — 시즌 이름(접근성 글자)은 지금 기준 지난 시즌으로 읽힌다. */
const tierSeason = lastClosedSeason(new Date().toISOString()) ?? 0;

/** 입력칸 — 글자를 칠 때마다 메시지 목록까지 다시 그리지 않도록 입력 상태를 따로 둔다. */
type InputHandle = { restore(body: string): void; focus(): void };
function ChatInput(props: {
  onFocus: () => void;
  onResize: () => void;
  send: (body: string) => boolean;
  ref: Ref<InputHandle>;
}) {
  const c = useColors();
  const [text, setText] = useState('');
  const [height, setHeight] = useState(48);
  const box = useRef<TextInput>(null);
  useImperativeHandle(
    props.ref,
    () => ({ restore: (body) => setText((t) => t || body), focus: () => box.current?.focus() }),
    [],
  );
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
        ref={box}
        testID="chat-input"
        accessibilityLabel={L.messageLabel}
        placeholder={L.placeholder}
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
          borderRadius: RADIUS.lg,
        }}
      />
      <Press
        testID="chat-send"
        accessibilityLabel={L.send}
        accessibilityState={{ disabled: !text.trim() }}
        disabled={!text.trim()}
        onPress={submit}
        style={{
          width: 48,
          height: 48,
          borderRadius: RADIUS.lg,
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
  /** T-11-583 들어간 언어 방. */
  const [room, setRoom] = useState<ChatRoomKey>(api.currentChatRoom);
  const input = useRef<InputHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** T-11-573 답장할 원문. 원문이 화면에서 빠지면(가림·차단) 답장도 접는다. */
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  /** 거절된 줄을 되돌릴 때 답장도 되돌린다. */
  const sentReply = useRef<ChatMessage | null>(null);
  /** 인용을 누르면 원문으로 올라가려고 줄마다 목록 안 위치를 적어 둔다. */
  const rowY = useRef(new Map<string, number>());
  const [flash, setFlash] = useState<string | null>(null);
  const session = useRef<ChatSession | null>(null);
  const list = useRef<ScrollView>(null);
  /** T-11-600 필드 보기 · 폰 입력창 접기. */
  const [mode, setModeState] = useState<api.LoungeView>(() =>
    FIELD ? api.currentLoungeView() : 'chat',
  );
  const setMode = (v: api.LoungeView) => {
    setModeState(v);
    api.setLoungeView(v);
  };
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [composerOpen, setComposerOpen] = useState(true);
  /** T-11-600 머리줄 언어 방 메뉴. */
  const [langOpen, setLangOpen] = useState(false);
  const dark = useIsDark();
  const fieldListeners = useRef(new Set<(e: FieldServerEvent) => void>()).current;
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

  const connect = (to: ChatRoomKey = room) => {
    session.current?.close();
    session.current = api.openChat(
      (v) => {
        const grew = v.messages !== shown.current;
        shown.current = v.messages;
        setView(v);
        // T-11-440 이 화면에서 받은 줄은 읽은 것으로 남겨 홈 채팅 버튼의 안 읽음 수를 비운다.
        if (v.status === 'open') markChatRead(v.messages);
        const fromMe = v.messages.at(-1)?.author === v.me?.author;
        if (grew && (entering.current || atBottom.current || fromMe))
          requestAnimationFrame(() => list.current?.scrollToEnd({ animated: false }));
      },
      (code, restore) => {
        toast(CHAT_REJECT_TEXT[code]);
        if (restore) {
          input.current?.restore(restore);
          setReplyTo((r) => r ?? sentReply.current);
        }
      },
      to,
      (e) => {
        for (const h of fieldListeners) h(e);
      },
    );
    // 방을 옮겨 새 소켓이 생겨도 필드 보기를 이어 간다.
    if (modeRef.current === 'field') session.current.field({ t: 'field', on: true });
  };
  /** T-11-583 다른 언어 방으로 옮긴다 — 지금 소켓을 닫고 그 방에 새로 붙는다. */
  const pickRoom = (to: ChatRoomKey) => {
    if (to === room) return;
    api.setChatRoom(to);
    setRoom(to);
    setSelected(null);
    setReplyTo(null);
    entering.current = true;
    shown.current = EMPTY_CHAT.messages;
    setView(EMPTY_CHAT);
    connect(to);
  };
  useEffect(() => {
    connect();
    return () => session.current?.close();
  }, []);

  const mine = (m: ChatMessage) => !!view.me && m.author === view.me.author;
  /** T-11-344 남의 줄이면 프로필 사진·이름·⋯을 눌러 그 사람 창(신고·차단, 운영자는 가리기·정지)을 연다. */
  const canAct = (m: ChatMessage) => !mine(m) && (!m.admin || !!view.me?.admin);
  const picked = selected ? view.messages.find((m) => m.id === selected) : undefined;
  const toggle = (m: ChatMessage) => setSelected(selected === m.id ? null : m.id);
  /** T-11-146 번역 보기. */
  const tr = useTranslations();
  const replying = replyTo && view.messages.some((m) => m.id === replyTo.id) ? replyTo : null;
  function send(body: string) {
    if (session.current?.send(body, replying?.id)) {
      sentReply.current = replying;
      setReplyTo(null);
      return true;
    }
    toast(L.sendWait);
    return false;
  }
  function startReply(m: ChatMessage) {
    setReplyTo(m);
    input.current?.focus();
  }
  const quoteName = (r: { admin: boolean; nickname: string }) =>
    r.admin ? ADMIN_NICKNAME : r.nickname;
  /** T-11-573 인용을 누르면 원문으로 올라가 잠깐 표시한다. 불러오지 않은 옛 줄이면 알리기만 한다. */
  function jump(id: string) {
    const y = rowY.current.get(id);
    if (y === undefined || !view.messages.some((m) => m.id === id)) return toast(L.replyNotLoaded);
    atBottom.current = false;
    list.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
    setFlash(id);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 1200);
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
    if (await run(api.reportChat(m.id, { reason }), L.reportedToast)) session.current?.drop(m.id);
  }
  async function block(m: ChatMessage) {
    const ok = await confirmAsync(L.blockTitle({ nick: m.nickname }), L.blockBody, L.blockOk);
    if (!ok) return;
    const r = await run(api.blockChatAuthor(m.id), L.blockedToast({ nick: m.nickname }));
    if (r) session.current?.block(r.data.author);
  }
  /** T-11-167 차단한 사용자 — 안내에서 고를 때만 불러온다. undefined면 닫힘, null이면 불러오는 중. */
  const [blocks, setBlocks] = useState<ChatBlockResponse[] | null | 'error' | undefined>();
  async function openBlocks() {
    setBlocks(null);
    const r = await api.fetchChatBlocks();
    setBlocks(r.ok ? r.data.blocks : 'error');
  }
  async function unblock(b: ChatBlockResponse) {
    const r = await unblockApi(b.id);
    if (!r.ok) return toast(r.error.message);
    session.current?.unblock(b.author);
    setBlocks((list) => (Array.isArray(list) ? list.filter((x) => x.id !== b.id) : list));
    toast(L.unblockedToast({ nick: b.nickname }));
  }
  /** T-11-344 작성자의 구단주 프로필(가장 최근 팀)을 기록실에서 연다. 팀이 없으면 알리기만 한다. */
  async function openProfile(m: ChatMessage) {
    setBusy(true);
    const r = await api.fetchChatOwner(m.id);
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    if (!r.data.teamId) return toast(L.noProfile);
    setSelected(null);
    appState.hof = { ...hofStart(), tab: 'teams', team: r.data.teamId, owner: true };
    go('hof');
  }
  async function mute(m: ChatMessage, days: (typeof CHAT_MUTE_DAYS)[number]) {
    const ok = await confirmAsync(L.muteTitle({ nick: m.nickname, days }), L.muteBody, L.muteOk);
    if (ok) await run(api.adminMuteChat(m.id, { days }), L.mutedToast({ nick: m.nickname, days }));
  }

  const gate = {
    gap: 8,
    padding: 12,
    borderRadius: RADIUS.sm,
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
            accessibilityLabel={L.back}
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
            <Txt bold accessibilityRole="header" style={{ fontSize: rem(FONT.title3) }}>
              {L.title}
            </Txt>
            <Txt tone="muted" style={small} testID="chat-status">
              {view.status === 'open'
                ? `● ${L.online({ n: view.online })}`
                : view.status === 'retrying'
                  ? L.reconnecting
                  : L.connecting}
            </Txt>
          </View>
          {/* T-11-600 언어 방은 웹처럼 머리줄의 언어 버튼에서 고른다. */}
          <Press
            testID="chat-lang"
            accessibilityLabel={L.roomsLabel}
            accessibilityState={{ expanded: langOpen }}
            onPress={() => setLangOpen(!langOpen)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              minHeight: 36,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: RADIUS.pill,
              backgroundColor: c.surface2,
            }}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" accessible={false}>
              <Circle cx={12} cy={12} r={9} stroke={c.ink} strokeWidth={1.8} fill="none" />
              <Path
                d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z"
                stroke={c.ink}
                strokeWidth={1.8}
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
            <Txt bold style={{ fontSize: rem(FONT.label) }}>
              {LOCALE_NAMES[room]}
            </Txt>
            <Svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              accessible={false}
              style={{ transform: [{ rotate: langOpen ? '180deg' : '0deg' }] }}
            >
              <Path
                d="m6 9 6 6 6-6"
                stroke={c.muted}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Press>
          <Press
            accessibilityLabel={L.rulesLabel}
            onPress={() =>
              Alert.alert(L.rulesLabel, L.rulesBody, [
                { text: L.terms, onPress: () => openWeb('/legal/terms/') },
                ...(view.me?.author
                  ? [{ text: L.blockedTitle, onPress: () => void openBlocks() }]
                  : []),
                { text: L.ok },
              ])
            }
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
              <Circle cx={12} cy={12} r={9} stroke={c.ink} strokeWidth={1.8} fill="none" />
              <Path d="M12 11v6M12 7v1" stroke={c.ink} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Press>
        </View>
        {FIELD ? (
          // T-11-600 필드 · 채팅 보기 전환 — 웹과 같은 한 줄짜리 막대.
          <View
            accessibilityLabel={L.viewLabel}
            style={{
              flexDirection: 'row',
              gap: 4,
              marginHorizontal: 12,
              marginVertical: 8,
              padding: 3,
              borderRadius: RADIUS.pill,
              backgroundColor: c.surface2,
            }}
          >
            {(['field', 'chat'] as const).map((m) => {
              const on = mode === m;
              const tint = on ? (dark ? c.accent : c.pitch) : c.muted;
              return (
                <Press
                  key={m}
                  testID={`chat-view-${m}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setMode(m)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    minHeight: 34,
                    borderRadius: RADIUS.pill,
                    ...(on
                      ? {
                          backgroundColor: dark ? mix(c.accent, c.surface, 0.16) : c.surface,
                          borderWidth: 1.5,
                          borderColor: tint,
                        }
                      : { borderWidth: 1.5, borderColor: 'transparent' }),
                  }}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" accessible={false}>
                    {m === 'field' ? (
                      <>
                        <Rect
                          x={3}
                          y={5}
                          width={18}
                          height={14}
                          rx={2}
                          stroke={tint}
                          strokeWidth={1.8}
                          fill="none"
                        />
                        <Path d="M12 5v14" stroke={tint} strokeWidth={1.8} />
                        <Circle
                          cx={12}
                          cy={12}
                          r={2.6}
                          stroke={tint}
                          strokeWidth={1.8}
                          fill="none"
                        />
                      </>
                    ) : (
                      <Path
                        d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                        stroke={tint}
                        strokeWidth={1.8}
                        strokeLinejoin="round"
                        fill="none"
                      />
                    )}
                  </Svg>
                  <Txt bold style={{ fontSize: rem(FONT.label), color: tint }}>
                    {m === 'field' ? L.viewField : L.viewChat}
                  </Txt>
                </Press>
              );
            })}
          </View>
        ) : (
          <View style={{ height: 1, backgroundColor: c.line }} />
        )}
        {blocks !== undefined ? (
          <View
            testID="chat-blocks"
            style={{ gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: c.line }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Txt bold style={{ fontSize: rem(FONT.body2) }}>
                {L.blockedTitle}
              </Txt>
              <Btn sm testID="chat-blocks-close" onPress={() => setBlocks(undefined)}>
                {L.ok}
              </Btn>
            </View>
            {blocks === null ? (
              <Skeleton rows={2} />
            ) : blocks === 'error' ? (
              <Txt tone="muted" style={small}>
                {L.blockedLoadFail}
              </Txt>
            ) : blocks.length ? (
              blocks.map((b) => (
                <View
                  key={b.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Txt style={{ fontSize: rem(FONT.body2) }}>{b.nickname}</Txt>
                  <Btn sm testID="chat-unblock" onPress={() => void unblock(b)}>
                    {L.unblock}
                  </Btn>
                </View>
              ))
            ) : (
              <Txt tone="muted" style={small}>
                {L.blockedEmpty}
              </Txt>
            )}
          </View>
        ) : null}
        {mode === 'field' && LoungeField ? (
          <LoungeField
            messages={view.messages}
            me={
              view.write && view.me?.author
                ? { author: view.me.author, nickname: view.me.nickname ?? '' }
                : null
            }
            send={(e) => session.current?.field(e) ?? false}
            listen={(h) => {
              fieldListeners.add(h);
              return () => void fieldListeners.delete(h);
            }}
            onPick={(author) => {
              const m = view.messages.findLast((x) => x.author === author);
              if (m && canAct(m)) setSelected(m.id);
            }}
            chatOpen={composerOpen}
            onChat={() => {
              if (composerOpen) Keyboard.dismiss();
              setComposerOpen(!composerOpen);
            }}
          />
        ) : (
          <ScrollView
            ref={list}
            testID="chat-list"
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1, minHeight: 0 }}
            keyboardDismissMode="interactive"
            // T-11-180 이전 줄이 위에 붙어도 보던 줄이 그 자리에 머문다.
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
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
              atBottom.current =
                contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
              // T-11-180 맨 위 가까이 올리면 이전 줄을 부른다.
              if (contentOffset.y < 120) session.current?.older();
            }}
            scrollEventThrottle={64}
          >
            {view.loadingOlder ? (
              <Txt tone="muted" style={{ textAlign: 'center', fontSize: rem(FONT.label) }}>
                {L.loadingOlder}
              </Txt>
            ) : null}
            {view.messages.length ? (
              view.messages.map((m) => (
                <View
                  key={m.id}
                  testID={`chat-msg-${m.id}`}
                  onLayout={(e) => rowY.current.set(m.id, e.nativeEvent.layout.y)}
                  style={{
                    alignSelf: mine(m) ? 'flex-end' : 'flex-start',
                    alignItems: mine(m) ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    borderRadius: RADIUS.lg,
                    backgroundColor: flash === m.id ? alpha(c.pitch, 0.18) : undefined,
                  }}
                >
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}
                  >
                    <Press
                      testID="chat-who"
                      disabled={!canAct(m)}
                      accessibilityRole={canAct(m) ? 'button' : undefined}
                      accessibilityLabel={canAct(m) ? L.moreLabel({ nick: m.nickname }) : undefined}
                      onPress={() => toggle(m)}
                      hitSlop={6}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}
                    >
                      <OwnerAvatar avatarId={m.avatarId} name={m.nickname} />
                      {m.admin ? (
                        <Pill tone="good">{ADMIN_NICKNAME}</Pill>
                      ) : (
                        <Txt bold tone={mine(m) ? 'accent' : 'ink'}>
                          {m.nickname}
                        </Txt>
                      )}
                    </Press>
                    {m.admin ? null : (
                      <>
                        {m.tier ? <TierBadge tag={{ tier: m.tier, season: tierSeason }} /> : null}
                        {m.title ? <TitleBadge title={m.title} size="sm" /> : null}
                      </>
                    )}
                    {canAct(m) ? (
                      <Press
                        testID="chat-more"
                        accessibilityLabel={L.moreLabel({ nick: m.nickname })}
                        onPress={() => toggle(m)}
                        hitSlop={12}
                        style={{
                          width: 24,
                          height: 24,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Txt
                          tone={selected === m.id ? 'ink' : 'muted'}
                          style={{ fontSize: rem(FONT.body2), fontWeight: '700' }}
                        >
                          ⋯
                        </Txt>
                      </Press>
                    ) : null}
                  </View>
                  {m.replyTo ? (
                    m.reply ? (
                      <Press
                        testID="chat-quote"
                        accessibilityRole="button"
                        accessibilityLabel={L.replyJump({ nick: quoteName(m.reply) })}
                        onPress={() => jump(m.reply!.id)}
                        style={[quote, { borderLeftColor: c.pitch, backgroundColor: c.surface2 }]}
                      >
                        <Txt bold style={small}>
                          {quoteName(m.reply)}
                        </Txt>
                        <Txt tone="muted" numberOfLines={1} style={[small, { flexShrink: 1 }]}>
                          {m.reply.body}
                        </Txt>
                      </Press>
                    ) : (
                      <View
                        testID="chat-quote-gone"
                        style={[quote, { borderLeftColor: c.line, backgroundColor: c.surface2 }]}
                      >
                        <Txt tone="muted" style={small}>
                          {L.replyGone}
                        </Txt>
                      </View>
                    )
                  ) : null}
                  {/* 보낸 시각은 말풍선 옆 아래(남의 말은 오른쪽, 내 말은 왼쪽). */}
                  <View
                    style={{
                      flexDirection: mine(m) ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: 6,
                      maxWidth: '100%',
                    }}
                  >
                    <View
                      style={{
                        flexShrink: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 13,
                        borderWidth: 1,
                        borderColor: mine(m) ? c.pitch : c.line,
                        backgroundColor: mine(m) ? c.pitch : c.surface2,
                        borderRadius: RADIUS.lg,
                        borderTopLeftRadius: mine(m) ? 16 : 4,
                        borderTopRightRadius: mine(m) ? 4 : 16,
                      }}
                    >
                      <Txt
                        style={{ color: mine(m) ? c.onPitch : c.ink, fontSize: rem(FONT.body1) }}
                      >
                        {tr.text(m.id, m.body)}
                      </Txt>
                    </View>
                    <Txt tone="muted" style={small}>
                      {chatTime(m.at)}
                    </Txt>
                    {view.write && !mine(m) ? (
                      // T-11-575 답장은 시각 옆 아이콘.
                      <Press
                        testID="chat-reply"
                        accessibilityRole="button"
                        accessibilityLabel={L.replyTo({ nick: quoteName(m) })}
                        onPress={() => startReply(m)}
                        hitSlop={8}
                        style={{
                          width: 28,
                          height: 28,
                          marginLeft: -4,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Svg width={16} height={16} viewBox="0 0 24 24" accessible={false}>
                          <Path
                            d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
                            stroke={c.muted}
                            strokeWidth={2}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </Press>
                    ) : null}
                  </View>
                  {!mine(m) ? tr.button(m.id, m.body) : null}
                </View>
              ))
            ) : view.status === 'open' ? (
              <Txt tone="muted" style={{ margin: 'auto', fontSize: rem(FONT.label) }}>
                {L.emptyOpen}
              </Txt>
            ) : (
              <Skeleton rows={4} />
            )}
          </ScrollView>
        )}

        {mode === 'field' && !composerOpen ? null : (
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
            {view.write && replying ? (
              <View
                testID="chat-replying"
                style={[
                  quote,
                  {
                    alignItems: 'center',
                    maxWidth: '100%',
                    marginBottom: 8,
                    paddingVertical: 2,
                    paddingRight: 0,
                    borderLeftColor: c.pitch,
                    backgroundColor: c.surface2,
                  },
                ]}
              >
                <Txt numberOfLines={1} style={[small, { flex: 1 }]}>
                  <Txt bold style={small}>
                    {L.replyTo({ nick: quoteName(replying) })}
                  </Txt>{' '}
                  <Txt tone="muted" style={small}>
                    {replying.body}
                  </Txt>
                </Txt>
                <Press
                  testID="chat-reply-cancel"
                  accessibilityLabel={L.replyCancel}
                  onPress={() => setReplyTo(null)}
                  style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" accessible={false}>
                    <Path
                      d="M6 6l12 12M18 6 6 18"
                      stroke={c.ink}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </Svg>
                </Press>
              </View>
            ) : null}
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
                <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                  {apple ? L.gateLoginApple : L.gateLogin}
                </Txt>
                <GoogleLoginButton
                  testID="chat-login"
                  onPress={() => void startGoogleLogin({ chat: true })}
                />
                {apple ? (
                  <AppleLoginButton
                    testID="chat-login-apple"
                    onPress={() => void startAppleLogin({ chat: true })}
                  />
                ) : null}
              </View>
            ) : me.reason === 'nickname' ? (
              <View testID="chat-gate-nickname" style={gate}>
                <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                  {L.gateNicknameApp}
                </Txt>
                <NicknameForm onsaved={() => connect()} />
              </View>
            ) : (
              <Txt tone="muted" style={{ fontSize: rem(FONT.label) }} testID="chat-gate-muted">
                {chatMutedText(me.mutedUntil)}
              </Txt>
            )}
          </View>
        )}
      </View>
      {langOpen ? (
        <>
          <Press
            accessibilityLabel={L.ok}
            onPress={() => setLangOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityLabel={L.roomsLabel}
            style={{
              position: 'absolute',
              top: insets.top + 58,
              right: 60,
              minWidth: 156,
              gap: 2,
              padding: 6,
              borderRadius: RADIUS.md,
              backgroundColor: c.surface2,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
          >
            {CHAT_ROOMS.map((r) => (
              <Press
                key={r}
                testID={`chat-room-${r}`}
                accessibilityState={{ selected: room === r }}
                onPress={() => {
                  setLangOpen(false);
                  pickRoom(r);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  minHeight: 44,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: RADIUS.sm,
                }}
              >
                <Txt bold style={room === r ? { color: c.accent } : undefined}>
                  {LOCALE_NAMES[r]}
                </Txt>
                {room === r ? (
                  <Svg width={16} height={16} viewBox="0 0 24 24" accessible={false}>
                    <Path
                      d="m5 12.5 4.5 4.5L19 7.5"
                      stroke={c.accent}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                ) : null}
              </Press>
            ))}
          </View>
        </>
      ) : null}
      {picked ? (
        <PopSheet
          label={L.userLabel({ nick: picked.nickname })}
          testID="report-panel"
          onClose={() => setSelected(null)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <OwnerAvatar avatarId={picked.avatarId} name={picked.nickname} size={44} />
            <View style={{ flex: 1, gap: 4 }}>
              {picked.admin ? (
                <Pill tone="good">{ADMIN_NICKNAME}</Pill>
              ) : (
                <Txt bold style={{ fontSize: rem(FONT.title3) }}>
                  {picked.nickname}
                </Txt>
              )}
              {!picked.admin && (picked.tier || picked.title) ? (
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}
                >
                  {picked.tier ? (
                    <TierBadge tag={{ tier: picked.tier, season: tierSeason }} />
                  ) : null}
                  {picked.title ? <TitleBadge title={picked.title} size="sm" /> : null}
                </View>
              ) : null}
            </View>
            {!picked.admin ? (
              <Btn
                sm
                testID="chat-profile"
                disabled={busy}
                onPress={() => void openProfile(picked)}
              >
                {L.viewProfile}
              </Btn>
            ) : null}
          </View>
          {me?.admin ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <Txt style={{ fontSize: rem(FONT.label) }}>{L.adminLabel}</Txt>
              <Btn
                sm
                testID="chat-hide"
                disabled={busy}
                onPress={() => void run(api.adminHideChat(picked.id), L.hiddenToast)}
              >
                {L.hide}
              </Btn>
              {!picked.admin
                ? CHAT_MUTE_DAYS.map((d) => (
                    <Btn
                      key={d}
                      sm
                      testID={`chat-mute-${d}`}
                      disabled={busy}
                      onPress={() => void mute(picked, d)}
                    >
                      {L.muteDays({ days: d })}
                    </Btn>
                  ))
                : null}
            </View>
          ) : null}
          {!picked.admin ? (
            <>
              <Txt style={{ fontSize: rem(FONT.label) }}>{L.reportPrompt}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {COMMENT_REPORT_REASONS.map((reason) => (
                  <Btn
                    key={reason}
                    sm
                    testID={`report-${reason}`}
                    disabled={busy}
                    onPress={() => void report(picked, reason)}
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
                  {L.blockHint({ nick: picked.nickname })}
                </Txt>
                <Btn sm testID="chat-block" disabled={busy} onPress={() => void block(picked)}>
                  {L.blockAuthor}
                </Btn>
              </View>
            </>
          ) : null}
          <Btn testID="chat-user-close" onPress={() => setSelected(null)}>
            {L.close}
          </Btn>
        </PopSheet>
      ) : null}
    </KeyboardAvoidingView>
  );
}
