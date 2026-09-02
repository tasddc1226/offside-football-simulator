import type { HTMLAttributes } from 'react';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  const classes = ['animate-pulse rounded-os-s bg-os-surface-2', className].filter(Boolean).join(' ');

  return <div aria-hidden="true" className={classes} {...props} />;
}
