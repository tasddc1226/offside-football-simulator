// T-11-111 당겨서 새로고침 — 화면마다(app/index.tsx) RefreshRoot가 범위를 열고, 서버에서 불러오는 컴포넌트가
// useRefresh로 참여한다. 참여한 컴포넌트가 있으면 Screen이 당김을 켠다. 당기면 tick이 올라 참여한 effect만 다시
// 돌고(화면을 새로 그리지 않는다), track으로 감싼 요청이 끝날 때까지 돈다. 새로고침 중에 또 당기면 무시한다.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { RefreshControl } from 'react-native';
import { clearApiCache } from '@offside/app-core/api/client';
import { useColors } from '../theme/useColors';

type Data = {
  tick: number;
  track: <T>(p: Promise<T>) => Promise<T>;
  join: () => () => void;
};
type Control = { on: boolean; refreshing: boolean; onRefresh: () => void };

const DataScope = createContext<Data>({ tick: 0, track: (p) => p, join: () => () => {} });
const ControlScope = createContext<Control>({ on: false, refreshing: false, onRefresh: () => {} });

/**
 * 서버에서 불러오는 effect의 deps에 tick을 넣고, 요청을 track으로 감싼다.
 * 예: useEffect(() => { if (!pulled()) setX(null); void track(getX()).then(...) }, [id, tick, track])
 */
export function useRefresh() {
  const { tick, track, join } = useContext(DataScope);
  useEffect(join, [join]);
  const seen = useRef(tick);
  /** 이번 effect가 당기기로 다시 돈 것인지(그러면 보이던 목록을 비우지 않는다). effect 하나에서 한 번만 부른다. */
  const pulled = () => {
    const p = seen.current !== tick;
    seen.current = tick;
    return p;
  };
  return { tick, track, pulled };
}

/** 화면 하나의 새로고침 범위. 화면이 바뀌면(key) 새로 연다. */
export function RefreshRoot({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState(0);
  const pending = useRef(new Set<Promise<unknown>>());
  const busy = useRef(false);

  const track = useCallback(<T,>(p: Promise<T>) => {
    if (busy.current) pending.current.add(p);
    return p;
  }, []);
  const join = useCallback(() => {
    setMembers((n) => n + 1);
    return () => setMembers((n) => n - 1);
  }, []);

  // 자식 effect가 먼저 돌아 요청을 track에 넣은 뒤에 모아서 기다린다(React는 자식 effect를 부모보다 먼저 부른다).
  useEffect(() => {
    if (!busy.current) return;
    const all = [...pending.current];
    pending.current.clear();
    void Promise.allSettled(all).then(() => {
      busy.current = false;
      setRefreshing(false);
    });
  }, [tick]);

  const onRefresh = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    // 기기 메모(60초~10분)를 비워야 당긴 요청이 서버까지 간다. 연타는 위 busy로 막는다.
    clearApiCache();
    setRefreshing(true);
    setTick((t) => t + 1);
  }, []);

  const data = useMemo<Data>(() => ({ tick, track, join }), [tick, track, join]);
  const control = useMemo<Control>(
    () => ({ on: members > 0, refreshing, onRefresh }),
    [members, refreshing, onRefresh],
  );
  return (
    <DataScope.Provider value={data}>
      <ControlScope.Provider value={control}>{children}</ControlScope.Provider>
    </DataScope.Provider>
  );
}

/** Screen이 쓴다 — 이 화면에 참여한 컴포넌트가 있을 때만 당김을 돌려준다. */
export function useRefreshControl(enabled: boolean) {
  const c = useColors();
  const { on, refreshing, onRefresh } = useContext(ControlScope);
  if (!enabled || !on) return undefined;
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={c.muted}
      colors={[c.accent]}
      progressBackgroundColor={c.surface}
    />
  );
}
