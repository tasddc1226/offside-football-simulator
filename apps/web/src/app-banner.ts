import { appStoreCampaignUrl } from '@offside/app-core/app-store-campaign';
/** Must run in the worker before HTML reaches Safari; changing this meta after mount is too late. */
export async function withCampaignBanner(
  response: Response,
  url: URL,
  providerToken?: string,
): Promise<Response> {
  if (
    !['/', '/settings', '/settings/'].includes(url.pathname) ||
    !response.ok ||
    !response.headers.get('Content-Type')?.startsWith('text/html')
  )
    return response;
  const campaign = new URL(appStoreCampaignUrl(url.href, providerToken));
  if (!campaign.searchParams.has('pt')) return response;
  const original = response.clone();
  try {
    const html = await response.text();
    const affiliate =
      `pt=${campaign.searchParams.get('pt')}&ct=${campaign.searchParams.get('ct')}&mt=8`.replaceAll(
        '&',
        '&amp;',
      );
    const output = html.replace(
      /<meta\s+name="apple-itunes-app"\s+content="[^"]*"\s*\/?>/,
      () =>
        `<meta name="apple-itunes-app" content="app-id=6817463687, affiliate-data=${affiliate}" />`,
    );
    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    headers.delete('ETag');
    headers.delete('Content-Encoding');
    // Never let campaign-specific HTML contaminate a shared asset/edge cache.
    headers.set('Cache-Control', 'private, no-store');
    return new Response(output, { status: response.status, headers });
  } catch {
    return original;
  }
}
