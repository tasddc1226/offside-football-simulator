import type { HTMLAttributes } from 'react';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  const classes = ['os-panel', className].filter(Boolean).join(' ');

  return <div className={classes} {...props} />;
}
