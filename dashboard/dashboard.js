/**
 * Analytics Dashboard Logic for FB data collector by NUR
 * Handles data visualization, search, filtering, sorting, column visibility, and full CRUD operations.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Metric Stat Cards Elements
  const statTotalItems = document.getElementById('statTotalItems');
  const statTypeBreakdown = document.getElementById('statTypeBreakdown');
  const statTotalViews = document.getElementById('statTotalViews');
  const statTotalReactions = document.getElementById('statTotalReactions');
  const statTotalComments = document.getElementById('statTotalComments');
  const statTotalShares = document.getElementById('statTotalShares');

  // Filter & Search Elements
  const searchInput = document.getElementById('searchInput');
  const typeFilter = document.getElementById('typeFilter');
  const sortFilter = document.getElementById('sortFilter');

  // View Mode Elements
  const viewTableBtn = document.getElementById('viewTableBtn');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const tableView = document.getElementById('tableView');
  const gridView = document.getElementById('gridView');
  const emptyState = document.getElementById('emptyState');
  const tableBody = document.getElementById('tableBody');

  // Action Buttons
  const addRecordBtn = document.getElementById('addRecordBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const launchFbBtn = document.getElementById('launchFbBtn');

  // Column Visibility Elements
  const columnToggleBtn = document.getElementById('columnToggleBtn');
  const columnToggleMenu = document.getElementById('columnToggleMenu');
  const colSelectAllBtn = document.getElementById('colSelectAllBtn');
  const colResetBtn = document.getElementById('colResetBtn');

  // Modals Elements - CRUD
  const recordModal = document.getElementById('recordModal');
  const recordModalTitle = document.getElementById('recordModalTitle');
  const recordModalIcon = document.getElementById('recordModalIcon');
  const recordForm = document.getElementById('recordForm');
  const recordEditId = document.getElementById('recordEditId');
  const recordType = document.getElementById('recordType');
  const recordAuthor = document.getElementById('recordAuthor');
  const recordUrl = document.getElementById('recordUrl');
  const recordDate = document.getElementById('recordDate');
  const recordLength = document.getElementById('recordLength');
  const recordCaption = document.getElementById('recordCaption');
  const recordViews = document.getElementById('recordViews');
  const recordReactions = document.getElementById('recordReactions');
  const recordComments = document.getElementById('recordComments');
  const recordShares = document.getElementById('recordShares');
  const closeRecordModalBtn = document.getElementById('closeRecordModalBtn');
  const cancelRecordBtn = document.getElementById('cancelRecordBtn');

  // Delete Modal Elements
  const deleteModal = document.getElementById('deleteModal');
  const deleteItemPreview = document.getElementById('deleteItemPreview');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  // Details Modal Elements
  const detailsModal = document.getElementById('detailsModal');
  const detailsModalBody = document.getElementById('detailsModalBody');
  const closeDetailsModalBtn = document.getElementById('closeDetailsModalBtn');
  const closeDetailsBtn = document.getElementById('closeDetailsBtn');

  // Application State
  let rawItems = [];
  let currentView = 'table'; // 'table' or 'grid'
  let deletingItem = null;

  // Column Definitions
  const ALL_COLUMNS = [
    'index', 'type', 'link', 'author', 'date', 'caption',
    'views', 'reactions', 'comments', 'shares', 'actions'
  ];

  // Default all visible
  let visibleColumns = {};
  ALL_COLUMNS.forEach(col => { visibleColumns[col] = true; });

  // Load saved column preferences
  try {
    const savedCols = localStorage.getItem('fb_visible_columns');
    if (savedCols) {
      const parsed = JSON.parse(savedCols);
      if (typeof parsed === 'object' && parsed !== null) {
        visibleColumns = { ...visibleColumns, ...parsed };
      }
    }
  } catch (e) {
    console.warn('Could not parse saved column settings:', e);
  }

  // Initialize Column Toggle Checkboxes
  initColumnCheckboxes();

  // Load data on startup
  loadData();

  // Listen for storage changes in real-time
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.fb_collector_data) {
        rawItems = changes.fb_collector_data.newValue || [];
        renderDashboard();
      }
    });
  }

  // Event Listeners for Filters & Search
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
    showToast('✓ Data refreshed');
  });

  clearDataBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all collected Facebook records?')) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(['fb_collector_data', 'fb_collector_state'], () => {
          rawItems = [];
          renderDashboard();
          showToast('✓ All records cleared');
        });
      } else {
        rawItems = [];
        renderDashboard();
        showToast('✓ All records cleared');
      }
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
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: 'https://www.facebook.com' });
      } else {
        window.open('https://www.facebook.com', '_blank');
      }
    });
  }

  // -------------------------------------------------------------
  // Column Visibility Logic (Requirement 2.1)
  // -------------------------------------------------------------
  function initColumnCheckboxes() {
    const checkboxes = columnToggleMenu.querySelectorAll('input[type="checkbox"][data-col]');
    checkboxes.forEach(cb => {
      const col = cb.getAttribute('data-col');
      cb.checked = visibleColumns[col] !== false;

      cb.addEventListener('change', () => {
        visibleColumns[col] = cb.checked;
        saveColumnPreferences();
        applyColumnVisibility();
      });
    });

    // Toggle Dropdown Button
    columnToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      columnToggleMenu.classList.toggle('hidden');
    });

    // Close Dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!columnToggleMenu.contains(e.target) && !columnToggleBtn.contains(e.target)) {
        columnToggleMenu.classList.add('hidden');
      }
    });

    // Select All Columns
    colSelectAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      ALL_COLUMNS.forEach(col => { visibleColumns[col] = true; });
      checkboxes.forEach(cb => { cb.checked = true; });
      saveColumnPreferences();
      applyColumnVisibility();
    });

    // Reset Columns
    colResetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      ALL_COLUMNS.forEach(col => { visibleColumns[col] = true; });
      checkboxes.forEach(cb => { cb.checked = true; });
      saveColumnPreferences();
      applyColumnVisibility();
    });
  }

  function saveColumnPreferences() {
    try {
      localStorage.setItem('fb_visible_columns', JSON.stringify(visibleColumns));
    } catch (err) {
      console.warn('Could not save column preferences to localStorage:', err);
    }
  }

  function applyColumnVisibility() {
    ALL_COLUMNS.forEach(colKey => {
      const isVisible = visibleColumns[colKey] !== false;
      const elements = document.querySelectorAll(`[data-col="${colKey}"]`);
      elements.forEach(el => {
        if (isVisible) {
          el.classList.remove('col-hidden');
        } else {
          el.classList.add('col-hidden');
        }
      });
    });
  }

  // -------------------------------------------------------------
  // Data Loading & Persistence
  // -------------------------------------------------------------
  function loadData() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['fb_collector_data'], (result) => {
        rawItems = result.fb_collector_data || [];
        renderDashboard();
      });
    } else {
      rawItems = [];
      renderDashboard();
    }
  }

  function persistData(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ fb_collector_data: rawItems }, () => {
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  }

  // -------------------------------------------------------------
  // Rendering Logic
  // -------------------------------------------------------------
  function renderDashboard(updateStats = true) {
    if (updateStats) {
      calculateStats(rawItems);
    }
    renderPresentation();
  }

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

      totalViews += (Number(item.views) || 0);
      totalReactions += (Number(item.reactions) || 0);
      totalComments += (Number(item.comments) || 0);
      totalShares += (Number(item.shares) || 0);
    });

    statTotalItems.textContent = items.length.toLocaleString();
    statTypeBreakdown.textContent = `${postsCount} Posts · ${reelsCount} Reels ${videosCount > 0 ? '· ' + videosCount + ' Videos' : ''}`;
    statTotalViews.textContent = Parser.formatCompactNumber(totalViews);
    statTotalReactions.textContent = Parser.formatCompactNumber(totalReactions);
    statTotalComments.textContent = Parser.formatCompactNumber(totalComments);
    statTotalShares.textContent = Parser.formatCompactNumber(totalShares);
  }

  function getFilteredAndSortedItems() {
    let list = [...rawItems];

    // Filter by search query (supports Bangla, English, emoji)
    const q = searchInput.value.trim().toLowerCase();
    if (q) {
      list = list.filter(item => {
        const text = (item.caption || item.content || '').toLowerCase();
        const url = (item.url || item.postUrl || '').toLowerCase();
        const date = (item.publishedDate || item.postedAt || '').toLowerCase();
        const author = (item.authorName || '').toLowerCase();
        return text.includes(q) || url.includes(q) || date.includes(q) || author.includes(q);
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
      if (sortVal === 'reactions-desc') return (Number(b.reactions) || 0) - (Number(a.reactions) || 0);
      if (sortVal === 'comments-desc') return (Number(b.comments) || 0) - (Number(a.comments) || 0);
      if (sortVal === 'shares-desc') return (Number(b.shares) || 0) - (Number(a.shares) || 0);
      if (sortVal === 'views-desc') return (Number(b.views) || 0) - (Number(a.views) || 0);
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
   * Populates Table View with data-col attributes and action buttons
   */
  function renderTable(items) {
    tableBody.innerHTML = '';

    items.forEach((item, index) => {
      const tr = document.createElement('tr');
      const itemId = String(item.id || item.postId || item.url || index);

      let badgeClass = 'badge-post';
      let badgeLabel = 'Post';
      if (item.type === 'reel') {
        badgeClass = 'badge-reel';
        badgeLabel = 'Reel';
      } else if (item.type === 'video') {
        badgeClass = 'badge-video';
        badgeLabel = 'Video';
      }

      const hasLongCaption = (item.caption || item.content || '').length > 85;
      const authorAvatar = item.authorAvatar 
        ? `<img src="${escapeHtml(item.authorAvatar)}" style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:6px;object-fit:cover;">` 
        : '';
      const authorDisplay = `${authorAvatar}<span>${escapeHtml(item.authorName || 'Facebook Page')}</span>`;

      tr.innerHTML = `
        <td data-col="index" style="color: var(--text-muted); font-size: 11px;">${index + 1}</td>
        <td data-col="type">
          <span class="badge-tag ${badgeClass}">${badgeLabel}</span>
          ${item.videoLength && item.videoLength !== 'N/A' ? `<div style="margin-top:4px;"><span class="length-badge" style="font-size:10px;padding:2px 5px;">⏱ ${escapeHtml(item.videoLength)}</span></div>` : ''}
        </td>
        <td data-col="link">
          <div class="link-cell">
            <a href="${escapeHtml(item.url || item.postUrl)}" target="_blank" rel="noopener noreferrer" class="clean-link" title="${escapeHtml(item.url || item.postUrl)}">
              ${escapeHtml(item.url || item.postUrl)}
            </a>
            <button class="action-icon-btn copy-link-btn" data-url="${escapeHtml(item.url || item.postUrl)}" title="Copy Share Link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </td>
        <td data-col="author" style="white-space: nowrap; font-size: 12px; color: var(--text-high);">${authorDisplay}</td>
        <td data-col="date" style="white-space: nowrap; font-size: 12px; color: var(--text-medium);">${escapeHtml(item.publishedDate || item.postedAt || 'Recent')}</td>
        <td data-col="caption">
          <div class="caption-cell">
            <div class="caption-text ${hasLongCaption ? 'caption-snippet' : ''}">${escapeHtml(item.caption || item.content || '—')}</div>
            ${hasLongCaption ? '<span class="expand-link">Show more</span>' : ''}
          </div>
        </td>
        <td data-col="views" style="text-align: right; font-weight: 600; color: #a5b4fc;">${Parser.formatCompactNumber(item.views)}</td>
        <td data-col="reactions" style="text-align: right; font-weight: 600; color: #f43f5e;">${Parser.formatCompactNumber(item.reactions)}</td>
        <td data-col="comments" style="text-align: right; font-weight: 600; color: #f59e0b;">${Parser.formatCompactNumber(item.comments)}</td>
        <td data-col="shares" style="text-align: right; font-weight: 600; color: #06b6d4;">${Parser.formatCompactNumber(item.shares)}</td>
        <td data-col="actions" style="text-align: center;">
          <div class="action-cell-group">
            <button class="action-icon-btn btn-view" data-id="${escapeHtml(itemId)}" title="View Details">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="action-icon-btn btn-edit" data-id="${escapeHtml(itemId)}" title="Edit Record">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="action-icon-btn btn-delete" data-id="${escapeHtml(itemId)}" title="Delete Record">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <a href="${escapeHtml(item.url || item.postUrl)}" target="_blank" rel="noopener noreferrer" class="action-icon-btn" title="Open on Facebook">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Apply column visibility to newly rendered rows
    applyColumnVisibility();

    // Attach listeners for copy links
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

    // Attach CRUD listeners
    attachCrudRowListeners(tableBody);
  }

  /**
   * Populates Card Grid with CRUD action buttons
   */
  function renderGrid(items) {
    gridView.innerHTML = '';

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'content-card';
      const itemId = String(item.id || item.postId || item.url || index);

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
        ? `<span class="length-badge" style="font-size:10px;padding:2px 6px;margin-left:4px;">⏱ ${escapeHtml(item.videoLength)}</span>`
        : '';

      card.innerHTML = `
        <div class="card-top">
          <div class="card-top-left">
            <span class="badge-tag ${badgeClass}">${badgeLabel}</span>
            ${lengthBadge}
            ${item.authorAvatar ? `<img src="${escapeHtml(item.authorAvatar)}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;">` : ''}
            <span style="font-size:12px;font-weight:600;color:#fff;margin-left:4px;">${escapeHtml(item.authorName || 'Facebook Page')}</span>
          </div>
          <span class="card-date">${escapeHtml(item.publishedDate || item.postedAt || 'Recent')}</span>
        </div>

        <div class="card-body">
          ${escapeHtml(item.caption || item.content || 'No caption text')}
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
          <div style="max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <a href="${escapeHtml(item.url || item.postUrl)}" target="_blank" rel="noopener noreferrer" class="clean-link">
              ${escapeHtml(item.url || item.postUrl)}
            </a>
          </div>
          <div class="card-footer-actions">
            <button class="action-icon-btn copy-card-link" data-url="${escapeHtml(item.url || item.postUrl)}" title="Copy Share Link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="action-icon-btn btn-view" data-id="${escapeHtml(itemId)}" title="View Details">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="action-icon-btn btn-edit" data-id="${escapeHtml(itemId)}" title="Edit Record">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="action-icon-btn btn-delete" data-id="${escapeHtml(itemId)}" title="Delete Record">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
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

    // Attach CRUD listeners
    attachCrudRowListeners(gridView);
  }

  // -------------------------------------------------------------
  // CRUD Operations Implementation (Requirements 2.2 & 2.3)
  // -------------------------------------------------------------

  function findItemById(id) {
    if (!id) return null;
    return rawItems.find(it => 
      String(it.id) === String(id) || 
      String(it.postId) === String(id) || 
      String(it.url) === String(id)
    );
  }

  function attachCrudRowListeners(container) {
    // View Details
    container.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = findItemById(id);
        if (item) openDetailsModal(item);
      });
    });

    // Edit Record
    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = findItemById(id);
        if (item) openEditRecordModal(item);
      });
    });

    // Delete Record
    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = findItemById(id);
        if (item) openDeleteConfirmModal(item);
      });
    });
  }

  // C - Create (Add Record)
  if (addRecordBtn) {
    addRecordBtn.addEventListener('click', () => {
      recordForm.reset();
      recordEditId.value = '';
      recordModalTitle.textContent = 'Add New Record';
      recordModalIcon.textContent = '➕';
      recordType.value = 'reel';
      recordDate.value = 'Recent';
      recordLength.value = '';
      recordViews.value = '0';
      recordReactions.value = '0';
      recordComments.value = '0';
      recordShares.value = '0';
      openModal(recordModal);
    });
  }

  // U - Update (Edit Record)
  function openEditRecordModal(item) {
    recordEditId.value = item.id || item.postId || item.url;
    recordModalTitle.textContent = 'Edit Record';
    recordModalIcon.textContent = '✏️';
    recordType.value = item.type || 'reel';
    recordAuthor.value = item.authorName || '';
    recordUrl.value = item.url || item.postUrl || '';
    recordDate.value = item.publishedDate || item.postedAt || 'Recent';
    recordLength.value = item.videoLength && item.videoLength !== 'N/A' ? item.videoLength : '';
    recordCaption.value = item.caption || item.content || '';
    recordViews.value = item.views || 0;
    recordReactions.value = item.reactions || 0;
    recordComments.value = item.comments || 0;
    recordShares.value = item.shares || 0;
    openModal(recordModal);
  }

  // Form Submission (Create or Update)
  recordForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const type = recordType.value;
    const url = recordUrl.value.trim();
    const author = recordAuthor.value.trim() || 'Facebook Page';
    const date = recordDate.value.trim() || 'Recent';
    const length = recordLength.value.trim() || (type === 'reel' ? 'N/A' : '');
    const caption = recordCaption.value.trim();

    let views = parseInt(recordViews.value, 10) || 0;
    let reactions = parseInt(recordReactions.value, 10) || 0;
    let comments = parseInt(recordComments.value, 10) || 0;
    let shares = parseInt(recordShares.value, 10) || 0;

    // Reels metric consistency hierarchy:
    // view < reaction => reaction = 0
    // reaction < comment => comment = 0
    // comment < share => share = 0
    let ruleApplied = false;
    if (type === 'reel') {
      if (views < reactions) {
        reactions = 0;
        ruleApplied = true;
      }
      if (reactions < comments) {
        comments = 0;
        ruleApplied = true;
      }
      if (comments < shares) {
        shares = 0;
        ruleApplied = true;
      }
    }

    const editId = recordEditId.value;

    if (editId) {
      // UPDATE existing item
      const item = findItemById(editId);
      if (item) {
        item.type = type;
        item.url = url;
        item.postUrl = url;
        item.authorName = author;
        item.publishedDate = date;
        item.postedAt = date;
        item.videoLength = length;
        item.caption = caption;
        item.content = caption;
        item.views = views;
        item.reactions = reactions;
        item.comments = comments;
        item.shares = shares;
        item.updatedAt = new Date().toISOString();

        persistData(() => {
          renderDashboard();
          closeModal(recordModal);
          if (ruleApplied) {
            showToast('✓ Record updated (Reels metric hierarchy applied: Views ≥ Reactions ≥ Comments ≥ Shares)');
          } else {
            showToast('✓ Record updated successfully');
          }
        });
      }
    } else {
      // CREATE new item
      const newId = `custom_${Date.now()}`;
      const newRecord = {
        id: newId,
        postId: newId,
        type: type,
        postType: type === 'post' ? 'post' : 'video',
        mediaType: 'image',
        url: url,
        postUrl: url,
        authorName: author,
        authorHandle: '',
        publishedDate: date,
        postedAt: date,
        videoLength: length,
        caption: caption,
        content: caption,
        views: views,
        reactions: reactions,
        comments: comments,
        shares: shares,
        scrapedAt: new Date().toLocaleString(),
        collectedAt: new Date().toISOString(),
        isEnriched: true
      };

      rawItems.unshift(newRecord);
      persistData(() => {
        renderDashboard();
        closeModal(recordModal);
        if (ruleApplied) {
          showToast('✓ New record created (Reels metric hierarchy applied: Views ≥ Reactions ≥ Comments ≥ Shares)');
        } else {
          showToast('✓ New record created successfully');
        }
      });
    }
  });

  // D - Delete Row
  function openDeleteConfirmModal(item) {
    deletingItem = item;
    deleteItemPreview.innerHTML = `
      <div class="preview-row"><span class="preview-label">Type:</span> <span class="preview-val">${escapeHtml(item.type?.toUpperCase() || 'POST')}</span></div>
      <div class="preview-row"><span class="preview-label">Author:</span> <span class="preview-val">${escapeHtml(item.authorName || 'Facebook Page')}</span></div>
      <div class="preview-row"><span class="preview-label">Caption:</span> <span class="preview-val">${escapeHtml((item.caption || item.content || item.url || 'No text').slice(0, 80))}...</span></div>
    `;
    openModal(deleteModal);
  }

  confirmDeleteBtn.addEventListener('click', () => {
    if (!deletingItem) return;
    const targetId = deletingItem.id || deletingItem.postId || deletingItem.url;
    rawItems = rawItems.filter(it => 
      String(it.id) !== String(targetId) && 
      String(it.postId) !== String(targetId) && 
      String(it.url) !== String(targetId)
    );

    persistData(() => {
      deletingItem = null;
      closeModal(deleteModal);
      renderDashboard();
      showToast('✓ Record deleted');
    });
  });

  // R - Read (Details Modal)
  function openDetailsModal(item) {
    let badgeClass = 'badge-post';
    let badgeLabel = 'Post';
    if (item.type === 'reel') {
      badgeClass = 'badge-reel';
      badgeLabel = 'Reel';
    } else if (item.type === 'video') {
      badgeClass = 'badge-video';
      badgeLabel = 'Video';
    }

    detailsModalBody.innerHTML = `
      <div class="details-grid">
        <div class="details-meta-row">
          <span class="badge-tag ${badgeClass}">${badgeLabel}</span>
          ${item.videoLength && item.videoLength !== 'N/A' ? `<span class="length-badge">⏱ ${escapeHtml(item.videoLength)}</span>` : ''}
          ${item.authorAvatar ? `<img src="${escapeHtml(item.authorAvatar)}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;">` : ''}
          <span style="font-size: 13px; font-weight: 600; color: #fff;">${escapeHtml(item.authorName || 'Facebook Page')}</span>
          <span style="font-size: 12px; color: var(--text-muted); margin-left: auto;">${escapeHtml(item.publishedDate || item.postedAt || 'Recent')}</span>
        </div>

        <div style="font-size: 12px; display: flex; align-items: center; justify-content: space-between; background: rgba(15,23,42,0.6); padding: 8px 12px; border-radius: var(--radius-xs); border: 1px solid var(--border-glass);">
          <a href="${escapeHtml(item.url || item.postUrl)}" target="_blank" rel="noopener noreferrer" class="clean-link" style="max-width: 80%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(item.url || item.postUrl)}
          </a>
          <button class="action-icon-btn copy-modal-link" data-url="${escapeHtml(item.url || item.postUrl)}" title="Copy Link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>

        <div class="card-metrics" style="margin: 0;">
          <div class="metric-box">
            <span class="metric-val" style="color: #a5b4fc;">${Parser.formatCompactNumber(item.views)}</span>
            <span class="metric-lbl">Views</span>
          </div>
          <div class="metric-box">
            <span class="metric-val" style="color: #f43f5e;">${Parser.formatCompactNumber(item.reactions)}</span>
            <span class="metric-lbl">Reactions</span>
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

        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Full Caption / Content</span>
            <button class="action-icon-btn copy-modal-caption" title="Copy Caption">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
          <div class="details-caption-box" id="detailsCaptionText">${escapeHtml(item.caption || item.content || 'No text content')}</div>
        </div>
      </div>
    `;

    detailsModalBody.querySelector('.copy-modal-link').addEventListener('click', async () => {
      const u = item.url || item.postUrl;
      if (u) {
        await navigator.clipboard.writeText(u);
        showToast('✓ Link copied');
      }
    });

    detailsModalBody.querySelector('.copy-modal-caption').addEventListener('click', async () => {
      const cap = item.caption || item.content || '';
      if (cap) {
        await navigator.clipboard.writeText(cap);
        showToast('✓ Caption copied');
      }
    });

    openModal(detailsModal);
  }

  // Modal Helpers
  function openModal(modalEl) {
    if (modalEl) modalEl.classList.add('active');
  }

  function closeModal(modalEl) {
    if (modalEl) modalEl.classList.remove('active');
  }

  // Close button listeners
  closeRecordModalBtn.addEventListener('click', () => closeModal(recordModal));
  cancelRecordBtn.addEventListener('click', () => closeModal(recordModal));

  closeDeleteModalBtn.addEventListener('click', () => {
    deletingItem = null;
    closeModal(deleteModal);
  });
  cancelDeleteBtn.addEventListener('click', () => {
    deletingItem = null;
    closeModal(deleteModal);
  });

  closeDetailsModalBtn.addEventListener('click', () => closeModal(detailsModal));
  closeDetailsBtn.addEventListener('click', () => closeModal(detailsModal));

  // Close modal when clicking backdrop
  [recordModal, deleteModal, detailsModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });

  // ESC key listener for modals and column dropdown
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(recordModal);
      closeModal(deleteModal);
      closeModal(detailsModal);
      columnToggleMenu.classList.add('hidden');
    }
  });

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

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
    }, 2400);
  }
});
