// ─── Popup: Quick Actions ──────────────────────────────────────────────────

import React from 'react';
import '../sidepanel/styles/index.css';

const ACTIONS = [
  { icon: '📷', label: 'Screenshot', command: 'Take a screenshot of this page' },
  { icon: '📝', label: 'Extract Text', command: 'Extract all text from this page' },
  { icon: '🔗', label: 'Get Links', command: 'Extract all links from this page' },
  { icon: '📊', label: 'Get Tables', command: 'Extract table data from this page' },
  { icon: '📧', label: 'Find Emails', command: 'Find all email addresses on this page' },
  { icon: '💰', label: 'Find Prices', command: 'Extract all prices from this page' },
];

export default function App() {
  const openSidePanel = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    window.close();
  };

  const runAction = (command: string) => {
    chrome.runtime.sendMessage({
      type: 'USER_COMMAND',
      text: command,
      requestId: `popup_${Date.now()}`,
    });
    // Open side panel to show results
    openSidePanel();
  };

  return (
    <div style={{
      width: '300px',
      padding: '16px',
      background: 'var(--color-bg-primary)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          background: 'linear-gradient(135deg, var(--color-accent), #8b5cf6)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
        }}>🎯</div>
        <div>
          <div style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: '600',
            background: 'linear-gradient(135deg, var(--color-text-primary), var(--color-text-accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Sanchalak</div>
          <div style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
          }}>Quick Actions</div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '12px',
      }}>
        {ACTIONS.map((action, i) => (
          <button
            key={i}
            className="btn btn-secondary"
            onClick={() => runAction(action.command)}
            style={{
              flexDirection: 'column',
              padding: '12px 8px',
              gap: '6px',
              height: 'auto',
            }}
          >
            <span style={{ fontSize: '20px' }}>{action.icon}</span>
            <span style={{ fontSize: 'var(--font-size-xs)' }}>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Open Full Panel */}
      <button
        className="btn btn-primary"
        onClick={openSidePanel}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        💬 Open Chat Panel
      </button>
    </div>
  );
}
