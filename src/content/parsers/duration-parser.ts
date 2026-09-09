import { formatVideoDuration, parseDurationToSeconds } from '../../shared/utils/duration-normalizer';

export interface ParsedDurationResult {
  durationSeconds: number | null;
  durationFormatted: string | null;
}

export class DurationParser {
  /**
   * Extracts duration from video elements or player controls
   */
  static parse(container: Element): ParsedDurationResult {
    // 1. HTML5 Video Element
    const video = container.querySelector('video');
    if (video && video.duration && !isNaN(video.duration) && video.duration > 0) {
      const sec = Math.round(video.duration);
      return {
        durationSeconds: sec,
        durationFormatted: formatVideoDuration(sec)
      };
    }

    // 2. Player Progressbar / Seekbar
    const progress = container.querySelector('div[role="progressbar"], div[aria-valuemax]');
    if (progress) {
      const max = parseFloat(progress.getAttribute('aria-valuemax') || '');
      if (!isNaN(max) && max > 0 && max < 7200 && max !== 100) {
        const sec = Math.round(max);
        return {
          durationSeconds: sec,
          durationFormatted: formatVideoDuration(sec)
        };
      }
    }

    // 3. Player time labels (e.g. "0:15 / 3:05")
    const spans = container.querySelectorAll('span, div');
    for (const s of Array.from(spans)) {
      const txt = (s.textContent || '').trim();
      const match = txt.match(/\/\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/);
      if (match && match[1]) {
        const sec = parseDurationToSeconds(match[1]);
        if (sec !== null && sec > 0) {
          return {
            durationSeconds: sec,
            durationFormatted: formatVideoDuration(sec)
          };
        }
      }
    }

    return {
      durationSeconds: null,
      durationFormatted: null
    };
  }
}
