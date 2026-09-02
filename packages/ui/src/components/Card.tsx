import type { HTMLAttributes } from 'react';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  const classes = ['rounded-os-m border border-os-border bg-os-surface p-os-4', className]
    .filter(Boolean)
    .join(' ');

  return <div className={classes} {...props} />;
}
