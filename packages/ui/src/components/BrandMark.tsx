export interface BrandMarkProps {
  className?: string;
}

/** Approved OFFSIDE flag identity. FootballMark remains available for in-game football semantics. */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <img
      className={['os-brand-mark', className].filter(Boolean).join(' ')}
      src="/brand/offside-flag-v5-64.png"
      width="32"
      height="32"
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  );
}
