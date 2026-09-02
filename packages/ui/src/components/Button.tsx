import type { ButtonHTMLAttributes, CSSProperties } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-os-accent text-os-on-accent',
  secondary: 'border border-os-border bg-os-surface text-os-text',
  ghost: 'bg-transparent text-os-text',
};

const BASE_CLASS =
  'inline-flex items-center justify-center gap-os-2 rounded-os-m px-os-4 font-os font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-os-focus';

export const buttonStyle: CSSProperties = {
  fontSize: 'var(--os-fs-body)',
  lineHeight: 'var(--os-lh-body)',
  minHeight: 'var(--os-touch-min)',
  minWidth: 'var(--os-touch-min)',
};

/**
 * Button과 같은 시각 스타일을 다른 요소(예: 라우터 Link)에 입힐 때 쓴다.
 * `<a><button>…</button></a>` 같은 상호작용 요소 중첩(HTML 콘텐츠 모델 위반)을 피하기 위함이다.
 */
export function buttonClassName(variant: ButtonVariant = 'primary', className?: string): string {
  return [BASE_CLASS, VARIANT_CLASS[variant], className].filter(Boolean).join(' ');
}

export function Button({ variant = 'primary', className, style, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, className)}
      style={{ ...buttonStyle, ...style }}
      {...props}
    />
  );
}
