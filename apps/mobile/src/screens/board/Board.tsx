// T-10-011 소식 화면(웹 Board.svelte) — 공지사항·릴리즈 노트 게시판. 읽기는 누구나, 글은 관리자만(수정·삭제 포함),
// 댓글은 로그인하고 닉네임을 정한 사람만(T-10-028). 글 본문은 app-core/boardText의 약속("## 소제목", "- 목록", 줄바꿈)만 읽는다.
// 남의 댓글은 누구나 신고하고 작성자를 차단한다(앱스토어 UGC 정책) — 신고한 댓글·차단한 사람의 댓글은 서버가 빼고 준다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import {
  ADMIN_NICKNAME,
  BOARD_KEYS,
  COMMENT_BODY_MAX,
  COMMENT_REPORT_REASONS,
} from '@offside/contracts/board-limits';
import * as api from '@offside/app-core/api/boards';
import type {
  BoardBlock,
  BoardViewerResponse,
  Comment,
  Post,
  PostSummary,
} from '@offside/app-core/api/boards';
import {
  BOARD_LABEL,
  REPORT_REASON_LABEL,
  dateOf,
  parseBody,
  postMeta,
} from '@offside/app-core/boardText';
import type { CommentReportReason } from '@offside/contracts/board-limits';
import { touchedAt } from '@offside/app-core/news';
import { loadKey, saveKey } from '@offside/game/season';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { NicknameForm } from '../../components/NicknameForm';
import { markNewsSeen, toast } from '../../game/host';
import { openBoard } from '../../game/nav';
import { startAppleLogin, startGoogleLogin } from '../../platform/auth';
import { openWeb } from '../../platform/openWeb';
import { AppleLoginButton, useAppleLogin } from '../../ui/AppleLoginButton';
import { appState } from '../../store';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/bits';
import { Press } from '../../ui/Press';
import { Screen } from '../../ui/Screen';
import { scrollTo } from '../../ui/scroll';
import { Topbar } from '../../ui/Topbar';
import { Txt } from '../../ui/Txt';
import { PostEditor, type Draft } from './PostEditor';
import { Slide } from './Slide';
import { Seg, TabOpt, TextBox, confirmAsync } from './parts';

// T-10-058 조회수는 기기마다 글 하나에 한 번만 센다. 최근 VIEWED_MAX개만 기억한다.
const VIEWED_KEY = 'ft_board_viewed';
const VIEWED_MAX = 300;
function firstView(id: string): boolean {
  const seen = loadKey<string[]>(VIEWED_KEY) ?? [];
  if (seen.includes(id)) return false;
  saveKey(VIEWED_KEY, [...seen, id].slice(-VIEWED_MAX));
  return true;
}

type Detail = { post: Post; comments: Comment[]; liked: boolean; blocks: BoardBlock[] };

/** 댓글 줄 오른쪽 작은 버튼(삭제·신고). */
function CommentAct({
  label,
  testID,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  testID: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const c = useColors();
  return (
    <Press
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        marginLeft: 'auto',
        minHeight: 32,
        justifyContent: 'center',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.surface,
      }}
    >
      <Txt style={{ fontSize: rem(0.75), fontWeight: '600' }}>{label}</Txt>
    </Press>
  );
}

function Tags({ p }: { p: PostSummary }) {
  return (
    <>
      {p.pinned ? <Pill tone="warn">고정</Pill> : null}
      {p.version ? <Pill>{p.version}</Pill> : null}
    </>
  );
}

