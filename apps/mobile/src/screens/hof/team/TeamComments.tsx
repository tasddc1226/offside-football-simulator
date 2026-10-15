// T-11-290 팀 프로필의 스쿼드 댓글(웹 team/TeamComments.svelte) — 소식 글 댓글(screens/board/Board.tsx)과 같은 규칙·모양.
// 읽기는 누구나, 쓰기는 구글(iOS는 Apple도)로 로그인하고 닉네임을 정한 사람만. 남의 댓글은 신고하고 작성자를 차단한다
// (앱스토어 UGC 정책) — 신고한 댓글·차단한 사람의 댓글은 서버가 빼고 준다. 지우기·신고·차단·차단 해제는 게시판 댓글 API 그대로.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  ADMIN_NICKNAME,
  COMMENT_BODY_MAX,
  COMMENT_REPORT_REASONS,
} from '@offside/contracts/board-limits';
import type { CommentReportReason } from '@offside/contracts/board-limits';
import { addTeamComment, fetchTeamComments } from '@offside/app-core/api/team';
import * as boards from '@offside/app-core/api/boards';
import type { BoardBlock, BoardViewerResponse, Comment } from '@offside/app-core/api/boards';
import { REPORT_REASON_LABEL, dateOf } from '@offside/app-core/boardText';
import { boardText as LB } from '@offside/app-core/i18n/ko/board';
import { boardLabelText } from '@offside/app-core/i18n/ko/boardLabel';
import { teamAchText as L } from '@offside/app-core/i18n/ko/teamAch';
import { NicknameForm } from '../../../components/NicknameForm';
import { OwnerAvatar } from '../../../components/OwnerAvatar';
import { TierBadge } from '../../../components/TierBadge';
import { TitleBadge } from '../../../components/TitleBadge';
import { toast } from '../../../game/host';
import { startAppleLogin, startGoogleLogin } from '../../../platform/auth';
import { openWeb } from '../../../platform/openWeb';
import { shownComments } from '../../../platform/storeText';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { AppleLoginButton, useAppleLogin } from '../../../ui/AppleLoginButton';
import { Btn } from '../../../ui/Btn';
import { Card } from '../../../ui/Card';
import { GoogleLoginButton } from '../../../ui/GoogleLoginButton';
import { Press } from '../../../ui/Press';
import { Pill } from '../../../ui/bits';
import { Txt } from '../../../ui/Txt';
import { useTranslations } from '../../../ui/Translate';
import { TextBox, confirmAsync } from '../../board/parts';

const small = { fontSize: rem(0.75) } as const;

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

