const env = import.meta.env;
export const id = String(env.VITE_GA4_MEASUREMENT_ID ?? '');
export const hostname = String(env.VITE_GA4_HOSTNAME ?? '');
export const prodId = 'G-BZPYZFDE9M';
export function enabled(): boolean {
  if (typeof window === 'undefined') return false;
  // No wildcard hosts and no production data from a test host, even with a misconfigured build.
  return (
    /^G-[A-Z0-9]+$/.test(id) &&
    hostname !== '' &&
    window.location.hostname === hostname &&
    (id === prodId ? hostname === 'offside-lab.com' : hostname !== 'offside-lab.com')
  );
}
