/**
 * Centralized product identity for Rocket.
 *
 * Product-facing code should import these values instead of hard-coding the
 * former Craft Agents identity. The legacy deep-link scheme remains accepted
 * as an inbound compatibility alias, but Rocket only emits the canonical
 * `rocket://` scheme.
 */

export const APP_NAME = 'Rocket';
export const APP_ID = 'com.rocket.research';
export const ROCKET_SERVER_BINARY = 'rocket-server';
export const ROCKET_DEEPLINK_SCHEME = 'rocket';
export const LEGACY_DEEPLINK_SCHEMES = ['craftagents'] as const;

function normalizeScheme(scheme: string): string {
  return scheme.trim().toLowerCase().replace(/:$/, '');
}

/** Return true for the canonical scheme or an explicitly supported alias. */
export function isRocketDeepLinkScheme(
  scheme: string,
  additionalSchemes: readonly string[] = [],
): boolean {
  const normalized = normalizeScheme(scheme);
  return [
    ROCKET_DEEPLINK_SCHEME,
    ...LEGACY_DEEPLINK_SCHEMES,
    ...additionalSchemes,
  ].some((candidate) => normalizeScheme(candidate) === normalized);
}

/** Build a canonical Rocket deep link. */
export function buildRocketDeepLink(route: string): string {
  return `${ROCKET_DEEPLINK_SCHEME}://${route.replace(/^\/+/, '')}`;
}

export const ROCKET_LOGO = [
  '  ████████ █████████    ██████   ██████████ ██████████',
  '██████████ ██████████ ██████████ █████████  ██████████',
  '██████     ██████████ ██████████ ████████   ██████████',
  '██████████ ████████   ██████████ ███████      ██████  ',
  '  ████████ ████  ████ ████  ████ █████        ██████  ',
] as const;

/** Logo as a single string for HTML templates */
export const ROCKET_LOGO_HTML = ROCKET_LOGO.map((line) => line.trimEnd()).join('\n');

/** Session viewer base URL */
export const VIEWER_URL = 'https://agents.rocket.app';
