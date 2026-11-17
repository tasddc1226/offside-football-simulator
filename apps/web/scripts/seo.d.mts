import type { Plugin } from 'vite';

export interface SeoConfig {
  origin?: string;
  indexingEnabled: boolean;
  /** 소개 페이지 Meta 픽셀(ID · 운영 호스트). 없으면 싣지 않는다. */
  pixel?: { id: string; host: string };
}

export function resolveSeoConfig(input: {
  mode: string;
  publicSiteUrl?: string;
  enableSearchIndexing?: string;
  metaPixelId?: string;
  analyticsHostname?: string;
}): SeoConfig;
export function seoPlugin(config: SeoConfig): Plugin;
export const BRAND_VERSION: string;
export const STATIC_PAGES: Record<string, string>;
export const CAREER_OG_BANDS: [id: string, label: string, rarity: number][];
export function createHeadMarkup(config: SeoConfig, path?: string, forceNoIndex?: boolean): string;
