const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{6}\b/;

export function extractTopSkyHex(skyGrad: string): string {
  const match = HEX_COLOR_PATTERN.exec(skyGrad);
  if (!match) {
    throw new Error(`Unable to extract 6-digit hex color from skyGrad: "${skyGrad}"`);
  }
  return match[0].toUpperCase();
}

export function buildGoogleMapsUrl(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Google Maps search query cannot be empty.');
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}
