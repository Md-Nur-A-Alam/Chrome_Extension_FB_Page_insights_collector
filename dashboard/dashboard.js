/**
 * Analytics Dashboard Logic for FB data collector by NUR
 * Handles data visualization, search, filtering, sorting, and export.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const statTotalItems = document.getElementById('statTotalItems');
  const statTypeBreakdown = document.getElementById('statTypeBreakdown');
  const statTotalViews = document.getElementById('statTotalViews');
  const statTotalReactions = document.getElementById('statTotalReactions');
  const statTotalComments = document.getElementById('statTotalComments');
  const statTotalShares = document.getElementById('statTotalShares');

  const searchInput = document.getElementById('searchInput');
  const typeFilter = document.getElementById('typeFilter');
  const sortFilter = document.getElementById('sortFilter');

  const viewTableBtn = document.getElementById('viewTableBtn');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const tableView = document.getElementById('tableView');
  const gridView = document.getElementById('gridView');
  const emptyState = document.getElementById('emptyState');
  const tableBody = document.getElementById('tableBody');

  const refreshBtn = document.getElementById('refreshBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const launchFbBtn = document.getElementById('launchFbBtn');

  let rawItems = [];
  let currentView = 'table'; // 'table' or 'grid'

  // Load data on startup
  loadData();

  // Listen for storage changes in real-time
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.fb_collector_data) {
        rawItems = changes.fb_collector_data.newValue || [];
        renderDashboard();
      }
    });
  }

  // Event Listeners for Filters
  searchInput.addEventListener('input', () => renderDashboard(false));
  typeFilter.addEventListener('change', () => renderDashboard(false));
  sortFilter.addEventListener('change', () => renderDashboard(false));

  // View switchers
  viewTableBtn.addEventListener('click', () => {
    currentView = 'table';
    viewTableBtn.classList.add('active');
    viewGridBtn.classList.remove('active');
    renderPresentation();
  });

  viewGridBtn.addEventListener('click', () => {
    currentView = 'grid';
    viewGridBtn.classList.add('active');
    viewTableBtn.classList.remove('active');
    renderPresentation();
  });

  // Action Buttons
  refreshBtn.addEventListener('click', () => {
    loadData();
    showToast('Data refreshed');
  });

  clearDataBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all collected Facebook records?')) {
      chrome.storage.local.remove(['fb_collector_data', 'fb_collector_state'], () => {
        rawItems = [];
        renderDashboard();
        showToast('All records cleared');
      });
    }
  });

  copyAllBtn.addEventListener('click', async () => {
    const filtered = getFilteredAndSortedItems();
    if (filtered.length === 0) {
      showToast('No items to copy');
      return;
    }
    const success = await Exporter.copyToClipboard(filtered);
    if (success) {
      showToast(`✓ Copied ${filtered.length} items to clipboard`);
    }
  });

  exportJsonBtn.addEventListener('click', () => {
    const filtered = getFilteredAndSortedItems();
    if (filtered.length === 0) {
      showToast('No items to export');
      return;
    }
    const filename = `FB_Data_by_NUR_${new Date().toISOString().slice(0, 10)}.json`;
    Exporter.downloadJson(filtered, filename);
    showToast('✓ JSON downloaded');
  });

  exportCsvBtn.addEventListener('click', () => {
    const filtered = getFilteredAndSortedItems();
    if (filtered.length === 0) {
      showToast('No items to export');
      return;
    }
    const sample = filtered[0];
    const authorSlug = (sample?.authorName || 'Page').replace(/[^a-zA-Z0-9_-]/g, '_');
    const typeSlug = (sample?.type === 'reel' ? 'Reels' : 'Posts');
    const filename = `${typeSlug}_${authorSlug}_${new Date().toISOString().slice(0, 10)}.csv`;
    Exporter.downloadCsv(filtered, filename);
    showToast(`✓ Exported ${filtered.length} items to CSV`);
  });

  if (launchFbBtn) {
    launchFbBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://www.facebook.com' });
    });
  }

  /**
   * Load collected data from chrome.storage.local
   */
  function loadData() {
    chrome.storage.local.get(['fb_collector_data'], (result) => {
      rawItems = result.fb_collector_data || [];
      renderDashboard();
    });
  }

  /**
   * Updates stats cards and renders current view
   */
  function renderDashboard(updateStats = true) {
    if (updateStats) {
      calculateStats(rawItems);
    }
    renderPresentation();
  }

  /**
   * Calculates overall engagement metrics
   */
  function calculateStats(items) {
    let postsCount = 0;
    let reelsCount = 0;
    let videosCount = 0;
    let totalViews = 0;
    let totalReactions = 0;
    let totalComments = 0;
    let totalShares = 0;

    items.forEach(item => {
      if (item.type === 'reel') reelsCount++;
      else if (item.type === 'video') videosCount++;
      else postsCount++;

      totalViews += (item.views || 0);
      totalReactions += (item.reactions || 0);
      totalComments += (item.comments || 0);
      totalShares += (item.shares || 0);
    });

    statTotalItems.textContent = items.length.toLocaleString();
    statTypeBreakdown.textContent = `${postsCount} Posts · ${reelsCount} Reels ${videosCount > 0 ? '· ' + videosCount + ' Videos' : ''}`;
    statTotalViews.textContent = Parser.formatCompactNumber(totalViews);
    statTotalReactions.textContent = Parser.formatCompactNumber(totalReactions);
    statTotalComments.textContent = Parser.formatCompactNumber(totalComments);
    statTotalShares.textContent = Parser.formatCompactNumber(totalShares);
  }

  /**
   * Filters and sorts raw data based on active UI controls
   */
  function getFilteredAndSortedItems() {
    let list = [...rawItems];

    // Filter by search query (supports Bangla, English, emoji)
    const q = searchInput.value.trim().toLowerCase();
    if (q) {
      list = list.filter(item => {
        const text = (item.caption || '').toLowerCase();
        const url = (item.url || '').toLowerCase();
        const date = (item.publishedDate || '').toLowerCase();
        return text.includes(q) || url.includes(q) || date.includes(q);
      });
    }

    // Filter by type
    const typeVal = typeFilter.value;
    if (typeVal !== 'all') {
      list = list.filter(item => item.type === typeVal);
    }

    // Sort order
    const sortVal = sortFilter.value;
    list.sort((a, b) => {
      if (sortVal === 'reactions-desc') return (b.reactions || 0) - (a.reactions || 0);
      if (sortVal === 'comments-desc') return (b.comments || 0) - (a.comments || 0);
      if (sortVal === 'shares-desc') return (b.shares || 0) - (a.shares || 0);
      if (sortVal === 'views-desc') return (b.views || 0) - (a.views || 0);
      if (sortVal === 'length-desc') {
        const parseSecs = (dur) => {
          if (!dur || dur === 'N/A') return 0;
          const p = dur.split(':').map(Number);
          if (p.length === 2) return p[0] * 60 + p[1];
          if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
          return 0;
        };
        return parseSecs(b.videoLength) - parseSecs(a.videoLength);
      }
      // default: newest
      return (new Date(b.collectedAt || 0)) - (new Date(a.collectedAt || 0));
    });

    return list;
  }

  /**
   * Renders either Table or Grid View based on current selection
   */
  function renderPresentation() {
    const items = getFilteredAndSortedItems();

    if (items.length === 0) {
      emptyState.classList.remove('hidden');
      tableView.classList.add('hidden');
      gridView.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    if (currentView === 'table') {
      tableView.classList.remove('hidden');
      gridView.classList.add('hidden');
      renderTable(items);
    } else {
      gridView.classList.remove('hidden');
      tableView.classList.add('hidden');
      renderGrid(items);
    }
  }

  /**
   * Populates HTML Table
   */
  function renderTable(items) {
    tableBody.innerHTML = '';

    items.forEach((item, index) => {
      const tr = document.createElement('tr');

      let badgeClass = 'badge-post';
      let badgeLabel = 'Post';
      if (item.type === 'reel') {
        badgeClass = 'badge-reel';
        badgeLabel = 'Reel';
      } else if (item.type === 'video') {
        badgeClass = 'badge-video';
        badgeLabel = 'Video';
      }

      const hasLongCaption = item.caption && item.caption.length > 90;
      const lengthBadge = item.videoLength && item.videoLength !== 'N/A' 
        ? `<span class="length-badge">⏱ ${escapeHtml(item.videoLength)}</span>` 
        : '<span style="color: var(--text-dim); font-size: 11px;">—</span>';

      const authorAvatar = item.authorAvatar 
        ? `<img src="${escapeHtml(item.authorAvatar)}" style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:6px;object-fit:cover;">` 
        : '';
      const authorDisplay = `${authorAvatar}<span>${escapeHtml(item.authorName || 'Facebook Page')}</span>`;

      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 11px;">${index + 1}</td>
        <td><span class="badge-tag ${badgeClass}">${badgeLabel}</span></td>
        <td>
          <div class="link-cell">
            <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="clean-link" title="${item.url}">
              ${escapeHtml(item.url)}
            </a>
            <button class="action-icon-btn copy-link-btn" data-url="${escapeHtml(item.url)}" title="Copy Share Link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </td>
        <td style="white-space: nowrap; font-size: 12px; color: var(--text-high);">${authorDisplay}</td>
        <td style="white-space: nowrap; font-size: 12px; color: var(--text-medium);">${escapeHtml(item.publishedDate || item.postedAt || 'Recent')}</td>
        <td>
          <div class="caption-cell">
            <div class="caption-text ${hasLongCaption ? 'caption-snippet' : ''}">${escapeHtml(item.caption || item.content || '—')}</div>
            ${hasLongCaption ? '<span class="expand-link">Show more</span>' : ''}
          </div>
        </td>
        <td style="text-align: right; font-weight: 600; color: #a5b4fc;">${Parser.formatCompactNumber(item.views)}</td>
        <td style="text-align: right; font-weight: 600; color: #f43f5e;">${Parser.formatCompactNumber(item.reactions)}</td>
        <td style="text-align: right; font-weight: 600; color: #f59e0b;">${Parser.formatCompactNumber(item.comments)}</td>
        <td style="text-align: right; font-weight: 600; color: #06b6d4;">${Parser.formatCompactNumber(item.shares)}</td>
        <td style="text-align: center;">
          <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="action-icon-btn" title="Open on Facebook">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Attach copy link listeners
    tableBody.querySelectorAll('.copy-link-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-url');
        if (url) {
          try {
            await navigator.clipboard.writeText(url);
            showToast('✓ Share link copied');
          } catch (err) {
            console.warn('Copy error:', err);
          }
        }
      });
    });

    // Attach caption expand listeners
    tableBody.querySelectorAll('.expand-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const textDiv = btn.previousElementSibling;
        if (textDiv.classList.contains('caption-snippet')) {
          textDiv.classList.remove('caption-snippet');
          btn.textContent = 'Show less';
        } else {
          textDiv.classList.add('caption-snippet');
          btn.textContent = 'Show more';
        }
      });
    });
  }

  /**
   * Populates Card Grid
   */
  function renderGrid(items) {
    gridView.innerHTML = '';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'content-card';

      let badgeClass = 'badge-post';
      let badgeLabel = 'Post';
      if (item.type === 'reel') {
        badgeClass = 'badge-reel';
        badgeLabel = 'Reel';
      } else if (item.type === 'video') {
        badgeClass = 'badge-video';
        badgeLabel = 'Video';
      }

      const lengthBadge = item.videoLength && item.videoLength !== 'N/A'
        ? `<span class="length-badge">⏱ ${escapeHtml(item.videoLength)}</span>`
        : '';

      card.innerHTML = `
        <div class="card-top">
          <div class="card-top-left">
            <span class="badge-tag ${badgeClass}">${badgeLabel}</span>
            ${item.authorAvatar ? `<img src="${escapeHtml(item.authorAvatar)}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;">` : ''}
            <span style="font-size:12px;font-weight:600;color:#fff;margin-left:4px;">${escapeHtml(item.authorName || 'Facebook Page')}</span>
          </div>
          <span class="card-date">${escapeHtml(item.publishedDate || item.postedAt || 'Recent')}</span>
        </div>

        <div class="card-body">
          ${escapeHtml(item.caption || 'No caption text')}
        </div>

        <div class="card-metrics">
          <div class="metric-box">
            <span class="metric-val" style="color: #a5b4fc;">${Parser.formatCompactNumber(item.views)}</span>
            <span class="metric-lbl">Views</span>
          </div>
          <div class="metric-box">
            <span class="metric-val" style="color: #f43f5e;">${Parser.formatCompactNumber(item.reactions)}</span>
            <span class="metric-lbl">Likes</span>
          </div>
          <div class="metric-box">
            <span class="metric-val" style="color: #f59e0b;">${Parser.formatCompactNumber(item.comments)}</span>
            <span class="metric-lbl">Comments</span>
          </div>
          <div class="metric-box">
            <span class="metric-val" style="color: #06b6d4;">${Parser.formatCompactNumber(item.shares)}</span>
            <span class="metric-lbl">Shares</span>
          </div>
        </div>

        <div class="card-footer">
          <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="clean-link">
            ${escapeHtml(item.url)}
          </a>
          <button class="action-icon-btn copy-card-link" data-url="${escapeHtml(item.url)}" title="Copy Share Link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      `;

      gridView.appendChild(card);
    });

    gridView.querySelectorAll('.copy-card-link').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-url');
        if (url) {
          try {
            await navigator.clipboard.writeText(url);
            showToast('✓ Share link copied');
          } catch (err) {
            console.warn('Copy error:', err);
          }
        }
      });
    });
  }

  /**
   * Helper to escape HTML tags to prevent XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Helper for toast notifications
   */
  function showToast(message) {
    const existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }
});
