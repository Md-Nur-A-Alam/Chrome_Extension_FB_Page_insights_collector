import { describe, it, expect } from 'vitest';
import { cleanFacebookUrl, extractFacebookId } from '../../src/shared/utils/url-normalizer';

describe('URL Normalizer', () => {
  describe('cleanFacebookUrl', () => {
    it('strips tracking query parameters from Reel URLs', () => {
      const dirty = 'https://www.facebook.com/reel/123456789/?mibextid=wwXIfr&__cft__[0]=AZX&fbclid=IwAR123';
      expect(cleanFacebookUrl(dirty)).toBe('https://www.facebook.com/reel/123456789/');
    });

    it('strips tracking parameters from Post URLs', () => {
      const dirty = 'https://www.facebook.com/myPage/posts/pfbid0abcdef123?__cft__[0]=AZX&__tn__=%2CO%2CP-R';
      expect(cleanFacebookUrl(dirty)).toBe('https://www.facebook.com/myPage/posts/pfbid0abcdef123/');
    });

    it('handles relative pathnames correctly', () => {
      expect(cleanFacebookUrl('/reel/987654321/')).toBe('https://www.facebook.com/reel/987654321/');
    });

    it('returns null for empty or null inputs', () => {
      expect(cleanFacebookUrl(null)).toBeNull();
      expect(cleanFacebookUrl(undefined)).toBeNull();
      expect(cleanFacebookUrl('')).toBeNull();
    });
  });

  describe('extractFacebookId', () => {
    it('extracts Reel ID prefixed with reel_', () => {
      expect(extractFacebookId('https://www.facebook.com/reel/123456789/')).toBe('reel_123456789');
    });

    it('extracts Post ID (pfbid) prefixed with post_', () => {
      expect(extractFacebookId('https://www.facebook.com/page/posts/pfbid02abc123/')).toBe('post_pfbid02abc123');
    });

    it('extracts story_fbid from legacy URLs', () => {
      expect(extractFacebookId('https://www.facebook.com/permalink.php?story_fbid=998877&id=1000')).toBe('post_998877');
    });

    it('extracts watch/video ID', () => {
      expect(extractFacebookId('https://www.facebook.com/watch/?v=5544332211')).toBe('video_5544332211');
    });

    it('returns null for unrelated URLs', () => {
      expect(extractFacebookId('https://google.com')).toBeNull();
      expect(extractFacebookId(null)).toBeNull();
    });
  });
});