export function TeamComments({ teamId }: { teamId: string }) {
  const c = useColors();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [blocks, setBlocks] = useState<BoardBlock[]>([]);
  const [failed, setFailed] = useState(false);
  /** 댓글 자격(로그인·닉네임). 불러오기 전엔 null(댓글 폼을 그리지 않는다). */
  const [viewer, setViewer] = useState<BoardViewerResponse | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  /** 신고·차단 패널을 펼친 댓글. */
  const [reporting, setReporting] = useState<string | null>(null);
  const tr = useTranslations();
  const apple = useAppleLogin();

  /** 한 번이라도 받았으면 다시 받기 실패는 조용히 넘긴다(보던 목록을 둔다). */
  const loaded = useRef(false);
  const load = useCallback(async () => {
    const r = await fetchTeamComments(teamId);
    if (!r.ok) return void (loaded.current || setFailed(true));
    loaded.current = true;
    setFailed(false);
    setComments(shownComments(r.data.comments ?? []));
    setBlocks(r.data.blocks ?? []);
  }, [teamId]);
  useEffect(() => {
    void load();
    void boards
      .fetchBoardViewer()
      .then((r) => setViewer(r.ok ? r.data : { admin: false, google: false, nickname: null }));
  }, [load]);

  const back = () => ({ team: teamId });
  async function send() {
    if (busy || !text.trim()) return;
    setBusy(true);
    const r = await addTeamComment(teamId, { body: text });
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    setText('');
    const added = r.data;
    setComments((cs) => [...(cs ?? []), added]);
  }
  async function remove(cm: Comment) {
    if (!(await confirmAsync(LB.deleteCommentConfirm, undefined, LB.remove))) return;
    const r = await boards.deleteComment(cm.id);
    if (!r.ok) return toast(r.error.message);
    setComments((cs) => (cs ?? []).filter((x) => x.id !== cm.id));
  }
  async function report(cm: Comment, reason: CommentReportReason) {
    setBusy(true);
    const r = await boards.reportComment(cm.id, { reason });
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    setReporting(null);
    setComments((cs) => (cs ?? []).filter((x) => x.id !== cm.id));
    toast(LB.reportedToast);
  }
  async function block(cm: Comment) {
    const ok = await confirmAsync(LB.blockTitle({ nick: cm.nickname }), LB.blockBody, LB.blockOk);
    if (!ok) return;
    setBusy(true);
    const r = await boards.blockAuthor(cm.id);
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    setReporting(null);
    toast(LB.blockedToast({ nick: r.data.nickname }));
    await load();
  }
  async function unblock(b: BoardBlock) {
    const r = await boards.unblock(b.id);
    if (!r.ok) return toast(r.error.message);
    toast(LB.unblockedToast({ nick: b.nickname }));
    await load();
  }

  const gate = {
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.line,
  } as const;

  return (
    <Card gap={10} testID={`team-comments-${teamId}`}>
      <View>
        <Txt v="eyebrow">Squad talk</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt v="h2" accessibilityRole="header">
            {L.profCommentsTitle}
          </Txt>
          {comments?.length ? (
            <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
              {boardLabelText.commentCount({ n: comments.length })}
            </Txt>
          ) : null}
        </View>
        <Txt tone="muted" style={{ fontSize: rem(0.8125), marginTop: 4 }}>
          {L.profCommentsHint}
        </Txt>
      </View>
      {failed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
            {L.profCommentsFail}
          </Txt>
          <Btn sm onPress={() => void load()}>
            {LB.more}
          </Btn>
        </View>
      ) : comments ? (
        <>
          {comments.length ? (
            comments.map((cm) => (
              <View
                key={cm.id}
                testID={`comment-${cm.id}`}
                style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <OwnerAvatar avatarId={cm.avatarId} name={cm.nickname} />
                  {cm.admin ? (
                    <Pill tone="good">{ADMIN_NICKNAME}</Pill>
                  ) : (
                    <>
                      <Txt bold>{cm.nickname}</Txt>
                      {cm.tier ? <TierBadge tag={cm.tier} /> : null}
                      {cm.title ? <TitleBadge title={cm.title} size="sm" /> : null}
                    </>
                  )}
                  <Txt tone="muted" style={small}>
                    {dateOf(cm.createdAt)}
                  </Txt>
                  {cm.deletable ? (
                    <CommentAct
                      label={LB.remove}
                      testID="comment-delete"
                      accessibilityLabel={LB.commentDeleteLabel}
                      onPress={() => void remove(cm)}
                    />
                  ) : !cm.admin ? (
                    <CommentAct
                      label={LB.report}
                      testID="comment-report"
                      accessibilityLabel={LB.commentReportLabel}
                      onPress={() => setReporting(reporting === cm.id ? null : cm.id)}
                    />
                  ) : null}
                </View>
                <Txt style={{ marginTop: 4 }}>{tr.text(cm.id, cm.body)}</Txt>
                {tr.button(cm.id, cm.body)}
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
                    <Txt style={{ fontSize: rem(0.8125) }}>{LB.reportPrompt}</Txt>
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
                        {LB.blockHint({ nick: cm.nickname })}
                      </Txt>
                      <Btn sm testID="comment-block" disabled={busy} onPress={() => void block(cm)}>
                        {LB.blockAuthor}
                      </Btn>
                    </View>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
              {L.profCommentsEmpty}
            </Txt>
          )}
          {blocks.length ? (
            <View testID="board-blocks" style={{ gap: 4 }}>
              <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                {LB.blockedUsers({ n: blocks.length })}
              </Txt>
              {blocks.map((b) => (
                <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Txt style={{ flex: 1 }}>{b.nickname}</Txt>
                  <Btn sm testID="unblock" onPress={() => void unblock(b)}>
                    {LB.unblock}
                  </Btn>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      {!viewer ? null : !viewer.google ? (
        <View testID="comment-gate-login" style={gate}>
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
            {apple ? LB.loginGateApple : LB.loginGate}
          </Txt>
          <GoogleLoginButton testID="comment-login" onPress={() => void startGoogleLogin(back())} />
          {apple ? (
            <AppleLoginButton
              testID="comment-login-apple"
              onPress={() => void startAppleLogin(back())}
            />
          ) : null}
        </View>
      ) : !viewer.nickname ? (
        <View testID="comment-gate-nickname" style={gate}>
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
            {LB.nicknameGate}
          </Txt>
          <NicknameForm onsaved={(n) => setViewer((v) => (v ? { ...v, nickname: n } : v))} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Txt tone="muted" style={small}>
            {LB.commentAsBefore}
            <Txt bold tone="muted" style={small}>
              {viewer.nickname}
            </Txt>
            {LB.commentAsAfter}
            <Txt
              tone="muted"
              style={[small, { textDecorationLine: 'underline' }]}
              accessibilityRole="link"
              onPress={() => openWeb('/legal/terms/')}
            >
              {LB.terms}
            </Txt>
            {LB.commentAsEnd}
          </Txt>
          <TextBox
            testID="team-comment-input"
            accessibilityLabel={LB.commentLabel}
            placeholder={L.profCommentPlaceholder}
            multiline
            numberOfLines={3}
            maxLength={COMMENT_BODY_MAX}
            value={text}
            onChangeText={setText}
            style={{ minHeight: 3 * 26 + 22 }}
          />
          <Btn kind="accent" testID="send-team-comment" disabled={busy} onPress={() => void send()}>
            {LB.commentSend}
          </Btn>
        </View>
      )}
    </Card>
  );
}
