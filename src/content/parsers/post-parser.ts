import { PostContent } from '../../shared/types';
import { PostDetector } from '../detectors/post-detector';
import { MediaDetector } from '../detectors/media-detector';
import { CaptionParser } from './caption-parser';
import { ReactionParser } from './reaction-parser';
import { CommentParser } from './comment-parser';
import { ShareParser } from './share-parser';
import { DateParser } from './date-parser';
import { DurationParser } from './duration-parser';
import { SelectorRegistry } from '../selectors/selector-registry';
import { SELECTORS } from '../selectors/facebook-selectors';

export class PostParser {
  /**
   * Parses an individual post element into a typed PostContent object
   */
  static parse(container: Element, pageName = 'Facebook Page'): PostContent | null {
    const detection = PostDetector.detect(container);
    if (!detection.isMatch || !detection.id) {
      return null;
    }

    const toolbar = SelectorRegistry.queryFirst(container, SELECTORS.post.toolbar);
    const caption = CaptionParser.extractCaption(container, toolbar);
    const { media, format } = MediaDetector.detect(container);
    const dateResult = DateParser.parse(container);

    const reactions = ReactionParser.parse(container);
    const comments = CommentParser.parse(container);
    let shares = ShareParser.parse(container);
    if (shares !== null && comments !== null && shares > comments) {
      shares = 0;
    }

    let durationSeconds: number | null = null;
    let durationFormatted: string | null = null;
    if (format === 'video') {
      const dur = DurationParser.parse(container);
      durationSeconds = dur.durationSeconds;
      durationFormatted = dur.durationFormatted;
    }

    const warnings: string[] = [];
    if (reactions === null) warnings.push('Reactions unexposed or disabled');
    if (shares === null) warnings.push('Shares unexposed');
    if (dateResult.publishedAt === null) warnings.push('Exact timestamp unavailable');

    const totalEngagement =
      reactions !== null || comments !== null || shares !== null
        ? (reactions || 0) + (comments || 0) + (shares || 0)
        : null;

    const dataQualityScore = Math.round(
      ((detection.id ? 20 : 0) +
        (caption ? 20 : 0) +
        (reactions !== null ? 20 : 0) +
        (comments !== null ? 20 : 0) +
        (dateResult.publishedAt ? 20 : 10))
    );

    return {
      id: detection.id,
      platform: 'facebook',
      pageName,
      type: 'post',
      caption,
      url: detection.url,
      publishedAt: dateResult.publishedAt,
      publishedRelative: dateResult.publishedRelative,
      ageHours: dateResult.ageHours,
      scrapedAt: new Date().toISOString(),
      reactions,
      comments,
      shares,
      views: null,
      totalEngagement,
      engagementRate: null,
      viewsPerHour: null,
      engagementPerHour:
        totalEngagement !== null && dateResult.ageHours !== null
          ? Number((totalEngagement / Math.max(dateResult.ageHours, 1)).toFixed(2))
          : null,
      performancePercent: null,
      performanceDirection: 'unknown',
      dataQualityScore,
      extractionStatus: dataQualityScore >= 60 ? 'complete' : 'partial',
      extractionWarnings: warnings,
      rawFingerprint: `${detection.id}_${caption ? caption.slice(0, 30) : ''}`,
      media,
      postFormat: format,
      videoDurationSeconds: durationSeconds,
      videoDurationFormatted: durationFormatted
    };
  }
}
