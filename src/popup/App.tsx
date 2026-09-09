import { useState, useEffect } from 'react';
import { PageProfile } from '../shared/types';

export default function App() {
  const [page, setPage] = useState<PageProfile | null>(null);
  const [mode, setMode] = useState<'posts' | 'reels' | 'unsupported'>('posts');
  const [targetCount, setTargetCount] = useState<number>(50);
  const [status, setStatus] = useState<string>('Ready to analyze');

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id || !activeTab.url?.includes('facebook.com')) {
        setStatus('Please open a Facebook Page tab');
        setMode('unsupported');
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { type: 'DETECT_PAGE' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          setStatus('Ready on Facebook Page');
          return;
        }
        if (response.payload) {
          setPage(response.payload.page);
          setMode(response.payload.mode);
          setStatus(`Detected: ${response.payload.page?.name || 'Page'}`);
        }
      });
    });
  }, []);

  const openSidePanel = async () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (tab?.id && chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    });
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  };

  return (
    <div style={{ width: 360, padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-high)' }}>Facebook Analytics</h1>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Posts & Reels Intelligence</span>
        </div>
        <span className={`badge ${mode === 'reels' ? 'badge-reel' : 'badge-post'}`}>
          {mode === 'reels' ? 'Reels' : 'Posts'}
        </span>
      </header>

      <section className="glass-panel" style={{ padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Target Page:</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-high)' }}>
          {page?.name || 'Facebook Page'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--accent-blue)', marginTop: 2 }}>{status}</div>
      </section>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
          Target Items Limit:
        </label>
        <select
          value={targetCount}
          onChange={(e) => setTargetCount(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-high)',
            fontSize: 13
          }}
        >
          <option value={25}>25 Items</option>
          <option value={50}>50 Items</option>
          <option value={100}>100 Items</option>
          <option value={250}>250 Items</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={openSidePanel}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
          Open Side Panel Companion
        </button>

        <button className="btn" onClick={openDashboard}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          Open Analytics Dashboard
        </button>
      </div>

      <footer style={{ fontSize: 10, textAlign: 'center', color: 'var(--text-dim)' }}>
        Manifest V3 · Production Ready · Strict Quality
      </footer>
    </div>
  );
}
