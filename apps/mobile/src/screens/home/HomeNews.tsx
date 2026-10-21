// 홈의 소식 섹션(웹 HomeNews.svelte — 공지사항 · 릴리즈 노트). 최근 글 몇 개만 보여 주고, 글을 누르면 소식 화면에서 본문·댓글을 연다.
// '전체 보기'는 글이 없어도 보인다 — 관리자의 새 글 쓰기가 소식 화면에 있어서, 숨기면 첫 글을 쓸 길이 없다.
import { FONT } from '@offside/app-core/design-tokens';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { fetchPosts, type BoardKey, type PostSummary } from '@offside/app-core/api/boards';
import { postMeta } from '@offside/app-core/boardText';
import { isNewPost } from '../../game/host';
import { openBoard } from '../../game/nav';
import { hiddenPost } from '../../platform/storeText';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Card, MoreLink, Pill, Press, Row, Txt } from '../../ui';
import { homeText as L } from '@offside/app-core/i18n/ko/home';
import { useRefresh } from '../../ui/refresh';
import { Skeleton } from '../../ui/Skeleton';

const SHOWN = 3;

export function HomeNews({
  board,
  eyebrow,
  title,
}: {
  board: BoardKey;
  eyebrow: string;
  title: string;
}) {
  const c = useColors();
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  const { tick, track } = useRefresh();
  useEffect(() => {
    let alive = true;
    void track(fetchPosts(board)).then((r) => {
      if (!alive) return;
      // T-11-440 한 번 실패한 뒤 당겨서 다시 받으면 오류 문구를 거둔다. 다시 실패해도 받아 둔 글은 그대로 둔다.
      if (r.ok) {
        setPosts(r.data.posts.filter((p) => !hiddenPost(p)));
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [board, tick, track]);

  return (
    <View testID={`home-news-${board}`}>
      <Card gap={0}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <View style={{ flex: 1 }}>
            <Txt v="eyebrow">{eyebrow}</Txt>
            <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 4 }}>
              {title}
            </Txt>
          </View>
          {posts ? (
            <MoreLink testID="news-all" what={title} onPress={() => openBoard(board)} />
          ) : null}
        </View>
        {failed && !posts ? (
          <Empty>{L.newsFailed}</Empty>
        ) : !posts ? (
          <Skeleton rows={3} />
        ) : !posts.length ? (
          <Empty>{L.newsEmpty}</Empty>
        ) : (
          <View>
            {posts.slice(0, SHOWN).map((p) => (
              <Press
                key={p.id}
                scale={0.985}
                testID={`post-row-${p.id}`}
                accessibilityLabel={isNewPost(p) ? `${L.postNew} ${p.title}` : p.title}
                onPress={() => openBoard(board, p.id)}
                style={{
                  gap: 4,
                  paddingVertical: 12,
                  paddingHorizontal: 2,
                  borderBottomWidth: 1,
                  borderBottomColor: c.line,
                }}
              >
                <Row gap={6}>
                  {p.pinned ? <Pill tone="warn">{L.pinned}</Pill> : null}
                  {p.version ? <Pill>{p.version}</Pill> : null}
                  {isNewPost(p) ? <Pill tone="good">{L.postNew}</Pill> : null}
                  <Txt bold>{p.title}</Txt>
                </Row>
                <Txt v="xs" tone="muted">
                  {postMeta(p)}
                </Txt>
              </Press>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <Txt tone="muted" style={{ fontSize: rem(FONT.body2), paddingVertical: 8 }}>
      {children}
    </Txt>
  );
}
