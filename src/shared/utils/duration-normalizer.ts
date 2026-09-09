/**
 * Parses video duration strings (e.g. "0:37", "1:05", "10:42", "1:01:05") into total seconds.
 */
export function parseDurationToSeconds(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const str = raw.trim();
  if (!str || str === 'N/A' || str === 'Unavailable') return null;

  // Check if string is already numeric seconds
  if (/^\d+$/.test(str)) {
    const s = parseInt(str, 10);
    return isNaN(s) ? null : s;
  }

  // Natural language format: e.g. "1 hr 20 min", "3 min 5 sec", "45 sec"
  const hrMatch = str.match(/(\d+)\s*(?:h|hr|hrs|hours?)/i);
  const minMatch = str.match(/(\d+)\s*(?:m|min|mins|minutes?)/i);
  const secMatch = str.match(/(\d+)\s*(?:s|sec|secs|seconds?)/i);

  if (hrMatch || minMatch || secMatch) {
    const hrs = hrMatch ? parseInt(hrMatch[1], 10) : 0;
    const mins = minMatch ? parseInt(minMatch[1], 10) : 0;
    const secs = secMatch ? parseInt(secMatch[1], 10) : 0;
    return hrs * 3600 + mins * 60 + secs;
  }

  // Match time formats like "0:37", "1:05", "1:01:05"
  const match = str.match(/(?:(\d+):)?(\d+):(\d+)/);
  if (!match) return null;

  if (match[1] !== undefined) {
    // hrs:mins:secs
    const hrs = parseInt(match[1], 10) || 0;
    const mins = parseInt(match[2] || '0', 10) || 0;
    const secs = parseInt(match[3] || '0', 10) || 0;
    return hrs * 3600 + mins * 60 + secs;
  } else {
    // mins:secs
    const mins = parseInt(match[2] || '0', 10) || 0;
    const secs = parseInt(match[3] || '0', 10) || 0;
    return mins * 60 + secs;
  }
}

/**
 * Formats duration seconds into readable style:
 * e.g., 45 -> "45 sec", 185 -> "3 min 5 sec", 1843 -> "30 min 43 sec", 3665 -> "1 hr 1 min 5 sec"
 */
export function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) return null;
  const totalSecs = Math.round(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hrs > 0) {
    const parts = [`${hrs} hr`];
    if (mins > 0) parts.push(`${mins} min`);
    if (secs > 0) parts.push(`${secs} sec`);
    return parts.join(' ');
  }

  if (mins > 0) {
    if (secs > 0) {
      return `${mins} min ${secs} sec`;
    }
    return `${mins} min`;
  }

  return `${secs} sec`;
}
