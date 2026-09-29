// 홈의 소식 섹션(웹 HomeNews.svelte — 공지사항 · 릴리즈 노트). 최근 글 몇 개만 보여 주고, 글을 누르면 소식 화면에서 본문·댓글을 연다.
// '전체 보기'는 글이 없어도 보인다 — 관리자의 새 글 쓰기가 소식 화면에 있어서, 숨기면 첫 글을 쓸 길이 없다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { fetchPosts, type BoardKey, type PostSummary } from '@offside/app-core/api/boards';
import { postMeta } from '@offside/app-core/boardText';
import { openBoard } from '../../game/nav';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Btn, Card, Pill, Press, Row, Txt } from '../../ui';

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

  useEffect(() => {
    let alive = true;
    void fetchPosts(board).then((r) => {
      if (!alive) return;
      if (r.ok) setPosts(r.data.posts);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [board]);

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
            <Btn sm testID="news-all" onPress={() => openBoard(board)}>
              전체 보기
            </Btn>
          ) : null}
        </View>
        {failed ? (
          <Empty>소식을 불러오지 못했어요.</Empty>
        ) : !posts ? (
          <Empty>불러오는 중…</Empty>
        ) : !posts.length ? (
          <Empty>아직 올라온 글이 없어요.</Empty>
        ) : (
          <View>
            {posts.slice(0, SHOWN).map((p) => (
              <Press
                key={p.id}
                scale={0.985}
                testID={`post-row-${p.id}`}
                accessibilityLabel={p.title}
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
                  {p.pinned ? <Pill tone="warn">고정</Pill> : null}
                  {p.version ? <Pill>{p.version}</Pill> : null}
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
    <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
      {children}
    </Txt>
  );
}
