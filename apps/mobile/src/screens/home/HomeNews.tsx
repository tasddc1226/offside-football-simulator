// 홈의 소식 섹션(웹 HomeNews.svelte). T-11-606 공지사항 · 릴리즈 노트를 카드 하나로 합쳐 최근 공지 1개와 최신 글을 보여 주고
// (pickHomeNews), 글을 누르면 소식 화면에서 본문·댓글을 연다. 두 게시판 목록은 새 소식 확인과 같은 메모라 요청이 늘지 않는다.
// '전체 보기'는 글이 없어도 보인다 — 관리자의 새 글 쓰기가 소식 화면에 있어서, 숨기면 첫 글을 쓸 길이 없다.
import { FONT } from '@offside/app-core/design-tokens';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { fetchPosts, type PostSummary } from '@offside/app-core/api/boards';
import { postMeta } from '@offside/app-core/boardText';
import { pickHomeNews } from '@offside/app-core/homeNews';
import { isNewPost } from '../../game/host';
import { openBoard } from '../../game/nav';
import { hiddenPost } from '../../platform/storeText';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { Card, MoreLink, Pill, Press, Row, Txt } from '../../ui';
import { homeText as L } from '@offside/app-core/i18n/ko/home';
import { shellText as LS } from '@offside/app-core/i18n/ko/shell';
import { useRefresh } from '../../ui/refresh';
import { Skeleton } from '../../ui/Skeleton';

export function HomeNews() {
  const c = useColors();
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  const { tick, track } = useRefresh();
  useEffect(() => {
    let alive = true;
    void track(Promise.all([fetchPosts('notice'), fetchPosts('release')])).then((rs) => {
      if (!alive) return;
      // 한쪽만 실패하면 불러온 쪽 글이라도 보여 준다. T-11-440 한 번 실패한 뒤 당겨서 다시 받으면 오류 문구를 거두고,
      // 다시 실패해도 받아 둔 글은 그대로 둔다.
      if (rs.some((r) => r.ok)) {
        const loaded = rs.flatMap((r) => (r.ok ? r.data.posts : []));
        setPosts(pickHomeNews(loaded.filter((p) => !hiddenPost(p))));
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [tick, track]);

  return (
    <View testID="home-news">
      <Card gap={0}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <View style={{ flex: 1 }}>
            <Txt v="eyebrow">News</Txt>
            <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 4 }}>
              {LS.navBoard}
            </Txt>
          </View>
          {posts ? (
            <MoreLink testID="news-all" what={LS.navBoard} onPress={() => openBoard('notice')} />
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
            {posts.map((p) => (
              <Press
                key={p.id}
                scale={0.985}
                testID={`post-row-${p.id}`}
                accessibilityLabel={isNewPost(p) ? `${L.postNew} ${p.title}` : p.title}
                onPress={() => openBoard(p.board, p.id)}
                style={{
                  gap: 4,
                  paddingVertical: 12,
                  paddingHorizontal: 2,
                  borderBottomWidth: 1,
                  borderBottomColor: c.line,
                }}
              >
                <Row gap={6}>
                  <Pill>{p.board === 'notice' ? L.newsTagNotice : L.newsTagRelease}</Pill>
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
