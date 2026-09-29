// T-10-016 댓글 관리(웹 admin/AdminComments.svelte): 전체 게시판의 최근 댓글을 보고 지운다. 도배·욕설은 작성자(프로필) 단위로
// 모아 보고 한 번에 지울 수 있다(감사 로그가 남는다).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as api from '@offside/app-core/api/admin';
import type { AdminComment } from '@offside/app-core/api/admin';
import { deleteComment } from '@offside/app-core/api/boards';
import { BOARD_LABEL, kstDateTime as kst } from '@offside/app-core/boardText';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { toast } from '../../../game/host';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Pill } from '../../../ui/bits';
import { Txt } from '../../../ui/Txt';
import { confirmAsync } from '../../board/parts';

type Author = { id: string; nickname: string };
const short = (profileId: string) => profileId.slice(4, 12);

export default function AdminComments() {
  const c = useColors();
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<LoadStatus>('loading');
  /** 한 작성자만 볼 때 그 프로필과 닉네임. */
  const [author, setAuthor] = useState<Author | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(more = false, who: Author | null = author) {
    if (!more) setStatus('loading');
    const r = await api.fetchAdminComments({
      ...(more && comments.length ? { before: comments.at(-1)!.createdAt } : {}),
      ...(who ? { profile: who.id } : {}),
    });
    if (!r.ok) {
      if (more) toast(r.error.message);
      else setStatus('error');
      return;
    }
    setComments(more ? [...comments, ...r.data.comments] : r.data.comments);
    setHasMore(r.data.hasMore);
    setStatus('ready');
  }
  useEffect(() => void load(), []);
  function filterBy(cm: AdminComment | null) {
    const who = cm && { id: cm.profileId, nickname: cm.nickname };
    setAuthor(who);
    void load(false, who);
  }

  async function remove(cm: AdminComment) {
    if (!(await confirmAsync('이 댓글을 지울까요?', `${cm.nickname}: ${cm.body}`, '삭제'))) return;
    setBusy(true);
    const r = await deleteComment(cm.id);
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    setComments((list) => list.filter((x) => x.id !== cm.id));
  }
  async function purge(cm: AdminComment) {
    if (
      !(await confirmAsync(
        `'${cm.nickname}' 작성자(${short(cm.profileId)})의 댓글을 모두 지울까요?`,
        '되돌릴 수 없습니다.',
        '모두 삭제',
      ))
    )
      return;
    setBusy(true);
    const r = await api.purgeComments(cm.profileId);
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    toast(`댓글 ${r.data.deleted}개를 지웠어요`);
    setComments((list) => list.filter((x) => x.profileId !== cm.profileId));
  }

  return (
    <View testID="admin-comments" style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="h2" accessibilityRole="header">
          댓글 관리
        </Txt>
        <Btn sm onPress={() => void load()}>
          새로고침
        </Btn>
      </View>
      {author ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: c.surface2,
          }}
        >
          <Txt style={{ flex: 1 }}>
            <Txt bold>{author.nickname}</Txt>
            <Txt tone="muted">{` (${short(author.id)})`}</Txt>
            {'의 댓글만 보는 중'}
          </Txt>
          <Btn sm testID="clear-filter" onPress={() => filterBy(null)}>
            전체 보기
          </Btn>
        </View>
      ) : null}

      <LoadState status={status} failText="댓글을 불러오지 못했어요." retry={() => void load()}>
        <View>
          {comments.length ? (
            comments.map((cm) => (
              <View
                key={cm.id}
                testID={`admin-comment-${cm.id}`}
                style={{
                  gap: 4,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: c.line,
                }}
              >
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}
                >
                  <Txt bold>{cm.nickname}</Txt>
                  {cm.admin ? <Pill tone="good">운영자</Pill> : null}
                  <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                    {`${short(cm.profileId)} · ${kst(cm.createdAt)}`}
                  </Txt>
                </View>
                <Txt>{cm.body}</Txt>
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {`[${BOARD_LABEL[cm.board]}] ${cm.postTitle}`}
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Btn sm testID="delete-comment" disabled={busy} onPress={() => void remove(cm)}>
                    삭제
                  </Btn>
                  {!author ? (
                    <Btn sm testID="filter-author" onPress={() => filterBy(cm)}>
                      이 작성자 댓글
                    </Btn>
                  ) : null}
                  {!cm.admin ? (
                    <Btn sm testID="purge-author" disabled={busy} onPress={() => void purge(cm)}>
                      작성자 댓글 모두 삭제
                    </Btn>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Txt tone="muted">댓글이 없어요.</Txt>
          )}
        </View>
        {hasMore ? (
          <Btn sm onPress={() => void load(true)}>
            더 보기
          </Btn>
        ) : null}
      </LoadState>
    </View>
  );
}