function Heart({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      accessibilityElementsHidden
      style={filled ? { transform: [{ scale: 1.08 }] } : undefined}
    >
      <Path
        d="M12 20.3s-7.8-4.6-7.8-10.4A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.8 2.5c0 5.8-7.8 10.4-7.8 10.4Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function Board() {
  const c = useColors();
  const { boardOpenId, boardTop } = useSnapshot(appState);
  // 게시판 하나를 보여 준다. 위의 공지사항 · 릴리즈 노트 버튼으로 바꾸면 루트가 이 화면을 새로 그린다.
  const board = appState.board;
  /** 관리자 여부와 댓글 자격(로그인·닉네임). 불러오기 전엔 null(댓글 폼을 그리지 않는다). */
  const [viewer, setViewer] = useState<BoardViewerResponse | null>(null);
  const admin = !!viewer?.admin;
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [liking, setLiking] = useState(false);
  /** 관리자 편집기. id가 없으면 새 글. */
  const [editing, setEditing] = useState<Draft | null>(null);
  /** 홈 등에서 글을 바로 열며 들어온 동안 — 목록을 그리지 않는다(목록이 비쳤다 글로 한 번 더 넘어가지 않게). */
  const [entering, setEntering] = useState(!!appState.boardOpenId);
  const view = editing ? 'edit' : (detail?.post.id ?? (entering ? boardOpenId : null) ?? 'list');
  const [commentText, setCommentText] = useState('');
  const [busy, setBusy] = useState(false);
  /** 신고·차단 패널을 펼친 댓글. */
  const [reporting, setReporting] = useState<string | null>(null);
  const apple = useAppleLogin();

  useEffect(() => {
    void api
      .fetchBoardViewer()
      .then((r) => setViewer(r.ok ? r.data : { admin: false, google: false, nickname: null }));
  }, []);

  const load = useCallback(
    async (more = false) => {
      if (!more) setStatus('loading');
      const last = posts.filter((p) => !p.pinned).at(-1);
      const r = await api.fetchPosts(board, more ? last?.createdAt : undefined);
      if (!r.ok) {
        if (more) toast(r.error.message);
        else setStatus('error');
        return;
      }
      setPosts(more ? [...posts, ...r.data.posts] : r.data.posts);
      setHasMore(r.data.hasMore);
      setStatus('ready');
    },
    [board, posts],
  );
  useEffect(() => void load(), []);

  /** 불러오는 중인 글 — 아래 효과가 같은 글을 두 번 부르지 않게. */
  const loadingId = useRef<string | null>(null);
  async function open(id: string) {
    appState.boardOpenId = loadingId.current = id;
    const r = await api.fetchPost(id);
    if (loadingId.current === id) loadingId.current = null;
    setEntering(false);
    if (appState.boardOpenId !== id) return; // 기다리는 사이 다른 글·목록으로 옮겼다.
    if (!r.ok) {
      appState.boardOpenId = null;
      return toast(r.error.message);
    }
    // 옛 서버 응답엔 liked·blocks가 없다.
    const d: Detail = { ...r.data, liked: !!r.data.liked, blocks: r.data.blocks ?? [] };
    setReporting(null);
    markNewsSeen(touchedAt(r.data.post));
    if (firstView(id)) {
      d.post = { ...d.post, viewCount: d.post.viewCount + 1 };
      void api.addView(id);
    }
    setDetail(d);
    scrollTo(0);
  }

  async function toggleLike() {
    if (!detail || liking) return;
    const { id } = detail.post;
    const prev = { liked: detail.liked, likeCount: detail.post.likeCount };
    // 먼저 화면에 반영하고, 서버 값으로 맞추거나 실패하면 되돌린다.
    const flip = !prev.liked;
    const apply = (liked: boolean, likeCount: number) =>
      setDetail((d) =>
        d && d.post.id === id ? { ...d, liked, post: { ...d.post, likeCount } } : d,
      );
    apply(flip, prev.likeCount + (flip ? 1 : -1));
    setLiking(true);
    const r = await api.setLike(id, flip);
    setLiking(false);
    const next = r.ok ? r.data : prev;
    apply(next.liked, next.likeCount);
    if (!r.ok) toast(r.error.message);
  }

  function backToList() {
    setDetail(null);
    setEditing(null);
    appState.boardOpenId = null;
    void load();
  }
  // T-10-114 펼친 글은 appState.boardOpenId를 따른다 — 홈에서 글을 바로 열 때, 뒤로 가기로 바뀔 때.
  useEffect(() => {
    const want = boardOpenId;
    if (want === (detail?.post.id ?? null) || (want && want === loadingId.current)) return;
    if (want) void open(want);
    else if (detail || editing) backToList();
  }, [boardOpenId]);
  // T-10-113 하단 '소식'을 다시 누르면 목록 맨 위로(쓰던 글이 있으면 먼저 묻는다).
  const seenTop = useRef(appState.boardTop);
  useEffect(() => {
    if (boardTop === seenTop.current) return;
    seenTop.current = boardTop;
    void (async () => {
      if (editing && !(await confirmAsync('작성 중인 글을 두고 목록으로 갈까요?'))) return;
      if (detail || editing) backToList();
      scrollTo(0);
    })();
  }, [boardTop]);

  function startEdit(post?: Post) {
    setEditing(
      post
        ? {
            id: post.id,
            title: post.title,
            body: post.body,
            version: post.version ?? '',
            pinned: post.pinned,
          }
        : { title: '', body: '', version: '', pinned: false },
    );
    scrollTo(0);
  }
  async function savePost() {
    if (!editing || busy) return;
    const e = editing;
    const input = {
      title: e.title,
      body: e.body,
      pinned: e.pinned,
      ...(e.version.trim() ? { version: e.version } : {}),
    };
    setBusy(true);
    const r = e.id ? await api.updatePost(e.id, input) : await api.createPost(board, input);
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    markNewsSeen(touchedAt(r.data)); // 내가 쓰거나 고친 글은 알리지 않는다.
    setEditing(null);
    toast(e.id ? '글을 고쳤어요' : '글을 올렸어요');
    await open(r.data.id);
  }
  async function removePost(post: Post) {
    if (
      !(await confirmAsync(
        `'${post.title}' 글을 지울까요? 댓글도 함께 숨겨집니다.`,
        undefined,
        '삭제',
      ))
    )
      return;
    const r = await api.deletePost(post.id);
    if (!r.ok) return toast(r.error.message);
    toast('글을 지웠어요');
    backToList();
  }

  async function sendComment() {
    if (!detail || busy) return;
    const post = detail.post;
    setBusy(true);
    const r = await api.addComment(post.id, { body: commentText });
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    setCommentText('');
    const added = r.data;
    setDetail((d) => (d && d.post.id === post.id ? { ...d, comments: [...d.comments, added] } : d));
  }
  // 로그인을 마치고 돌아오면 보던 글로 다시 연다.
  const back = () => ({ board, postId: detail?.post.id ?? null });
  const login = () => void startGoogleLogin(back());
  const loginApple = () => void startAppleLogin(back());
  async function removeComment(cm: Comment) {
    if (!(await confirmAsync('이 댓글을 지울까요?', undefined, '삭제'))) return;
    const r = await api.deleteComment(cm.id);
    if (!r.ok) return toast(r.error.message);
    setDetail((d) => (d ? { ...d, comments: d.comments.filter((x) => x.id !== cm.id) } : d));
  }

  /** 차단·차단 해제 뒤 댓글과 차단 목록을 서버 기준으로 다시 받는다. */
  async function reloadComments(postId: string) {
    const r = await api.fetchPost(postId);
    if (!r.ok) return;
    const { comments, blocks = [] } = r.data;
    setDetail((d) => (d && d.post.id === postId ? { ...d, comments, blocks } : d));
  }
  async function report(cm: Comment, reason: CommentReportReason) {
    setBusy(true);
    const r = await api.reportComment(cm.id, { reason });
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    setReporting(null);
    setDetail((d) => (d ? { ...d, comments: d.comments.filter((x) => x.id !== cm.id) } : d));
    toast('신고했어요. 운영자가 확인할게요.');
  }
  async function block(cm: Comment) {
    if (!detail) return;
    const ok = await confirmAsync(
      `${cm.nickname}님을 차단할까요?`,
      '이 사람의 댓글이 더는 보이지 않아요.',
      '차단',
    );
    if (!ok) return;
    const postId = detail.post.id;
    setBusy(true);
    const r = await api.blockAuthor(cm.id);
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    setReporting(null);
    toast(`${r.data.nickname}님을 차단했어요`);
    await reloadComments(postId);
  }
  async function unblock(b: BoardBlock) {
    if (!detail) return;
    const postId = detail.post.id;
    const r = await api.unblock(b.id);
    if (!r.ok) return toast(r.error.message);
    toast(`${b.nickname}님 차단을 풀었어요`);
    await reloadComments(postId);
  }

  const small = { fontSize: rem(0.75) } as const;
  return (
    <Screen>
      <Slide view={view} dir={view === 'list' ? -1 : 1}>
        <Topbar />
        <Card gap={14}>
          <View testID={`board-${board}`}>
            <Txt v="eyebrow">News</Txt>
            <Txt v="h1" accessibilityRole="header">
              소식
            </Txt>
          </View>
          {!detail && !editing && !entering ? (
            <Seg cols={2} label="게시판" style={{ marginBottom: 6 }}>
              {BOARD_KEYS.map((k) => (
                <TabOpt
                  key={k}
                  title={BOARD_LABEL[k]}
                  selected={board === k}
                  testID={`board-tab-${k}`}
                  onPress={() => board !== k && openBoard(k)}
                />
              ))}
            </Seg>
          ) : null}

          {editing ? (
            <PostEditor
              board={board}
              draft={editing}
              onChange={setEditing}
              onSave={() => void savePost()}
              onCancel={() => setEditing(null)}
              busy={busy}
            />
          ) : detail ? (
            <>
              <View testID={`post-${detail.post.id}`} style={{ gap: 10 }}>
                <View style={{ gap: 4 }}>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}
                  >
                    <Tags p={detail.post} />
                    <Txt tone="muted" style={small}>
                      {`${dateOf(detail.post.createdAt)}${detail.post.updatedAt !== detail.post.createdAt ? ' · 수정됨' : ''} · 조회 ${detail.post.viewCount}`}
                    </Txt>
                  </View>
                  <Txt v="h2" accessibilityRole="header">
                    {detail.post.title}
                  </Txt>
                </View>
                <View>
                  {parseBody(detail.post.body).map((b, i) =>
                    b.kind === 'h' ? (
                      <Txt
                        key={i}
                        accessibilityRole="header"
                        style={{
                          marginTop: 14,
                          marginBottom: 4,
                          fontSize: rem(1),
                          fontWeight: '700',
                        }}
                      >
                        {b.text}
                      </Txt>
                    ) : b.kind === 'ul' ? (
                      <View key={i} style={{ marginBottom: 10, paddingLeft: 6, gap: 0 }}>
                        {b.items.map((it, j) => (
                          <View key={j} style={{ flexDirection: 'row', gap: 8 }}>
                            <Txt style={{ lineHeight: rem(1) * 1.6 }}>•</Txt>
                            <Txt style={{ flex: 1, lineHeight: rem(1) * 1.6 }}>{it}</Txt>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Txt key={i} style={{ marginBottom: 10, lineHeight: rem(1) * 1.6 }}>
                        {b.lines.join('\n')}
                      </Txt>
                    ),
                  )}
                </View>
                <Press
                  testID="like"
                  accessibilityLabel={`좋아요 ${detail.post.likeCount}`}
                  accessibilityState={{ selected: detail.liked }}
                  onPress={() => void toggleLike()}
                  style={{
                    alignSelf: 'center',
                    minWidth: 72,
                    minHeight: 44,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 9,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: c.line,
                    backgroundColor: c.surface,
                  }}
                >
                  <Heart color={detail.liked ? c.bad : c.ink} filled={detail.liked} />
                  <Txt
                    num
                    testID="like-count"
                    style={{
                      fontSize: rem(0.875),
                      fontWeight: '600',
                      color: detail.liked ? c.bad : c.ink,
                    }}
                  >
                    {detail.post.likeCount}
                  </Txt>
                </Press>
                {admin ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Btn sm testID="edit-post" onPress={() => startEdit(detail.post)}>
                      수정
                    </Btn>
                    <Btn sm testID="delete-post" onPress={() => void removePost(detail.post)}>
                      삭제
                    </Btn>
                  </View>
                ) : null}
              </View>
              <View accessibilityLabel="댓글" style={{ gap: 10 }}>
                <Txt v="h3" accessibilityRole="header">
                  {`댓글 ${detail.comments.length}`}
                </Txt>
                {detail.comments.length ? (
                  detail.comments.map((cm) => (
                    <View
                      key={cm.id}
                      testID={`comment-${cm.id}`}
                      style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8 }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {/* 관리자 댓글은 닉네임 대신 운영자 배지만(예전에 누구나 '운영자'라고 쓴 댓글과 구분된다). */}
                        {cm.admin ? (
                          <Pill tone="good">{ADMIN_NICKNAME}</Pill>
                        ) : (
                          <Txt bold>{cm.nickname}</Txt>
                        )}
                        <Txt tone="muted" style={small}>
                          {dateOf(cm.createdAt)}
                        </Txt>
                        {cm.deletable ? (
                          <CommentAct
                            label="삭제"
                            testID="comment-delete"
                            accessibilityLabel="댓글 삭제"
                            onPress={() => void removeComment(cm)}
                          />
                        ) : !cm.admin ? (
                          <CommentAct
                            label="신고"
                            testID="comment-report"
                            accessibilityLabel="댓글 신고·작성자 차단"
                            onPress={() => setReporting(reporting === cm.id ? null : cm.id)}
                          />
                        ) : null}
                      </View>
                      <Txt style={{ marginTop: 4 }}>{cm.body}</Txt>
                      {reporting === cm.id ? (
                        <View
                          testID="report-panel"
                          style={{
                            marginTop: 8,
                            gap: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 10,
                            backgroundColor: c.surface2,
                          }}
                        >
                          <Txt style={{ fontSize: rem(0.8125) }}>
                            이 댓글을 신고하는 이유를 골라 주세요. 신고한 댓글은 내 화면에서 숨겨요.
                          </Txt>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {COMMENT_REPORT_REASONS.map((reason) => (
                              <Btn
                                key={reason}
                                sm
                                testID={`report-${reason}`}
                                disabled={busy}
                                onPress={() => void report(cm, reason)}
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
                              {`${cm.nickname}님의 댓글을 모두 숨기려면`}
                            </Txt>
                            <Btn
                              sm
                              testID="comment-block"
                              disabled={busy}
                              onPress={() => void block(cm)}
                            >
                              작성자 차단
                            </Btn>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                    아직 댓글이 없어요.
                  </Txt>
                )}
                {detail.blocks.length ? (
                  <View testID="board-blocks" style={{ gap: 4 }}>
                    <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                      {`차단한 사용자 ${detail.blocks.length}명`}
                    </Txt>
                    {detail.blocks.map((b) => (
                      <View
                        key={b.id}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                      >
                        <Txt style={{ flex: 1 }}>{b.nickname}</Txt>
                        <Btn sm testID="unblock" onPress={() => void unblock(b)}>
                          차단 해제
                        </Btn>
                      </View>
                    ))}
                  </View>
                ) : null}
                {!viewer ? null : !viewer.google ? (
                  // 앱은 Apple 로그인도 있다 — iOS에서만 버튼이 함께 놓인다.
                  <View
                    testID="comment-gate-login"
                    style={{
                      gap: 8,
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: c.line,
                    }}
                  >
                    <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                      {apple
                        ? '구글이나 Apple로 로그인하면 댓글을 쓸 수 있어요.'
                        : '구글로 로그인하면 댓글을 쓸 수 있어요.'}
                    </Txt>
                    <Btn kind="primary" testID="comment-login" onPress={login}>
                      구글로 로그인
                    </Btn>
                    {apple ? (
                      <AppleLoginButton testID="comment-login-apple" onPress={loginApple} />
                    ) : null}
                  </View>
                ) : !viewer.nickname ? (
                  <View
                    testID="comment-gate-nickname"
                    style={{
                      gap: 8,
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: c.line,
                    }}
                  >
                    <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                      댓글에 쓸 닉네임을 먼저 정해 주세요. 설정의 계정에서 바꿀 수 있어요.
                    </Txt>
                    <NicknameForm
                      onsaved={(n) => setViewer((v) => (v ? { ...v, nickname: n } : v))}
                    />
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    <Txt tone="muted" style={small}>
                      <Txt bold tone="muted" style={small}>
                        {viewer.nickname}
                      </Txt>
                      {
                        ' 이름으로 남겨요. 욕설·비방·광고 같은 부적절한 댓글은 지우고 이용을 제한해요('
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
                    <TextBox
                      testID="comment-input"
                      accessibilityLabel="댓글 내용"
                      placeholder="댓글을 남겨 주세요"
                      multiline
                      numberOfLines={3}
                      maxLength={COMMENT_BODY_MAX}
                      value={commentText}
                      onChangeText={setCommentText}
                      style={{ minHeight: 3 * 26 + 22 }}
                    />
                    <Btn
                      kind="accent"
                      testID="send-comment"
                      disabled={busy}
                      onPress={() => void sendComment()}
                    >
                      댓글 달기
                    </Btn>
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              {admin && !entering ? (
                <Btn kind="accent" testID="new-post" onPress={() => startEdit()}>
                  새 글 쓰기
                </Btn>
              ) : null}
              <LoadState
                status={entering ? 'loading' : status}
                failText="소식을 불러오지 못했어요."
                retry={() => void load()}
              >
                <View>
                  {posts.length ? (
                    posts.map((p) => (
                      <Press
                        key={p.id}
                        scale={0.985}
                        testID={`post-row-${p.id}`}
                        onPress={() => void open(p.id)}
                        style={{
                          gap: 4,
                          paddingVertical: 12,
                          paddingHorizontal: 2,
                          borderBottomWidth: 1,
                          borderBottomColor: c.line,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Tags p={p} />
                          <Txt bold style={{ flexShrink: 1 }}>
                            {p.title}
                          </Txt>
                        </View>
                        <Txt tone="muted" style={small}>
                          {postMeta(p)}
                        </Txt>
                      </Press>
                    ))
                  ) : (
                    <Txt tone="muted">아직 올라온 글이 없어요.</Txt>
                  )}
                </View>
                {hasMore ? (
                  <Btn sm onPress={() => void load(true)}>
                    더 보기
                  </Btn>
                ) : null}
              </LoadState>
            </>
          )}
        </Card>
      </Slide>
    </Screen>
  );
}
