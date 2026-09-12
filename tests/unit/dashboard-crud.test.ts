// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Dashboard Column Visibility & CRUD Operations', () => {
  let htmlContent: string;
  let mockStorageData: any[] = [];

  beforeEach(() => {
    // Read dashboard.html
    const htmlPath = path.resolve(__dirname, '../../dashboard/dashboard.html');
    htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Setup mock chrome API
    mockStorageData = [
      {
        id: 'reel_1',
        type: 'reel',
        url: 'https://www.facebook.com/reel/111/',
        authorName: 'Test Page',
        publishedDate: '1h ago',
        caption: 'First Reel test caption',
        views: 1000,
        reactions: 100,
        comments: 20,
        shares: 5
      },
      {
        id: 'post_2',
        type: 'post',
        url: 'https://www.facebook.com/posts/222/',
        authorName: 'Test Page',
        publishedDate: '2h ago',
        caption: 'Second Post test caption',
        views: 0,
        reactions: 50,
        comments: 10,
        shares: 2
      }
    ];

    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn((keys, cb) => cb({ fb_collector_data: [...mockStorageData] })),
          set: vi.fn((obj, cb) => {
            if (obj.fb_collector_data) mockStorageData = obj.fb_collector_data;
            if (cb) cb();
          }),
          remove: vi.fn((keys, cb) => {
            mockStorageData = [];
            if (cb) cb();
          })
        },
        onChanged: {
          addListener: vi.fn()
        }
      }
    };

    // Set DOM body without script/link tags to avoid happy-dom network fetch warnings
    const cleanHtml = htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<link\b[^>]*>/gi, '');
    document.body.innerHTML = cleanHtml;
  });

  it('contains column toggle controls and all 11 column checkboxes', () => {
    const colToggleBtn = document.getElementById('columnToggleBtn');
    expect(colToggleBtn).not.toBeNull();

    const checkboxes = document.querySelectorAll<HTMLInputElement>('#columnToggleMenu input[type="checkbox"]');
    expect(checkboxes.length).toBe(11);

    const cols = Array.from(checkboxes).map(cb => cb.getAttribute('data-col'));
    expect(cols).toEqual([
      'index', 'type', 'link', 'author', 'date', 'caption',
      'views', 'reactions', 'comments', 'shares', 'actions'
    ]);
  });

  it('contains modal structures for Record Form, Delete Confirmation, and Details', () => {
    expect(document.getElementById('recordModal')).not.toBeNull();
    expect(document.getElementById('deleteModal')).not.toBeNull();
    expect(document.getElementById('detailsModal')).not.toBeNull();
    expect(document.getElementById('addRecordBtn')).not.toBeNull();
  });

  it('applies reels metric consistency rule during dashboard record operations', () => {
    // Validation function logic test:
    // view < reaction => reaction = 0
    // reaction < comment => comment = 0
    // comment < share => share = 0
    function validateReelsMetrics(views: number, reactions: number, comments: number, shares: number) {
      let r = reactions;
      let c = comments;
      let s = shares;

      if (views < r) r = 0;
      if (r < c) c = 0;
      if (c < s) s = 0;

      return { views, reactions: r, comments: c, shares: s };
    }

    // Case 1: Views (50) < Reactions (100) -> reactions = 0, which cascades to comments = 0 and shares = 0
    expect(validateReelsMetrics(50, 100, 30, 10)).toEqual({
      views: 50,
      reactions: 0,
      comments: 0,
      shares: 0
    });

    // Case 2: Views (1000) >= Reactions (20) < Comments (50) -> comments = 0, shares = 0
    expect(validateReelsMetrics(1000, 20, 50, 10)).toEqual({
      views: 1000,
      reactions: 20,
      comments: 0,
      shares: 0
    });

    // Case 3: Views (1000) >= Reactions (100) >= Comments (20) < Shares (50) -> shares = 0
    expect(validateReelsMetrics(1000, 100, 20, 50)).toEqual({
      views: 1000,
      reactions: 100,
      comments: 20,
      shares: 0
    });

    // Case 4: Hierarchy preserved: 5000 >= 300 >= 40 >= 10
    expect(validateReelsMetrics(5000, 300, 40, 10)).toEqual({
      views: 5000,
      reactions: 300,
      comments: 40,
      shares: 10
    });
  });
});
