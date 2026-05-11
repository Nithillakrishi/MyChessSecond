import React, { useState } from 'react';
import { Logo } from './LandingPage';
import ThemePicker from './ThemePicker';
import './AppLayout.css';

const NAV_ITEMS = [
  { id: 'welcome',   icon: '⌂',  label: 'Home' },
  { id: 'coach',     icon: '♟',  label: 'AI Coach' },
  { id: 'explorer',  icon: '🌐', label: 'Chess Explorer' },
  { id: 'stockfish', icon: '⚡', label: 'Engine Training' },
  { id: 'opponent',  icon: '👥', label: 'vs Player' },
  { id: 'position',  icon: '🎯', label: 'Custom Position' },
  { id: 'playvs',    icon: '♜',  label: 'Play vs Stockfish' },
];

export default function AppLayout({ activeMode, onSelect, username, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  }

  return (
    <div className={`al-root ${collapsed ? 'al-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className="al-sidebar">
        <div className="al-sidebar-top">
          {/* Brand row + collapse toggle */}
          <div className="al-brand-row">
            {!collapsed && (
              <div className="al-brand" onClick={() => onSelect('welcome')}>
                <Logo size={28} />
                <span className="al-brand-name">MyChess<strong>2nd</strong></span>
              </div>
            )}
            {collapsed && (
              <div className="al-brand-icon" onClick={() => onSelect('welcome')}>
                <Logo size={28} />
              </div>
            )}
            <button className="al-collapse-btn" onClick={toggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {collapsed ? '›' : '‹'}
            </button>
          </div>

          <nav className="al-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`al-nav-item ${activeMode === item.id ? 'al-nav-active' : ''}`}
                onClick={() => onSelect(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <span className="al-nav-icon">{item.icon}</span>
                {!collapsed && <span className="al-nav-label">{item.label}</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="al-sidebar-bottom">
          {!collapsed && (
            <>
              <div className="al-user">
                <div className="al-user-avatar">
                  {username ? username[0].toUpperCase() : '?'}
                </div>
                <div className="al-user-info">
                  <span className="al-user-name">{username}</span>
                  <span className="al-user-lbl">Player</span>
                </div>
              </div>
              <div className="al-bottom-actions">
                <ThemePicker compact />
                <button className="al-logout" onClick={onLogout} title="Back to start">↩</button>
              </div>
            </>
          )}
          {collapsed && (
            <div className="al-collapsed-bottom">
              <div className="al-user-avatar al-avatar-sm">
                {username ? username[0].toUpperCase() : '?'}
              </div>
              <button className="al-logout" onClick={onLogout} title="Back to start">↩</button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="al-main">
        {children}
      </main>
    </div>
  );
}
