export interface DisplayWordProps {
  /** DSN-BRD-001 브랜드 어휘 폐쇄 목록의 표기(예: KICKOFF). */
  word: string;
  /** DSN-BRD-001: display 토큰 바로 아래 caption 한국어 설명은 필수다. */
  caption: string;
}

export function DisplayWord({ word, caption }: DisplayWordProps) {
  return (
    <div>
      <p
        className="os-num font-os font-bold uppercase text-os-text"
        style={{
          fontSize: 'var(--os-fs-display)',
          lineHeight: 'var(--os-lh-display)',
          letterSpacing: 'var(--os-tracking-display)',
        }}
      >
        {word}
      </p>
      <p
        className="font-os text-os-text-2"
        style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}
      >
        {caption}
      </p>
    </div>
  );
}
