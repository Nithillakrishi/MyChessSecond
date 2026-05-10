import React from 'react';
import { Logo } from './LandingPage';
import './AppLayout.css';

const NAV_ITEMS = [
  { id: 'welcome',    icon: '⌂',  label: 'Home' },
  { id: 'coach',      icon: '♟',  label: 'AI Coach' },
  { id: 'explorer',   icon: '🌐', label: 'Chess Explorer' },
  { id: 'stockfish',  icon: '⚡', label: 'Engine Training' },
  { id: 'opponent',   icon: '👥', label: 'vs Player' },
  { id: 'position',   icon: '🎯', label: 'Custom Position' },
  { id: 'playvs',     icon: '♜',  label: 'Play vs Stockfish' },
];

export default function AppLayout({ activeMode, onSelect, username, onLogout, children }) {
  return (
    <div className="al-root">
      {/* Sidebar */}
      <aside className="al-sidebar">
        <div className="al-sidebar-top">
          <div className="al-brand" onClick={() => onSelect('welcome')}>
            <Logo size={32} />
            <span className="al-brand-name">MyChess<strong>2nd</strong></span>
          </div>

          <nav className="al-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`al-nav-item ${activeMode === item.id ? 'al-nav-active' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="al-nav-icon">{item.icon}</span>
                <span className="al-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="al-sidebar-bottom">
          <div className="al-user">
            <div className="al-user-avatar">
              {username ? username[0].toUpperCase() : '?'}
            </div>
            <div className="al-user-info">
              <span className="al-user-name">{username}</span>
              <span className="al-user-lbl">Player</span>
            </div>
          </div>
          <button className="al-logout" onClick={onLogout} title="Back to start">↩</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="al-main">
        {children}
      </main>
    </div>
  );
}
