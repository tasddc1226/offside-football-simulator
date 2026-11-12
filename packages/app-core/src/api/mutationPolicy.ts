/** Delivery/read bookkeeping affects its own namespace. Other mutations invalidate all reads. */
export function mutationCacheScope(path: string): string | null {
  const pathname = path.split('?')[0]!;
  if (pathname === '/v1/push/device') return '/v1/push';
  if (/^\/v1\/notifications\/(?:read-all|[^/]+\/(?:read|interaction))$/.test(pathname))
    return '/v1/notifications';
  return null;
}
