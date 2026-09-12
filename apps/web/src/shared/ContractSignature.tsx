import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button } from '@offside/ui';
import './contract-signature.css';

type Point = { x: number; y: number };

export function ContractSignature({
  signerName,
  fingerprint,
  disabled = false,
  onReadyChange,
}: {
  signerName: string;
  fingerprint: string;
  disabled?: boolean;
  onReadyChange: (ready: boolean) => void;
}) {
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [draftStroke, setDraftStroke] = useState<Point[]>([]);
  const [typedName, setTypedName] = useState(signerName);
  const activePointerRef = useRef<number | null>(null);
  const draftStrokeRef = useRef<Point[]>([]);
  const onReadyChangeRef = useRef(onReadyChange);
  onReadyChangeRef.current = onReadyChange;

  const drawnPoints = strokes.flat();
  const drawnDistance = strokes.reduce(
    (total, stroke) =>
      total +
      stroke.slice(1).reduce((distance, point, index) => {
        const previous = stroke[index]!;
        return distance + Math.hypot(point.x - previous.x, point.y - previous.y);
      }, 0),
    0,
  );
  const bounds = drawnPoints.reduce(
    (value, point) => ({
      minX: Math.min(value.minX, point.x),
      maxX: Math.max(value.maxX, point.x),
      minY: Math.min(value.minY, point.y),
      maxY: Math.max(value.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  const width = drawnPoints.length > 0 ? bounds.maxX - bounds.minX : 0;
  const height = drawnPoints.length > 0 ? bounds.maxY - bounds.minY : 0;
  const drawingReady =
    drawnPoints.length >= 3 && drawnDistance >= 24 && (width >= 8 || height >= 8);
  const typedReady = typedName.trim().length > 0;
  const ready = mode === 'draw' ? drawingReady : typedReady;

  useEffect(() => onReadyChangeRef.current(ready), [ready]);

  useEffect(() => {
    activePointerRef.current = null;
    draftStrokeRef.current = [];
    setStrokes([]);
    setDraftStroke([]);
    setTypedName(signerName);
    onReadyChangeRef.current(false);
  }, [fingerprint, signerName]);

  useEffect(() => {
    if (!disabled) return;
    activePointerRef.current = null;
    draftStrokeRef.current = [];
    setDraftStroke([]);
  }, [disabled]);

  function pointFromEvent(event: PointerEvent<SVGSVGElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1000, ((event.clientX - bounds.left) / bounds.width) * 1000)),
      y: Math.max(0, Math.min(240, ((event.clientY - bounds.top) / bounds.height) * 240)),
    };
  }

  function startStroke(event: PointerEvent<SVGSVGElement>) {
    if (disabled || activePointerRef.current !== null || event.button !== 0) return;
    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    draftStrokeRef.current = [point];
    setDraftStroke([point]);
  }

  function continueStroke(event: PointerEvent<SVGSVGElement>) {
    if (disabled || activePointerRef.current !== event.pointerId) return;
    const point = pointFromEvent(event);
    const current = draftStrokeRef.current;
    const previous = current.at(-1);
    if (
      current.length >= 2048 ||
      (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 1.5)
    )
      return;
    const next = [...current, point];
    draftStrokeRef.current = next;
    setDraftStroke(next);
  }

  function finishStroke(event: PointerEvent<SVGSVGElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    activePointerRef.current = null;
    const completed = draftStrokeRef.current;
    draftStrokeRef.current = [];
    setDraftStroke([]);
    if (completed.length > 0) setStrokes((existing) => [...existing.slice(-31), completed]);
  }

  function cancelStroke(event: PointerEvent<SVGSVGElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    draftStrokeRef.current = [];
    setDraftStroke([]);
  }

  function clear() {
    if (disabled) return;
    activePointerRef.current = null;
    draftStrokeRef.current = [];
    setStrokes([]);
    setDraftStroke([]);
    setTypedName('');
  }

  function selectMode(nextMode: 'draw' | 'type') {
    if (disabled || nextMode === mode) return;
    activePointerRef.current = null;
    draftStrokeRef.current = [];
    setDraftStroke([]);
    setMode(nextMode);
  }

  const visibleStrokes = draftStroke.length > 0 ? [...strokes, draftStroke] : strokes;
  return (
    <section className="os-signature" aria-labelledby="signature-heading">
      <div>
        <p className="os-eyebrow">선수 서명</p>
        <h2 id="signature-heading" className="os-section-title">
          계약서에 서명하세요
        </h2>
      </div>
      <div className="os-signature-tabs" role="group" aria-label="서명 방법">
        <Button
          aria-pressed={mode === 'draw'}
          variant={mode === 'draw' ? 'primary' : 'secondary'}
          disabled={disabled}
          onClick={() => selectMode('draw')}
        >
          직접 쓰기
        </Button>
        <Button
          aria-pressed={mode === 'type'}
          variant={mode === 'type' ? 'primary' : 'secondary'}
          disabled={disabled}
          onClick={() => selectMode('type')}
        >
          이름 입력
        </Button>
      </div>
      {mode === 'draw' ? (
        <svg
          className="os-signature-pad"
          viewBox="0 0 1000 240"
          preserveAspectRatio="none"
          role="img"
          aria-label="서명 입력란"
          data-disabled={disabled}
          onPointerDown={startStroke}
          onPointerMove={continueStroke}
          onPointerUp={finishStroke}
          onPointerCancel={cancelStroke}
          onLostPointerCapture={cancelStroke}
        >
          <path className="os-signature-line" d="M 40 190 H 960" />
          {visibleStrokes.map((stroke, index) => (
            <polyline
              key={index}
              points={stroke.map((point) => `${point.x},${point.y}`).join(' ')}
            />
          ))}
        </svg>
      ) : (
        <>
          <label className="os-signature-name">
            <span>서명할 이름</span>
            <input
              value={typedName}
              disabled={disabled}
              onChange={(event) => setTypedName(event.target.value)}
              autoComplete="name"
              aria-describedby="signature-name-hint"
            />
          </label>
          <p id="signature-name-hint" className="os-muted" style={{ fontSize: 'var(--os-fs-caption)' }}>
            계약서에 남을 이름입니다. 필요하면 고쳐 쓰세요.
          </p>
        </>
      )}
      {/* 이슈 157: 안내는 모드별로 갈리고(이름 입력 모드에 캔버스 안내가 남지 않게), 버튼은
          360px에서 라벨이 세 줄로 쪼개지지 않도록 짧은 라벨 + shrink-0으로 둔다. */}
      <div className="flex items-center justify-between gap-os-3">
        <p className="os-muted min-w-0">
          {mode === 'draw'
            ? '손가락이나 마우스로 쓰세요. 게임 연출용이며 새로고침하거나 화면을 나가면 사라집니다.'
            : '입력한 이름이 서명으로 남습니다. 게임 연출용이며 새로고침하거나 화면을 나가면 사라집니다.'}
        </p>
        <Button
          variant="ghost"
          className="shrink-0 whitespace-nowrap"
          disabled={disabled || (strokes.length === 0 && typedName.length === 0)}
          onClick={clear}
        >
          다시 쓰기
        </Button>
      </div>
      {!ready ? (
        <p className="os-muted" role="status">
          {mode === 'draw'
            ? '짧은 점이 아닌 서명을 입력해 주세요.'
            : '공백이 아닌 이름을 입력해 주세요.'}
        </p>
      ) : null}
    </section>
  );
}
