// Bump when replacing shared artwork so browsers and social crawlers see new URLs.
export const BRAND_ASSET_VERSION = "btl-2026-3";
export const brandAsset = (path: string) => `${path}?v=${BRAND_ASSET_VERSION}`;
