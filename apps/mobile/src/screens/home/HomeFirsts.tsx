// 홈 타일의 서버 최초 기록 진입점(웹 firsts/HomeFirsts.svelte). 가장 최근에 세워진 기록 한 줄을 보여 주고, 누르면 전체 화면으로 간다.
import { useEffect, useState } from 'react';
import type { ServerFirst } from '@offside/contracts';
import { getFirsts } from '@offside/app-core/api/client';
import { achievedList } from '@offside/app-core/firsts';
import { go } from '../../game/nav';
import { useRefresh } from '../../ui/refresh';
import { Tile } from './Tile';

export function HomeFirsts() {
  const [latest, setLatest] = useState<ServerFirst | null>(null);
  const [count, setCount] = useState<{ done: number; total: number } | null>(null);
  const { tick, track } = useRefresh();
  useEffect(() => {
    let alive = true;
    void track(getFirsts()).then((r) => {
      if (!alive || !r.ok) return;
      const done = achievedList(r.data.items);
      setLatest(done[0] ?? null);
      setCount({ done: done.length, total: r.data.items.length });
    });
    return () => {
      alive = false;
    };
  }, [tick, track]);

  return (
    <Tile
      testID="firsts"
      eyebrow="Server firsts"
      title={latest ? latest.label : '서버 최초 기록'}
      sub={`${count ? `서버 최초 업적 ${count.done} / ${count.total}` : '모든 플레이어 중 첫 기록 보기'} →`}
      subNum
      onPress={() => go('firsts')}
    />
  );
}
