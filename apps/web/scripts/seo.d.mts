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
export const BRAND_VERSION: string;
export const CAREER_OG_BANDS: [id: string, label: string, rarity: number][];
export function createHeadMarkup(config: SeoConfig, path?: string, forceNoIndex?: boolean): string;
