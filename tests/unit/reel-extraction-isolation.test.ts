// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { CaptionParser } from '../../src/content/parsers/caption-parser';
import { ShareParser } from '../../src/content/parsers/share-parser';

describe('CaptionParser Isolation and Cleaning', () => {
  it('cleans trailing button phrases and unicode horizontal ellipsis', () => {
    const raw1 = 'ছোটবেলার স্বাস্থ্যকর অভ্যাসই গড়ে তোলে সুস্থ ও সুন্দর ভবিষ্যৎ—সুস্থ জীবন শুরু হোক ছোট... Show more';
    expect(CaptionParser.cleanText(raw1)).toBe('ছোটবেলার স্বাস্থ্যকর অভ্যাসই গড়ে তোলে সুস্থ ও সুন্দর ভবিষ্যৎ—সুস্থ জীবন শুরু হোক ছোট');

    const raw2 = 'ছোটবেলার স্বাস্থ্যকর অভ্যাসই গড়ে তোলে সুস্থ ও সুন্দর ভবিষ্যৎ—সুস্থ জীবন শুরু হোক ছোট… Show more';
    expect(CaptionParser.cleanText(raw2)).toBe('ছোটবেলার স্বাস্থ্যকর অভ্যাসই গড়ে তোলে সুস্থ ও সুন্দর ভবিষ্যৎ—সুস্থ জীবন শুরু হোক ছোট');

    const raw3 = 'Caption text here … See more Show less';
    expect(CaptionParser.cleanText(raw3)).toBe('Caption text here');

    const raw4 = 'Bengali caption … আরও দেখুন';
    expect(CaptionParser.cleanText(raw4)).toBe('Bengali caption');
  });

  it('ignores docked chat messages and picks authentic caption', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div id="reel-player" role="dialog">
        <video></video>
        <div class="overlay">
          <a role="link" href="/pedagoacademy/">Pedago Academy</a>
          <div dir="auto">
            <span>ছোটবেলার স্বাস্থ্যকর অভ্যাসই গড়ে তোলে সুস্থ ও সুন্দর ভবিষ্যৎ</span>
            <span role="button">Show more</span>
          </div>
        </div>
      </div>
      <div role="region" aria-label="Chats" class="docked-chat">
        <div dir="auto">Assalamu alaikumAsif Tanvir , thanks for your interest. Hope you are well.</div>
      </div>
    `;

    const reelContainer = wrapper.querySelector('#reel-player')!;
    const extracted = CaptionParser.extractCaption(reelContainer, null, 'Pedago Academy');
    expect(extracted).toBe('ছোটবেলার স্বাস্থ্যকর অভ্যাসই গড়ে তোলে সুস্থ ও সুন্দর ভবিষ্যৎ');
    expect(extracted).not.toContain('Assalamu alaikum');
  });
});

describe('ShareParser Isolation', () => {
  it('returns 0 when reel has share button without count, and does not leak outside recommendations', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div id="reel-container">
        <div role="toolbar">
          <div role="button" aria-label="Like"><span>15</span></div>
          <div role="button" aria-label="Comment"><span>3</span></div>
          <div role="button" aria-label="Share"><span>Share</span></div>
        </div>
      </div>
      <div id="recommendations">
        <div role="button" aria-label="Share"><span>84K</span></div>
        <div role="button" aria-label="Share"><span>19K</span></div>
      </div>
    `;

    const reelContainer = wrapper.querySelector('#reel-container')!;
    const shareCount = ShareParser.parse(reelContainer);
    expect(shareCount).toBe(0);
    expect(shareCount).not.toBe(84000);
    expect(shareCount).not.toBe(19000);
  });

  it('detects share count when count span is in a sibling wrapper 2 levels up (Facebook Reels player DOM)', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div id="reel-container" role="dialog">
        <div role="toolbar">
          <div class="action-item-like">
            <div role="button" aria-label="Like, 120 people reacted"></div>
            <span>120</span>
          </div>
          <div class="action-item-comment">
            <div role="button" aria-label="Comment, 15 comments"></div>
            <span>15</span>
          </div>
          <div class="action-item-share">
            <div class="btn-wrapper">
              <div role="button" aria-label="Send this to friends or post it on your profile." tabindex="0">
                <svg></svg>
              </div>
            </div>
            <div class="count-wrapper">
              <span class="x193iq5w">52</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const reelContainer = wrapper.querySelector('#reel-container')!;
    const shareCount = ShareParser.parse(reelContainer);
    expect(shareCount).toBe(52);
  });

  it('detects compact numbers like 1.2K and Bengali numbers like ৪২টি শেয়ার', () => {
    const wrapper1 = document.createElement('div');
    wrapper1.innerHTML = `
      <div id="reel-container" role="dialog">
        <div class="share-box">
          <div role="button" aria-label="Send this to friends or post it on your profile."></div>
          <span>1.2K</span>
        </div>
      </div>
    `;
    expect(ShareParser.parse(wrapper1.querySelector('#reel-container')!)).toBe(1200);

    const wrapper2 = document.createElement('div');
    wrapper2.innerHTML = `
      <div id="reel-container" role="dialog">
        <div class="share-box">
          <div role="button" aria-label="Send this to friends or post it on your profile."></div>
          <span>৪২টি শেয়ার</span>
        </div>
      </div>
    `;
    expect(ShareParser.parse(wrapper2.querySelector('#reel-container')!)).toBe(42);
  });
});

