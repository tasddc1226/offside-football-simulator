import { describe, it, expect } from 'vitest';
import { CAMPAIGNS } from '@offside/contracts/acquisition';
import { appStoreCampaignUrl, playStoreCampaignUrl } from './app-store-campaign.js';
import { IOS_APP_STORE_URL, PLAY_STORE_URL } from './links.js';
describe('App Store campaign links', () => {
  it('fails closed without a configured numeric provider token', () => {
    for (const token of [undefined, '', 'team-secret', '123&email=private'])
      expect(
        appStoreCampaignUrl(
          'https://offside.invalid/?utm_source=meta&utm_campaign=global_test',
          token,
        ),
      ).toBe(IOS_APP_STORE_URL);
  });
  it('only forwards allowlisted campaign dimensions, never identifiers', () => {
    const url = new URL(
      appStoreCampaignUrl(
        'https://offside.invalid/?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_a&fbclid=PRIVATE&email=PRIVATE#PRIVATE',
        '123456',
      ),
    );
    expect(url.searchParams.get('pt')).toBe('123456');
    expect(url.href).not.toContain('PRIVATE');
    expect(url.searchParams.size).toBe(3);
    expect(url.searchParams.get('ct')).toBeTruthy();
  });
  it('keeps every Apple campaign token within its 30-character limit', () => {
    for (const source of CAMPAIGNS.utm_source!)
      for (const campaign of CAMPAIGNS.utm_campaign!)
        for (const content of CAMPAIGNS.utm_content!) {
          const url = new URL(
            appStoreCampaignUrl(
              `https://offside.invalid/?utm_source=${source}&utm_medium=social&utm_campaign=${campaign}&utm_content=${content}`,
              '123456',
            ),
          );
          expect(url.searchParams.get('ct')!.length).toBeLessThanOrEqual(30);
        }
  });
});
describe('Google Play campaign links', () => {
  it('forwards only allowlisted UTM values as the install referrer', () => {
    const url = new URL(
      playStoreCampaignUrl(
        'https://offside.invalid/?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_b&fbclid=PRIVATE&email=PRIVATE',
      ),
    );
    expect(url.searchParams.get('id')).toBe('com.offsidelab.app');
    expect(url.searchParams.get('referrer')).toBe(
      'utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_b',
    );
    expect(url.href).not.toContain('PRIVATE');
  });
  it('falls back to the plain listing without a source and campaign', () => {
    for (const href of [
      'https://offside.invalid/',
      'https://offside.invalid/?utm_source=meta',
      'https://offside.invalid/?utm_source=evil&utm_campaign=global_test',
    ])
      expect(playStoreCampaignUrl(href)).toBe(PLAY_STORE_URL);
  });
});
