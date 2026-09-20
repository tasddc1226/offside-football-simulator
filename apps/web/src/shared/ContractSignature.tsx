import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button, Dialog, DialogContent, DialogTrigger } from '@offside/ui';
import './contract-signature.css';

type Point = { x: number; y: number };
type Signature = { mode: 'draw' | 'type'; strokes: Point[][]; name: string; fingerprint: string };

function drawingReady(strokes: Point[][]): boolean {
  let distance = 0;
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.length; index += 1) {
      const point = stroke[index]!;
      const previous = stroke[index - 1]!;
      distance += Math.hypot(point.x - previous.x, point.y - previous.y);
    }
  }
  return distance >= 24;
}

function Ink({ strokes }: { strokes: Point[][] }) {
  return strokes.map((stroke, index) => (
    <polyline key={index} points={stroke.map((point) => `${point.x},${point.y}`).join(' ')} />
  ));
}

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
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [draftStroke, setDraftStroke] = useState<Point[]>([]);
  const [typedName, setTypedName] = useState(signerName);
  const [signature, setSignature] = useState<Signature | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const draftStrokeRef = useRef<Point[]>([]);
  const onReadyChangeRef = useRef(onReadyChange);
  onReadyChangeRef.current = onReadyChange;
  const signed = signature?.fingerprint === fingerprint ? signature : null;
  const ready = signed !== null;
  const canApply = mode === 'draw' ? drawingReady(strokes) : typedName.trim().length > 0;

  useEffect(() => onReadyChangeRef.current(ready), [ready]);
  useEffect(() => {
    activePointerRef.current = null;
    draftStrokeRef.current = [];
    setSignature(null);
    setOpen(false);
    setStrokes([]);
    setDraftStroke([]);
    setTypedName(signerName);
  }, [fingerprint, signerName]);

  function cancelDrawing() {
    activePointerRef.current = null;
    draftStrokeRef.current = [];
    setDraftStroke([]);
  }

  function openEditor(nextMode: 'draw' | 'type') {
    if (disabled) return;
    cancelDrawing();
    setStrokes(signed?.strokes ?? []);
    setTypedName(signed?.name ?? signerName);
    setMode(nextMode);
    setOpen(true);
  }

  function changeOpen(next: boolean) {
    if (next) openEditor(signed?.mode ?? 'draw');
    else {
      cancelDrawing();
      setOpen(false);
    }
  }

  function appendPoint(event: { clientX: number; clientY: number }, bounds: DOMRect) {
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const point = {
      x: Math.max(0, Math.min(1000, ((event.clientX - bounds.left) / bounds.width) * 1000)),
      y: Math.max(0, Math.min(500, ((event.clientY - bounds.top) / bounds.height) * 500)),
    };
    const previous = draftStrokeRef.current.at(-1);
    if (
      draftStrokeRef.current.length >= 4096 ||
      (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.5)
    )
      return;
    draftStrokeRef.current.push(point);
  }

  function startStroke(event: PointerEvent<HTMLDivElement>) {
    if (disabled || activePointerRef.current !== null || event.button !== 0) return;
    event.preventDefault();
    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    draftStrokeRef.current = [];
    appendPoint(event, event.currentTarget.getBoundingClientRect());
    setDraftStroke([...draftStrokeRef.current]);
  }

  function continueStroke(event: PointerEvent<HTMLDivElement>) {
    if (disabled || activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of samples) appendPoint(sample, bounds);
    appendPoint(event, bounds);
    setDraftStroke([...draftStrokeRef.current]);
  }

  function finishStroke(event: PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    appendPoint(event, event.currentTarget.getBoundingClientRect());
    const completed = draftStrokeRef.current;
    // Clear the active pointer before releasing capture: lostpointercapture must not erase the ink.
    cancelDrawing();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (completed.length > 1) setStrokes((existing) => [...existing.slice(-31), completed]);
  }

  function cancelStroke(event: PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current === event.pointerId) cancelDrawing();
  }

  function apply() {
    if (disabled || !canApply || activePointerRef.current !== null) return;
    setSignature({ mode, strokes, name: typedName.trim(), fingerprint });
    setOpen(false);
  }

  const visibleStrokes = draftStroke.length ? [...strokes, draftStroke] : strokes;
  return (
    <section className="os-signature" aria-labelledby="signature-heading">
      <div className="os-signature-heading">
        <div>
          <p className="os-eyebrow">PLAYER SIGNATURE</p>
          <h2 id="signature-heading" className="os-section-title">
            선수 서명
          </h2>
        </div>
        <span className="os-signature-state">{signed ? '서명 완료' : '서명 대기'}</span>
      </div>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="os-signature-preview"
            disabled={disabled}
            aria-label={signed ? '서명 수정' : '직접 쓰기'}
          >
            {signed ? (
              signed.mode === 'draw' ? (
                <svg viewBox="0 0 1000 500" aria-hidden="true">
                  <Ink strokes={signed.strokes} />
                </svg>
              ) : (
                <span className="os-signature-typed">{signed.name}</span>
              )
            ) : (
              <span className="os-signature-invite">
                <b>여기에 사인하세요</b>
                <span>눌러서 서명창 열기 ↗</span>
              </span>
            )}
            <span className="os-signature-baseline" aria-hidden="true">
              SIGN HERE
            </span>
          </button>
        </DialogTrigger>
        <div className="os-signature-caption">
          <span>
            {signed
              ? '서명이 준비됐어요. 계약을 확정해 주세요.'
              : '직접 사인하고, 선수 생활을 시작하세요.'}
          </span>
          <Button variant="ghost" disabled={disabled} onClick={() => openEditor('type')}>
            이름 입력
          </Button>
        </div>
        <DialogContent
          className="os-signature-dialog"
          title="계약서에 사인하기"
          description="당신의 이름으로 시작하는 새로운 시즌."
          closeLabel="서명창 닫기"
        >
          <div className="os-signature-editor" data-swipe-ignore>
            <div className="os-signature-tabs" role="group" aria-label="서명 방법">
              <Button
                aria-pressed={mode === 'draw'}
                variant={mode === 'draw' ? 'primary' : 'secondary'}
                disabled={disabled}
                onClick={() => {
                  cancelDrawing();
                  setMode('draw');
                }}
              >
                직접 쓰기
              </Button>
              <Button
                aria-pressed={mode === 'type'}
                variant={mode === 'type' ? 'primary' : 'secondary'}
                disabled={disabled}
                onClick={() => {
                  cancelDrawing();
                  setMode('type');
                }}
              >
                이름 입력
              </Button>
            </div>
            {mode === 'draw' ? (
              <div
                className="os-signature-pad"
                role="img"
                aria-label="서명 입력란"
                data-disabled={disabled}
                onPointerDown={startStroke}
                onPointerMove={continueStroke}
                onPointerUp={finishStroke}
                onPointerCancel={cancelStroke}
                onLostPointerCapture={cancelStroke}
              >
                <svg viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
                  <path className="os-signature-line" d="M 45 395 H 955" />
                  <Ink strokes={visibleStrokes} />
                </svg>
                {!visibleStrokes.length && (
                  <span className="os-signature-placeholder">자유롭게 사인해 주세요</span>
                )}
              </div>
            ) : (
              <label className="os-signature-name">
                <span>서명할 이름</span>
                <input
                  value={typedName}
                  disabled={disabled}
                  onChange={(event) => setTypedName(event.target.value)}
                  autoComplete="off"
                />
              </label>
            )}
            <div className="os-signature-tools">
              <p>
                {mode === 'draw'
                  ? '손가락이나 마우스로 쓰세요.'
                  : '입력한 이름이 서명으로 남습니다.'}
              </p>
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() => {
                  cancelDrawing();
                  setStrokes([]);
                  setTypedName('');
                }}
              >
                다시 쓰기
              </Button>
            </div>
            <Button
              className="os-signature-apply"
              disabled={disabled || !canApply || draftStroke.length > 0}
              onClick={apply}
            >
              서명 적용
            </Button>
            <p className="os-signature-note">
              게임 속 계약 서명입니다. 계약은 다음 화면에서 확정해요.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
