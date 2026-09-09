/**
 * Controller for Popup UI
 * Connects UI interactions to active Facebook tab content script.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const notFacebookNotice = document.getElementById('notFacebookNotice');
  const collectorControls = document.getElementById('collectorControls');
  const detectedPageTitle = document.getElementById('detectedPageTitle');
  const detectedPageType = document.getElementById('detectedPageType');
  const modeBadge = document.getElementById('modeBadge');
  const targetCountInput = document.getElementById('targetCountInput');
  const modeSelect = document.getElementById('modeSelect');
  const speedSelect = document.getElementById('speedSelect');
  const statusLabel = document.getElementById('statusLabel');
  const counterLabel = document.getElementById('counterLabel');
  const progressBar = document.getElementById('progressBar');

  // Control Buttons
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const stopBtn = document.getElementById('stopBtn');
  const openFbBtn = document.getElementById('openFbBtn');

  // Preview elements
  const previewCard = document.getElementById('previewCard');
  const previewType = document.getElementById('previewType');
  const previewText = document.getElementById('previewText');
  const previewViews = document.getElementById('previewViews');
  const previewReactions = document.getElementById('previewReactions');
  const previewComments = document.getElementById('previewComments');
  const previewShares = document.getElementById('previewShares');

  // Dashboard & Export
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  const openDashboardHeaderBtn = document.getElementById('openDashboardHeaderBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const copyClipboardBtn = document.getElementById('copyClipboardBtn');

  let activeTab = null;
  let collectedItems = [];

  // 1. Check Active Tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
  } catch (err) {
    console.error('Failed to get active tab:', err);
  }

  const isFb = activeTab && activeTab.url && activeTab.url.includes('facebook.com');

  if (!isFb) {
    notFacebookNotice.classList.remove('hidden');
    collectorControls.classList.add('hidden');
    return;
  }

  notFacebookNotice.classList.add('hidden');
  collectorControls.classList.remove('hidden');

  // Ensure content scripts are injected in case the tab was opened before extension was loaded
  await ensureContentScriptInjected(activeTab.id);

  // Sync initial state from active tab and storage
  await syncState();

  // Preset pill clicks
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      targetCountInput.value = btn.getAttribute('data-val');
    });
  });

  // Mode select change
  modeSelect.addEventListener('change', () => {
    updateModeBadge(modeSelect.value);
  });

  // Action: Start Collection
  startBtn.addEventListener('click', async () => {
    const targetCount = parseInt(targetCountInput.value) || 50;
    const delayMs = parseInt(speedSelect.value) || 1500;
    const mode = modeSelect.value;

    updateUIStatus('running', 0, targetCount, 'Starting collection...');

    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'START_COLLECTION',
        payload: { targetCount, delayMs, mode }
      });
    } catch (err) {
      console.warn('Start message error:', err);
    }
  });

  // Action: Pause Collection
  pauseBtn.addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(activeTab.id, { action: 'PAUSE_COLLECTION' });
      updateUIStatus('paused');
    } catch (err) {
      console.warn('Pause error:', err);
    }
  });

  // Action: Resume Collection
  resumeBtn.addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(activeTab.id, { action: 'RESUME_COLLECTION' });
      updateUIStatus('running');
    } catch (err) {
      console.warn('Resume error:', err);
    }
  });

  // Action: Stop Collection
  stopBtn.addEventListener('click', async () => {
    try {
      chrome.storage.local.set({ fb_reels_queue_active: false });
      const resp = await chrome.tabs.sendMessage(activeTab.id, { action: 'STOP_COLLECTION' });
      if (resp && resp.items) {
        collectedItems = resp.items;
      }
      updateUIStatus('stopped');
    } catch (err) {
      console.warn('Stop error:', err);
    }
  });

  // Action: Open Facebook
  if (openFbBtn) {
    openFbBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://www.facebook.com' });
    });
  }

  // Action: Open Dashboard
  const triggerOpenDashboard = () => {
    chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
  };
  openDashboardBtn.addEventListener('click', triggerOpenDashboard);
  openDashboardHeaderBtn.addEventListener('click', triggerOpenDashboard);

  // Action: Export CSV
  exportCsvBtn.addEventListener('click', async () => {
    await fetchLatestItems();
    if (collectedItems.length === 0) {
      alert('No items collected yet. Click "Start Collecting" to harvest data first.');
      return;
    }
    const sample = collectedItems[0];
    const authorSlug = (sample?.authorName || detectedPageTitle.textContent || 'Page').replace(/[^a-zA-Z0-9_-]/g, '_');
    const typeSlug = (sample?.type === 'reel' ? 'Reels' : 'Posts');
    const filename = `${typeSlug}_${authorSlug}_${new Date().toISOString().slice(0, 10)}.csv`;
    Exporter.downloadCsv(collectedItems, filename);
  });

  // Action: Export JSON
  exportJsonBtn.addEventListener('click', async () => {
    await fetchLatestItems();
    if (collectedItems.length === 0) {
      alert('No items collected yet.');
      return;
    }
    const pageName = detectedPageTitle.textContent.replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_');
    const filename = `FB_${pageName || 'Data'}_${new Date().toISOString().slice(0, 10)}.json`;
    Exporter.downloadJson(collectedItems, filename);
  });

  // Action: Copy TSV to clipboard
  copyClipboardBtn.addEventListener('click', async () => {
    await fetchLatestItems();
    if (collectedItems.length === 0) {
      alert('No items collected yet.');
      return;
    }
    const success = await Exporter.copyToClipboard(collectedItems);
    if (success) {
      const originalText = copyClipboardBtn.textContent;
      copyClipboardBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyClipboardBtn.textContent = originalText;
      }, 1800);
    }
  });

  // Listen for broadcast progress events from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'COLLECTOR_UPDATE' && message.payload) {
      const p = message.payload;
      collectedItems = p.items || collectedItems;
      updateUIStatus(p.status, p.count, p.targetCount, p.message);
      if (collectedItems.length > 0) {
        renderPreview(collectedItems[collectedItems.length - 1]);
      }
    }
  });

  // Listen for storage changes in real-time (essential during sequential page redirects)
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.fb_collector_data && changes.fb_collector_data.newValue) {
          collectedItems = changes.fb_collector_data.newValue;
          if (collectedItems.length > 0) {
            renderPreview(collectedItems[collectedItems.length - 1]);
          }
        }
        if (changes.fb_collector_state && changes.fb_collector_state.newValue) {
          const s = changes.fb_collector_state.newValue;
          updateUIStatus(s.status, s.count, s.targetCount);
        }
      }
    });
  }

  /**
   * Updates button states, progress bar, and labels
   */
  function updateUIStatus(status, count = null, target = null, customMsg = '') {
    const currentCount = count !== null ? count : (collectedItems ? collectedItems.length : 0);
    const currentTarget = target !== null ? target : (parseInt(targetCountInput.value) || 50);

    const percent = Math.min(100, Math.round((currentCount / Math.max(1, currentTarget)) * 100));
    progressBar.style.width = `${percent}%`;
    counterLabel.textContent = `${currentCount} / ${currentTarget}`;

    // Update buttons
    if (status === 'running') {
      startBtn.classList.add('hidden');
      resumeBtn.classList.add('hidden');
      pauseBtn.classList.remove('hidden');
      stopBtn.classList.remove('hidden');
      statusLabel.textContent = customMsg || 'Collecting data...';
      statusLabel.style.color = 'var(--accent-blue)';
    } else if (status === 'paused') {
      startBtn.classList.add('hidden');
      pauseBtn.classList.add('hidden');
      resumeBtn.classList.remove('hidden');
      stopBtn.classList.remove('hidden');
      statusLabel.textContent = 'Paused';
      statusLabel.style.color = 'var(--accent-purple)';
    } else if (status === 'completed') {
      startBtn.classList.remove('hidden');
      pauseBtn.classList.add('hidden');
      resumeBtn.classList.add('hidden');
      stopBtn.classList.add('hidden');
      statusLabel.textContent = '✓ Collection Finished!';
      statusLabel.style.color = 'var(--accent-emerald)';
    } else {
      // idle or stopped
      startBtn.classList.remove('hidden');
      pauseBtn.classList.add('hidden');
      resumeBtn.classList.add('hidden');
      stopBtn.classList.add('hidden');
      statusLabel.textContent = customMsg || 'Ready to collect';
      statusLabel.style.color = 'var(--text-muted)';
    }
  }

  const previewDuration = document.getElementById('previewDuration');

  /**
   * Renders latest harvested item into preview card
   */
  function renderPreview(item) {
    if (!item) return;
    previewCard.classList.remove('hidden');
    previewType.textContent = item.type === 'reel' ? 'Reel' : (item.type === 'video' ? 'Video' : 'Post');
    previewType.className = `tag ${item.type === 'reel' ? 'tag-purple' : 'tag-blue'}`;
    
    if (item.videoLength && item.videoLength !== 'N/A') {
      previewDuration.textContent = `⏱ ${item.videoLength}`;
      previewDuration.classList.remove('hidden');
    } else {
      previewDuration.classList.add('hidden');
    }

    previewText.textContent = item.caption || item.url;
    previewViews.textContent = Parser.formatCompactNumber(item.views);
    previewReactions.textContent = Parser.formatCompactNumber(item.reactions);
    previewComments.textContent = Parser.formatCompactNumber(item.comments);
    previewShares.textContent = Parser.formatCompactNumber(item.shares);
  }

  function updateModeBadge(mode) {
    if (mode === 'reels') {
      modeBadge.textContent = 'Reels Mode';
      modeBadge.className = 'tag tag-purple';
    } else if (mode === 'posts') {
      modeBadge.textContent = 'Posts Mode';
      modeBadge.className = 'tag tag-blue';
    } else {
      modeBadge.textContent = 'Auto-Detect';
      modeBadge.className = 'tag tag-blue';
    }
  }

  /**
   * Synchronizes state from content script & storage
   */
  async function syncState() {
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'GET_STATE' });
      if (response && response.success) {
        if (response.info) {
          detectedPageTitle.textContent = response.info.pageName || 'Facebook Page';
          detectedPageType.textContent = response.info.mode === 'reels' ? 'Reels Grid Detected' : 'Posts Feed Detected';
          if (modeSelect.value === 'auto') {
            updateModeBadge(response.info.mode);
          }
        }
        if (response.items) {
          collectedItems = response.items;
          if (collectedItems.length > 0) {
            renderPreview(collectedItems[collectedItems.length - 1]);
          }
        }
        updateUIStatus(response.status, response.count, response.targetCount);
        return;
      }
    } catch (e) {
      // Fall back to storage if tab not responsive
    }

    // Fallback to chrome.storage
    chrome.storage.local.get(['fb_collector_data', 'fb_collector_state'], (result) => {
      if (result.fb_collector_data) {
        collectedItems = result.fb_collector_data;
        if (collectedItems.length > 0) {
          renderPreview(collectedItems[collectedItems.length - 1]);
        }
      }
      if (result.fb_collector_state) {
        const s = result.fb_collector_state;
        updateUIStatus(s.status, s.count, s.targetCount);
      }
    });
  }

  async function fetchLatestItems() {
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'GET_STATE' });
      if (response && response.items) {
        collectedItems = response.items;
      }
    } catch (e) {
      // Content script may be idle, use current collectedItems
    }
  }

  /**
   * Helper to programmatically inject content scripts if needed
   */
  async function ensureContentScriptInjected(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'DETECT_PAGE' });
    } catch (err) {
      // Tab hasn't received content script yet (e.g. loaded before extension install)
      console.log('Injecting scripts programmatically into tab:', tabId);
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [
            'utils/parser.js',
            'content/extractor-posts.js',
            'content/extractor-reels.js',
            'content/scroll-manager.js',
            'content/content.js'
          ]
        });
      } catch (injectErr) {
        console.warn('Script injection notice:', injectErr);
      }
    }
  }
});
