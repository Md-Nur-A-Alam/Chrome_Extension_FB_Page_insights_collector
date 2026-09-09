import { useState, useEffect } from 'react';
import { ContentItem, PageProfile } from '../shared/types';
import { ExtensionMessage } from '../shared/types/messages';

export default function SidePanel() {
  const [page, setPage] = useState<PageProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'settings'>('overview');
  const [status, setStatus] = useState<string>('Ready');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isScraping, setIsScraping] = useState<boolean>(false);

  useEffect(() => {
    // Detect active tab Page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id && tab.url?.includes('facebook.com')) {
        chrome.tabs.sendMessage(tab.id, { type: 'DETECT_PAGE' }, (response) => {
          if (!chrome.runtime.lastError && response?.payload) {
            setPage(response.payload.page);
          }
        });
      }
    });

    // Listen for progress updates
    const messageListener = (msg: ExtensionMessage) => {
      if (msg.type === 'SCRAPE_PROGRESS' && msg.payload) {
        setStatus(msg.payload.message || msg.payload.status);
        if (msg.payload.items) setItems(msg.payload.items);
        if (['completed', 'cancelled', 'failed'].includes(msg.payload.status)) {
          setIsScraping(false);
        }
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  const handleToggleScrape = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;

      if (!isScraping) {
        setIsScraping(true);
        setStatus('Starting collection...');
        chrome.tabs.sendMessage(tab.id, {
          type: 'START_SCRAPE',
          payload: {
            targetCount: 50,
            mode: 'both'
          }
        });
      } else {
        setIsScraping(false);
        setStatus('Collection stopped');
        chrome.tabs.sendMessage(tab.id, { type: 'CANCEL_SCRAPE' });
      }
    });
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  };

  return (
    <div style={{ padding: 16, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700 }}>Analytics Companion</h1>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{page?.name || 'Facebook Active Tab'}</span>
        </div>
        <button className="btn" onClick={openDashboard} title="Open Full Dashboard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
        <button
          className="btn"
          style={{ background: activeTab === 'overview' ? 'var(--accent-primary)' : 'transparent', border: 'none', fontSize: 12, padding: '4px 10px' }}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className="btn"
          style={{ background: activeTab === 'items' ? 'var(--accent-primary)' : 'transparent', border: 'none', fontSize: 12, padding: '4px 10px' }}
          onClick={() => setActiveTab('items')}
        >
          Live Items ({items.length})
        </button>
        <button
          className="btn"
          style={{ background: activeTab === 'settings' ? 'var(--accent-primary)' : 'transparent', border: 'none', fontSize: 12, padding: '4px 10px' }}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {/* Status Bar */}
      <div className="glass-panel" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Engine Status</span>
          <span className={`badge ${isScraping ? 'badge-perf-up' : 'badge-perf-neutral'}`}>
            {isScraping ? 'Active' : 'Idle'}
          </span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-high)' }}>{status}</div>
      </div>

      {/* Main Content View */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="glass-panel" style={{ padding: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Items Collected</span>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{items.length}</div>
              </div>
              <div className="glass-panel" style={{ padding: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Performance Baseline</span>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--accent-emerald)' }}>Active</div>
              </div>
            </div>

            <button
              className={`btn ${isScraping ? 'btn-danger' : 'btn-primary'}`}
              onClick={handleToggleScrape}
              style={{ width: '100%', padding: '10px 16px' }}
            >
              {isScraping ? 'Stop Collection' : 'Start Page Collection'}
            </button>
          </div>
        )}

        {activeTab === 'items' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>
                No items harvested yet. Click "Start Page Collection" to begin.
              </div>
            ) : (
              items.map((item, idx) => (
                <div key={item.id || idx} className="glass-panel" style={{ padding: 10, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className={`badge ${item.type === 'reel' ? 'badge-reel' : 'badge-post'}`}>{item.type}</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{item.publishedRelative || 'Recent'}</span>
                  </div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-medium)' }}>
                    {item.caption || item.url || 'No caption'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="glass-panel" style={{ padding: 12, fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Collection Configuration</div>
            <div style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Configure scroll pacing, rate limit safeguards, baseline weightings, and export columns via the full Dashboard Settings tab.
            </div>
            <button className="btn" onClick={openDashboard} style={{ marginTop: 12, width: '100%' }}>
              Configure in Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
