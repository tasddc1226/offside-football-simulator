// 새 공지사항·릴리즈 노트 알림(웹 NewsBanner.svelte, news.svelte.ts). 소식 화면을 보고 있을 때는 띄우지 않는다.
// 이미 본 글이 고쳐져도 같은 자리에 알린다. 새 버전 배너(UpdateBanner)·스토어 업데이트 안내가 떠 있으면 그쪽을 먼저 보인다.
import { useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { PostSummary } from '@offside/app-core/api/boards';
import { dismissNews } from '../game/host';
import { openBoard } from '../game/nav';
import { useStoreUpdateShown } from '../platform/storeUpdate';
import { useUpdatePending } from '../platform/updates';
import { appState, newsState } from '../store';
import { alpha } from '../theme/colors';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Btn, Press, Txt } from '../ui';
import { TopBanner } from './TopBanner';
import { useFly } from './useFly';

export function NewsBanner() {
  const c = useColors();
  const news = useSnapshot(newsState);
  const { screen } = useSnapshot(appState);
  const updatePending = useUpdatePending();
  const storeShown = useStoreUpdateShown();
  const show = !!news.post && screen !== 'board' && !updatePending && !storeShown;
  const { mounted, style } = useFly(show, 200);
  // 사라지는 동안에도 글자가 남도록 마지막 글을 붙들어 둔다.
  const [last, setLast] = useState<{
    post: PostSummary;
    count: number;
    edited: boolean;
  } | null>(null);
  if (
    news.post &&
    (!last ||
      last.post.id !== news.post.id ||
      last.count !== news.count ||
      last.edited !== news.edited)
  )
    setLast({ post: { ...news.post }, count: news.count, edited: news.edited });
  const cur = news.post ? { post: news.post, count: news.count, edited: news.edited } : last;
  if (!mounted || !cur) return null;
  const { post, count, edited } = cur;
  const headline =
    count > 1
      ? `새 소식 ${count}개가 올라왔어요`
      : edited
        ? post.board === 'release'
          ? '릴리즈 노트가 수정됐어요'
          : '공지가 수정됐어요'
        : post.board === 'release'
          ? '새 릴리즈 노트가 올라왔어요'
          : '새로운 공지가 올라왔어요';
  const open = () => {
    const { board, id } = post;
    dismissNews();
    openBoard(board, id);
  };

  return (
    <TopBanner testID={`news-banner-${post.board}`} label="새 소식 알림" style={style}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt bold style={{ fontSize: rem(0.875), lineHeight: rem(0.875) * 1.4, color: c.onPitch }}>
          {headline}
        </Txt>
        <Txt
          numberOfLines={1}
          style={{
            fontSize: rem(0.8125),
            lineHeight: rem(0.8125) * 1.4,
            color: alpha(c.onPitch, 0.85),
          }}
        >
          {post.title}
        </Txt>
      </View>
      <Btn kind="accent" sm testID="news-open" onPress={open}>
        보기
      </Btn>
      <Press
        testID="news-close"
        accessibilityLabel="알림 닫기"
        onPress={dismissNews}
        hitSlop={4}
        style={{
          width: 36,
          height: 36,
          marginLeft: -4,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt style={{ fontSize: rem(1), color: c.onPitch }}>✕</Txt>
      </Press>
    </TopBanner>
  );
}
