import type { Plugin } from 'vite';

export interface SeoConfig {
  origin?: string;
  indexingEnabled: boolean;
}

export function resolveSeoConfig(input: {
  mode: string;
  publicSiteUrl?: string;
  enableSearchIndexing?: string;
}): SeoConfig;
export function seoPlugin(config: SeoConfig): Plugin;
