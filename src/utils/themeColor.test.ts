import { describe, it, expect } from 'vitest';
import { extractTopSkyHex, buildGoogleMapsUrl } from './themeColor';

describe('themeColor utilities', () => {
  it('extracts normalized uppercase leading hex color from CSS linear-gradient', () => {
    expect(extractTopSkyHex('linear-gradient(180deg, #070b19 0%, #131C38 100%)')).toBe('#070B19');
    expect(() => extractTopSkyHex('linear-gradient(180deg, rgb(0,0,0) 0%)')).toThrow(
      /Unable to extract/
    );
  });

  it('builds encoded Google Maps URLs and rejects blank queries', () => {
    expect(buildGoogleMapsUrl('Asahikawa Station')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Asahikawa%20Station'
    );
    expect(() => buildGoogleMapsUrl('   ')).toThrow(/cannot be empty/);
  });
});
