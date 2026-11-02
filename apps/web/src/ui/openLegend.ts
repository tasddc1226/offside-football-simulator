/** Home lists need the click handler, not retirement-detail construction during startup.
 * Preserve the asynchronous result/error contract of the existing public open functions. */
export const openPublicLegend: (typeof import('./legend.js'))['openPublicLegend'] = async (
  ...args
) => (await import('./legend.js')).openPublicLegend(...args);
export const openPublicLegendById: (typeof import('./legend.js'))['openPublicLegendById'] = async (
  ...args
) => (await import('./legend.js')).openPublicLegendById(...args);