describe('ReelsExtractor DOM Extraction', () => {
  it('extracts reactions, comments, and shares accurately from Facebook Reels player layout', async () => {
    // @ts-ignore
    await import('../../utils/parser.js');
    // @ts-ignore
    await import('../../content/extractor-reels.js');
    const ReelsExtractor = (globalThis as any).ReelsExtractor;

    ReelsExtractor.gridViewsMap.set('123456789', 5000);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `
      <video src="https://video.mp4"></video>
      <a role="link" href="https://www.facebook.com/pedagoacademy/">Pedago Academy</a>
      <div dir="auto">Sample reel caption text here</div>
      <div role="toolbar">
        <div class="action-col-like">
          <div role="button" aria-label="Like, 450 reactions"></div>
          <span>450</span>
        </div>
        <div class="action-col-comment">
          <div role="button" aria-label="Comment, 32 comments"></div>
          <span>32</span>
        </div>
        <div class="action-col-share">
          <div class="btn-wrap">
            <div role="button" aria-label="Send this to friends or post it on your profile." tabindex="0">
              <svg aria-hidden="true"></svg>
            </div>
          </div>
          <div class="count-wrap">
            <span>74</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    try {
      const metrics = ReelsExtractor.extractPlayerMetrics('123456789', dialog);
      expect(metrics.reactions).toBe(450);
      expect(metrics.comments).toBe(32);
      expect(metrics.shares).toBe(74);

      // When recording data: since share (74) > comment (32), share becomes 0!
      const result = ReelsExtractor.scrapeActivePlayer('123456789', 'https://www.facebook.com/reel/123456789/');
      expect(result.views).toBe(5000);
      expect(result.reactions).toBe(450);
      expect(result.comments).toBe(32);
      expect(result.shares).toBe(0);
    } finally {
      document.body.removeChild(dialog);
    }
  });

  it('preserves share count when share <= comment', async () => {
    // @ts-ignore
    await import('../../utils/parser.js');
    // @ts-ignore
    await import('../../content/extractor-reels.js');
    const ReelsExtractor = (globalThis as any).ReelsExtractor;

    ReelsExtractor.gridViewsMap.set('112233', 2000);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `
      <video src="https://video.mp4"></video>
      <div role="toolbar">
        <div class="action-col-like">
          <div role="button" aria-label="Like, 100 reactions"></div>
          <span>100</span>
        </div>
        <div class="action-col-comment">
          <div role="button" aria-label="Comment, 80 comments"></div>
          <span>80</span>
        </div>
        <div class="action-col-share">
          <div class="btn-wrap">
            <div role="button" aria-label="Send this to friends or post it on your profile." tabindex="0">
              <svg></svg>
            </div>
          </div>
          <div class="count-wrap">
            <span>25</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    try {
      const result = ReelsExtractor.scrapeActivePlayer('112233', 'https://www.facebook.com/reel/112233/');
      expect(result.views).toBe(2000);
      expect(result.reactions).toBe(100);
      expect(result.comments).toBe(80);
      expect(result.shares).toBe(25); // 25 <= 80, preserved!
    } finally {
      document.body.removeChild(dialog);
    }
  });

  it('correctly marks share count as 0 when no shares exist (shows Share label without number)', async () => {
    // @ts-ignore
    await import('../../utils/parser.js');
    // @ts-ignore
    await import('../../content/extractor-reels.js');
    const ReelsExtractor = (globalThis as any).ReelsExtractor;

    ReelsExtractor.gridViewsMap.set('987654321', 1000);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `
      <video src="https://video.mp4"></video>
      <div role="toolbar">
        <div class="action-col-like">
          <div role="button" aria-label="Like"></div>
          <span>10</span>
        </div>
        <div class="action-col-comment">
          <div role="button" aria-label="Comment"></div>
          <span>2</span>
        </div>
        <div class="action-col-share">
          <div class="btn-wrap">
            <div role="button" aria-label="Send this to friends or post it on your profile." tabindex="0">
              <svg></svg>
            </div>
          </div>
          <div class="count-wrap">
            <span>Share</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    try {
      const metrics = ReelsExtractor.extractPlayerMetrics('987654321', dialog);
      expect(metrics.reactions).toBe(10);
      expect(metrics.comments).toBe(2);
      expect(metrics.shares).toBe(0);
    } finally {
      document.body.removeChild(dialog);
    }
  });

  it('enforces view < reaction => reaction = 0 and cascades to comment and share', async () => {
    // @ts-ignore
    await import('../../utils/parser.js');
    // @ts-ignore
    await import('../../content/extractor-reels.js');
    const ReelsExtractor = (globalThis as any).ReelsExtractor;

    // Set view to 50, but reactions is 100 in DOM
    ReelsExtractor.gridViewsMap.set('reel_cascade', 50);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `
      <video src="https://video.mp4"></video>
      <div role="toolbar">
        <div class="action-col-like">
          <div role="button" aria-label="Like"><span>100</span></div>
        </div>
        <div class="action-col-comment">
          <div role="button" aria-label="Comment"><span>30</span></div>
        </div>
        <div class="action-col-share">
          <div class="action-col-share-btn" role="button" aria-label="Share"></div>
          <span>10</span>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    try {
      const result = ReelsExtractor.scrapeActivePlayer('reel_cascade', 'https://www.facebook.com/reel/reel_cascade/');
      expect(result.views).toBe(50);
      // view (50) < reaction (100) => reaction becomes 0
      expect(result.reactions).toBe(0);
      // reaction (0) < comment (30) => comment becomes 0
      expect(result.comments).toBe(0);
      // comment (0) < share (10) => share becomes 0
      expect(result.shares).toBe(0);
    } finally {
      document.body.removeChild(dialog);
    }
  });

  it('enforces reaction < comment => comment = 0 and cascades to share', async () => {
    // @ts-ignore
    await import('../../utils/parser.js');
    // @ts-ignore
    await import('../../content/extractor-reels.js');
    const ReelsExtractor = (globalThis as any).ReelsExtractor;

    // Views is high (1000), but reactions is 20 and comments is 50
    ReelsExtractor.gridViewsMap.set('reel_comm_test', 1000);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `
      <video src="https://video.mp4"></video>
      <div role="toolbar">
        <div class="action-col-like">
          <div role="button" aria-label="Like"><span>20</span></div>
        </div>
        <div class="action-col-comment">
          <div role="button" aria-label="Comment"><span>50</span></div>
        </div>
        <div class="action-col-share">
          <div role="button" aria-label="Share"></div>
          <span>15</span>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    try {
      const result = ReelsExtractor.scrapeActivePlayer('reel_comm_test', 'https://www.facebook.com/reel/reel_comm_test/');
      expect(result.views).toBe(1000);
      expect(result.reactions).toBe(20);
      // reaction (20) < comment (50) => comment becomes 0
      expect(result.comments).toBe(0);
      // comment (0) < share (15) => share becomes 0
      expect(result.shares).toBe(0);
    } finally {
      document.body.removeChild(dialog);
    }
  });

  it('enforces comment < share => share = 0 when view >= reaction >= comment', async () => {
    // @ts-ignore
    await import('../../utils/parser.js');
    // @ts-ignore
    await import('../../content/extractor-reels.js');
    const ReelsExtractor = (globalThis as any).ReelsExtractor;

    ReelsExtractor.gridViewsMap.set('reel_share_test', 5000);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `
      <video src="https://video.mp4"></video>
      <div role="toolbar">
        <div class="action-col-like">
          <div role="button" aria-label="Like"><span>300</span></div>
        </div>
        <div class="action-col-comment">
          <div role="button" aria-label="Comment"><span>40</span></div>
        </div>
        <div class="action-col-share">
          <div role="button" aria-label="Share"></div>
          <span>90</span>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    try {
      const result = ReelsExtractor.scrapeActivePlayer('reel_share_test', 'https://www.facebook.com/reel/reel_share_test/');
      expect(result.views).toBe(5000);
      expect(result.reactions).toBe(300);
      expect(result.comments).toBe(40);
      // comment (40) < share (90) => share becomes 0
      expect(result.shares).toBe(0);
    } finally {
      document.body.removeChild(dialog);
    }
  });
});
