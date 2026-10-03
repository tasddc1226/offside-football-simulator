import { useMemo, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
export type PlayerDrag = {
  start: (index: number | null, id: string | null, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: (x: number, y: number, success: boolean) => void;
};
export function DragPlayer({
  index,
  id,
  drag,
  children,
}: {
  index: number | null;
  id: string | null;
  drag?: PlayerDrag | undefined;
  children: ReactNode;
}) {
  const handlers = useRef({ index, id, drag });
  handlers.current = { index, id, drag };
  const enabled = !!drag;
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(220)
        .runOnJS(true)
        .onStart((e) =>
          handlers.current.drag?.start(
            handlers.current.index,
            handlers.current.id,
            e.absoluteX,
            e.absoluteY,
          ),
        )
        .onUpdate((e) => handlers.current.drag?.move(e.absoluteX, e.absoluteY))
        .onFinalize((e, success) => handlers.current.drag?.end(e.absoluteX, e.absoluteY, success)),
    [enabled],
  );
  return (
    <GestureDetector gesture={pan}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  );
}
