import { ReelContent } from '../../shared/types';
import { CaptionParser } from './caption-parser';
import { ReactionParser } from './reaction-parser';
import { CommentParser } from './comment-parser';
import { ShareParser } from './share-parser';
import { ViewParser } from './view-parser';
import { DateParser } from './date-parser';
import { DurationParser } from './duration-parser';
import { ReelDetector } from '../detectors/reel-detector';
import { cleanFacebookUrl, extractFacebookId } from '../../shared/utils/url-normalizer';
import { formatVideoDuration } from '../../shared/utils/duration-normalizer';
import { formatTimeAgo, parseDateToIso, calculateAgeHours } from '../../shared/utils/date-normalizer';

export interface RelayReelData {
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
  videoDurationSeconds: number | null;
  creationTime: number | null;
}

export class ReelParser {
  /**
   * Scans in-page Relay script tags for exact unrounded counts and Unix timestamps
   */
  static extractFromRelayScripts(_reelId?: string): RelayReelData {
    const data: RelayReelData = {
      reactions: null,
      comments: null,
      shares: null,
      views: null,
      videoDurationSeconds: null,
      creationTime: null
    };

    try {
      const scripts = document.querySelectorAll('script[type="application/json"]');
      for (const script of Array.from(scripts)) {
        const content = script.textContent;
        if (!content) continue;
        if (_reelId && !content.includes(_reelId)) {
          continue; // MUST belong to THIS reel to prevent picking up random viral feed items
        }
        if (!content.includes('feedback') && !content.includes('reaction_count') && !content.includes('playable_duration_in_ms')) {
          continue;
        }

        // Reactions
        if (data.reactions === null) {
          const mReact = content.match(/["']reaction_count["']\s*:\s*(?:\{\s*["']count["']\s*:\s*(\d+)|(\d+))/);
          if (mReact) {
            data.reactions = parseInt(mReact[1] || mReact[2] || '0', 10);
          }
        }

        // Comments
        if (data.comments === null) {
          const mComm = content.match(/["'](?:total_comment_count|comment_count|comments)["']\s*:\s*(?:\{\s*["']total_count["']\s*:\s*(\d+)|(\d+))/);
          if (mComm) {
            data.comments = parseInt(mComm[1] || mComm[2] || '0', 10);
          }
        }

        // Shares
        if (data.shares === null) {
          const mShare = content.match(/["'](?:share_count|share_count_num)["']\s*:\s*(?:\{\s*["']count["']\s*:\s*(\d+)|(\d+))/);
          if (mShare) {
            data.shares = parseInt(mShare[1] || mShare[2] || '0', 10);
          }
        }

        // Duration
        if (data.videoDurationSeconds === null) {
          const mDurMs = content.match(/["']playable_duration_in_ms["']\s*:\s*(\d+)/);
          if (mDurMs && mDurMs[1]) {
            data.videoDurationSeconds = Math.round(parseInt(mDurMs[1], 10) / 1000);
          } else {
            const mDurSec = content.match(/["'](?:length_in_second|video_duration)["']\s*:\s*(\d+)/);
            if (mDurSec && mDurSec[1]) {
              data.videoDurationSeconds = parseInt(mDurSec[1], 10);
            }
          }
        }

        // Creation timestamp
        if (data.creationTime === null) {
          const mTime = content.match(/["'](?:creation_time|publish_time|video_publish_date)["']\s*:\s*(\d{9,12})/);
          if (mTime && mTime[1]) {
            data.creationTime = parseInt(mTime[1], 10);
          }
        }

        if (data.reactions !== null && data.comments !== null && data.shares !== null && data.videoDurationSeconds !== null) {
          break;
        }
      }
    } catch {
      // Ignore script extraction errors
    }

    return data;
  }

  /**
   * Parses the active standalone Reel Player modal
   */
  static parseActivePlayer(targetId?: string | null, targetUrl?: string | null, pageName = 'Facebook Page', gridViews: number | null = null): ReelContent {
    const currentUrl = window.location.href;
    const cleanUrl = targetUrl || cleanFacebookUrl(currentUrl);
    let id = extractFacebookId(cleanUrl || currentUrl)?.replace(/^reel_/, '') || targetId || 'reel';

    // Extract Relay Data
    const relay = this.extractFromRelayScripts(id);

    // DOM extraction (what the user legitimately sees on the active reel)
    const domReactions = ReactionParser.parse(document.body);
    const domComments = CommentParser.parse(document.body);
    const domShares = ShareParser.parse(document.body);

    const reactions = domReactions !== null ? domReactions : relay.reactions;
    const comments = domComments !== null ? domComments : relay.comments;
    const shares = domShares !== null ? domShares : relay.shares;
    const views = gridViews !== null ? gridViews : (relay.views !== null ? relay.views : ViewParser.parse(document.body));

    // Duration
    let durationSeconds = relay.videoDurationSeconds;
    if (durationSeconds === null) {
      const dur = DurationParser.parse(document.body);
      durationSeconds = dur.durationSeconds;
    }
    const durationFormatted = durationSeconds !== null ? formatVideoDuration(durationSeconds) : null;

    // Date
    let publishedAt: string | null = null;
    let publishedRelative: string | null = null;
    let ageHours: number | null = null;

    if (relay.creationTime) {
      publishedAt = parseDateToIso(relay.creationTime);
      publishedRelative = formatTimeAgo(relay.creationTime);
      ageHours = calculateAgeHours(publishedAt);
    } else {
      const dateRes = DateParser.parse(document.body);
      publishedAt = dateRes.publishedAt;
      publishedRelative = dateRes.publishedRelative;
      ageHours = dateRes.ageHours;
    }

    // Caption
    const caption = CaptionParser.extractCaption(document.body);

    // Video / Poster
    const video = document.querySelector('video');
    const mediaUrl = video?.src && video.src.startsWith('http') ? video.src : null;
    const thumbnailUrl = video?.poster || null;

    const totalEngagement =
      reactions !== null || comments !== null || shares !== null
        ? (reactions || 0) + (comments || 0) + (shares || 0)
        : null;

    const engagementRate =
      totalEngagement !== null && views !== null && views > 0
        ? Number(((totalEngagement / views) * 100).toFixed(2))
        : null;

    const viewsPerHour =
      views !== null && ageHours !== null
        ? Number((views / Math.max(ageHours, 1)).toFixed(2))
        : null;

    const engagementPerHour =
      totalEngagement !== null && ageHours !== null
        ? Number((totalEngagement / Math.max(ageHours, 1)).toFixed(2))
        : null;

    const warnings: string[] = [];
    if (reactions === null) warnings.push('Reactions unexposed or hidden');
    if (comments === null) warnings.push('Comments unexposed');
    if (shares === null) warnings.push('Shares unexposed');
    if (views === null) warnings.push('View count unavailable');

    const dataQualityScore = Math.round(
      ((id ? 20 : 0) +
        (caption ? 15 : 0) +
        (views !== null ? 25 : 0) +
        (reactions !== null ? 20 : 0) +
        (comments !== null ? 10 : 0) +
        (durationSeconds !== null ? 10 : 0))
    );

    return {
      id,
      platform: 'facebook',
      pageName,
      type: 'reel',
      caption,
      url: cleanUrl,
      publishedAt,
      publishedRelative,
      ageHours,
      scrapedAt: new Date().toISOString(),
      reactions,
      comments,
      shares,
      views,
      totalEngagement,
      engagementRate,
      viewsPerHour,
      engagementPerHour,
      performancePercent: null,
      performanceDirection: 'unknown',
      dataQualityScore,
      extractionStatus: dataQualityScore >= 60 ? 'complete' : 'partial',
      extractionWarnings: warnings,
      rawFingerprint: `${id}_${caption ? caption.slice(0, 30) : ''}`,
      durationSeconds,
      durationFormatted,
      thumbnailUrl,
      mediaUrl
    };
  }

  /**
   * Parses a grid thumbnail card from Facebook Reels tab
   */
  static parseGridCard(card: Element, pageName = 'Facebook Page'): ReelContent | null {
    const detection = ReelDetector.detect(card);
    if (!detection.isMatch || !detection.id || !detection.url) {
      return null;
    }

    const views = ViewParser.parse(card);
    const img = card.querySelector<HTMLImageElement>('img[src]');
    const thumbnailUrl = img?.src || null;

    return {
      id: detection.id,
      platform: 'facebook',
      pageName,
      type: 'reel',
      caption: null,
      url: detection.url,
      publishedAt: null,
      publishedRelative: null,
      ageHours: null,
      scrapedAt: new Date().toISOString(),
      reactions: null,
      comments: null,
      shares: null,
      views,
      totalEngagement: null,
      engagementRate: null,
      viewsPerHour: null,
      engagementPerHour: null,
      performancePercent: null,
      performanceDirection: 'unknown',
      dataQualityScore: views !== null ? 30 : 15,
      extractionStatus: 'partial',
      extractionWarnings: ['Awaiting Phase 2 Player inspection for reactions, comments, duration, and date'],
      rawFingerprint: `${detection.id}_grid`,
      durationSeconds: null,
      durationFormatted: null,
      thumbnailUrl,
      mediaUrl: null
    };
  }
}

