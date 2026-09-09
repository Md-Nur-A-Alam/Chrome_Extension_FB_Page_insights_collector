import { MediaItem, PostFormat } from '../../shared/types';

export class MediaDetector {
  /**
   * Scans a post container and detects attached media (videos, images, links)
   */
  static detect(element: Element): { media: MediaItem[]; format: PostFormat } {
    const media: MediaItem[] = [];

    // 1. Detect Video
    const video = element.querySelector('video');
    if (video) {
      media.push({
        type: 'video',
        url: video.src && video.src.startsWith('http') ? video.src : null,
        thumbnailUrl: video.poster || null
      });
      return { media, format: 'video' };
    }

    // 2. Detect Images
    const images = element.querySelectorAll<HTMLImageElement>('img[src*="scontent"], img[src*="fbcdn"]');
    images.forEach((img) => {
      // Filter out small avatars / reaction emojis
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w > 100 || h > 100 || (!w && !h && img.src.length > 50)) {
        media.push({
          type: 'image',
          url: img.src,
          thumbnailUrl: img.src,
          width: w || null,
          height: h || null
        });
      }
    });

    if (media.length > 1) {
      return { media, format: 'carousel' };
    }
    if (media.length === 1) {
      return { media, format: 'image' };
    }

    // 3. Link preview
    const linkPreview = element.querySelector('a[target="_blank"][rel*="noopener"]');
    if (linkPreview) {
      const href = linkPreview.getAttribute('href');
      if (href && !href.includes('facebook.com')) {
        media.push({
          type: 'link',
          url: href
        });
        return { media, format: 'link' };
      }
    }

    return { media: [], format: 'text' };
  }
}
