/**
 * Exporter utility for CSV, JSON, and Clipboard.
 * Generates the exact 19-column schema requested by user:
 * Post ID,Post URL or share link,Author Name,Author Handle,Author ID,Author Avatar,
 * Author Verified,Content,Post Type,Media Type,Media URL,Reactions,Comments,Shares,
 * Views,Images,Posted At,Scraped At,Session ID
 *
 * Prepends UTF-8 BOM (\uFEFF) for 100% accurate rendering of Bangla (বাংলা),
 * numbers, and emojis in Microsoft Excel and Google Sheets.
 */

const Exporter = {
  // Session ID generator
  sessionId: 'fb_' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36),

  /**
   * Escape individual values for CSV compliance (RFC 4180)
   */
  escapeCsvField(field) {
    if (field === null || field === undefined) return '""';
    let str = field.toString();
    // Escape internal double quotes with two double quotes
    str = str.replace(/"/g, '""');
    // Wrap with double quotes
    return `"${str}"`;
  },

  /**
   * Clean numeric ID (remove 'reel_' or 'post_' prefix if present)
   */
  cleanId(rawId) {
    if (!rawId) return '';
    return rawId.toString().replace(/^(reel_|post_|video_|photo_)/, '');
  },

  /**
   * Convert array of collected items into CSV formatted string matching the exact expected schema
   */
  buildCsv(items) {
    if (!items || items.length === 0) return '';

    const headers = [
      'Post ID',
      'Post URL or share link',
      'Author Name',
      'Author Handle',
      'Author ID',
      'Author Avatar',
      'Author Verified',
      'Content',
      'Post Type',
      'Media Type',
      'Media URL',
      'Reactions',
      'Comments',
      'Shares',
      'Views',
      'Images',
      'Posted At',
      'Scraped At',
      'Session ID'
    ];

    const rows = [headers.join(',')];

    items.forEach(item => {
      const cleanId = this.cleanId(item.id || item.postId);
      const postUrl = item.url || item.postUrl || '';
      const authorName = item.authorName || 'Facebook Page';
      const authorHandle = item.authorHandle || '';
      const authorId = item.authorId || '';
      const authorAvatar = item.authorAvatar || '';
      const authorVerified = item.authorVerified ? 'Yes' : 'No';
      const content = item.caption || item.content || '';
      const postType = item.postType || (item.type === 'reel' ? 'video' : 'post');
      const mediaType = item.mediaType || (item.type === 'reel' ? 'video' : 'image');
      const mediaUrl = item.mediaUrl || item.thumbnail || '';
      const reactions = parseInt(item.reactions, 10) || 0;
      const comments = parseInt(item.comments, 10) || 0;
      let shares = parseInt(item.shares, 10) || 0;
      if (shares > comments) {
        shares = 0;
      }
      const views = parseInt(item.views, 10) || 0;
      const images = item.images || item.mediaUrl || item.thumbnail || '';
      const postedAt = item.publishedDate || item.postedAt || 'Recent';
      const scrapedAt = item.scrapedAt || new Date().toLocaleString();
      const sessionId = item.sessionId || this.sessionId;

      const row = [
        this.escapeCsvField(cleanId),
        this.escapeCsvField(postUrl),
        this.escapeCsvField(authorName),
        this.escapeCsvField(authorHandle),
        this.escapeCsvField(authorId),
        this.escapeCsvField(authorAvatar),
        this.escapeCsvField(authorVerified),
        this.escapeCsvField(content),
        this.escapeCsvField(postType),
        this.escapeCsvField(mediaType),
        this.escapeCsvField(mediaUrl),
        reactions,
        comments,
        shares,
        views,
        this.escapeCsvField(images),
        this.escapeCsvField(postedAt),
        this.escapeCsvField(scrapedAt),
        this.escapeCsvField(sessionId)
      ];

      rows.push(row.join(','));
    });

    // Prepend UTF-8 BOM (\uFEFF) so Excel reads Bangla & emojis seamlessly
    return '\uFEFF' + rows.join('\r\n');
  },

  /**
   * Triggers download of CSV file
   */
  downloadCsv(items, filename = 'Reels_Data.csv') {
    const csvContent = this.buildCsv(items);
    if (!csvContent) return false;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this.triggerDownload(blob, filename);
    return true;
  },

  /**
   * Triggers download of JSON file
   */
  downloadJson(items, filename = 'Reels_Data.json') {
    if (!items || items.length === 0) return false;

    const jsonString = JSON.stringify(items, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    this.triggerDownload(blob, filename);
    return true;
  },

  /**
   * Generic file download helper using anchor element
   */
  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /**
   * Copies TSV to clipboard
   */
  async copyToClipboard(items) {
    if (!items || items.length === 0) return false;

    const headers = [
      'Post ID', 'Post URL', 'Author', 'Content', 'Reactions', 'Comments', 'Shares', 'Views', 'Posted At'
    ];
    const lines = [headers.join('\t')];

    items.forEach(item => {
      const c = parseInt(item.comments, 10) || 0;
      let s = parseInt(item.shares, 10) || 0;
      if (s > c) {
        s = 0;
      }
      const line = [
        this.cleanId(item.id),
        item.url || '',
        item.authorName || '',
        (item.caption || item.content || '').replace(/[\r\n\t]+/g, ' '),
        item.reactions || 0,
        c,
        s,
        item.views || 0,
        item.publishedDate || item.postedAt || ''
      ];
      lines.push(line.join('\t'));
    });

    const textToCopy = lines.join('\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        return true;
      }
    } catch (err) {
      console.warn('Clipboard API error, trying fallback', err);
    }

    const textarea = document.createElement('textarea');
    textarea.value = textToCopy;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Exporter;
}
