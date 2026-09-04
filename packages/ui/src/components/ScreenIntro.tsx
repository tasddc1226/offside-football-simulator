import type { ReactNode } from 'react';

/** Original OFFSIDE artwork. No third-party UI-kit assets. */
export function FootballMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 10 5.7 4.2-2.2 6.6h-7l-2.2-6.6L16 10Z" fill="currentColor" />
      <path
        d="M16 3v7M4 12l6.3 2.2M8.3 26.6l4.2-5.8m11.2 5.8-4.2-5.8M28 12l-6.3 2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export interface ScreenIntroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function ScreenIntro({ eyebrow, title, description, children }: ScreenIntroProps) {
  return (
    <header className="os-game-hero">
      <svg
        className="os-pitch-art"
        viewBox="0 0 180 210"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="12" y="12" width="156" height="186" rx="2" />
        <path d="M12 105h156M54 12v32h72V12M54 198v-32h72v32" />
        <circle cx="90" cy="105" r="26" />
        <circle cx="90" cy="105" r="2" fill="currentColor" stroke="none" />
      </svg>
      <div className="os-game-hero-content">
        {eyebrow ? <p className="os-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="os-game-hero-description">{description}</p> : null}
        {children}
      </div>
    </header>
  );
}
