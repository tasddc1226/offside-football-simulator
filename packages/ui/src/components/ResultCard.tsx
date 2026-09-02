export type ResultKind = 'SUCCESS' | 'NEUTRAL' | 'FAIL' | 'FIXED';

const KIND_COLOR_CLASS: Record<ResultKind, string> = {
  SUCCESS: 'text-os-success',
  NEUTRAL: 'text-os-neutral',
  FAIL: 'text-os-danger',
  FIXED: 'text-os-text-2',
};

const KIND_ICON: Record<ResultKind, string> = {
  SUCCESS: '✓',
  NEUTRAL: '●',
  FAIL: '!',
  FIXED: '■',
};

export interface ResultCardProps {
  kind: ResultKind;
  /** 결과 등급 문구(예: "성공"). 13-visual-design-system.md DSN-CMP-002. */
  kindLabel: string;
  title: string;
  body: string;
  /** 적용된 효과 목록. */
  effects: string[];
  /** 원인 태그. --os-surface-2 칩으로 표시한다. */
  tags: string[];
}

export function ResultCard({ kind, kindLabel, title, body, effects, tags }: ResultCardProps) {
  return (
    <div className="flex flex-col gap-os-3 rounded-os-m border border-os-border bg-os-surface p-os-4">
      <div className="flex items-center gap-os-2 font-os font-semibold" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
        <span aria-hidden="true" className={KIND_COLOR_CLASS[kind]}>
          {KIND_ICON[kind]}
        </span>
        <span className="text-os-text">{kindLabel}</span>
      </div>

      <h3 className="font-os font-bold text-os-text" style={{ fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' }}>
        {title}
      </h3>

      <p className="font-os text-os-text" style={{ fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' }}>
        {body}
      </p>

      {effects.length > 0 ? (
        <ul className="flex flex-col gap-os-1 font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
          {effects.map((effect) => (
            <li key={effect}>{effect}</li>
          ))}
        </ul>
      ) : null}

      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-os-1">
          {tags.map((tag) => (
            <li
              key={tag}
              className="rounded-os-s bg-os-surface-2 px-os-2 py-os-1 font-os text-os-text-2"
              style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
