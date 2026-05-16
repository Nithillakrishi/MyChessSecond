import React, { useState } from 'react';
import { Logo } from './LandingPage';
import ThemePicker from './ThemePicker';
import AccountSettings from './AccountSettings';
import { useAuth } from '../contexts/AuthContext';
import './AppLayout.css';

const NAV_ITEMS = [
  { id: 'welcome',   icon: '⌂',  label: 'Home' },
  { id: 'coach',     icon: '♟',  label: 'AI Coach' },
  { id: 'explorer',  icon: '🌐', label: 'Chess Explorer' },
  { id: 'stockfish', icon: '⚡', label: 'Engine Training' },
  { id: 'opponent',  icon: '👥', label: 'vs Player' },
  { id: 'position',  icon: '🎯', label: 'Game Analysis' },
  { id: 'playvs',    icon: '♜',  label: 'Play vs Stockfish' },
];

export default function AppLayout({ activeMode, onSelect, username, onLogout, onChessUsernameChanged, children }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );
  const [showSettings, setShowSettings] = useState(false);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  }

  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name || username;

  return (
    <div className={`al-root ${collapsed ? 'al-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className="al-sidebar">
        <div className="al-sidebar-top">
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
              <button className="al-user al-user-btn" onClick={() => setShowSettings(true)} title="Account settings">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="al-user-photo" referrerPolicy="no-referrer" />
                ) : (
                  <div className="al-user-avatar">
                    {username ? username[0].toUpperCase() : '?'}
                  </div>
                )}
                <div className="al-user-info">
                  <span className="al-user-name">{username}</span>
                  <span className="al-user-lbl">{displayName !== username ? displayName : 'Player'}</span>
                </div>
                <span className="al-user-cog">⚙</span>
              </button>
              <div className="al-bottom-actions">
                <ThemePicker compact />
                <button className="al-logout" onClick={onLogout} title="Sign out">↩</button>
              </div>
            </>
          )}
          {collapsed && (
            <div className="al-collapsed-bottom">
              <button className="al-user-btn-sm" onClick={() => setShowSettings(true)} title="Account settings">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="al-user-photo-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="al-user-avatar al-avatar-sm">
                    {username ? username[0].toUpperCase() : '?'}
                  </div>
                )}
              </button>
              <button className="al-logout" onClick={onLogout} title="Sign out">↩</button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="al-main">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="al-mobile-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`al-mobile-nav-item ${activeMode === item.id ? 'al-mobile-nav-active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="al-mobile-nav-icon">{item.icon}</span>
            <span className="al-mobile-nav-label">{item.label}</span>
          </button>
        ))}
        <button className="al-mobile-nav-item al-mobile-nav-profile" onClick={() => setShowSettings(true)}>
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="al-mobile-avatar-img" referrerPolicy="no-referrer" />
            : <span className="al-mobile-avatar-fallback">{username ? username[0].toUpperCase() : '?'}</span>
          }
          <span className="al-mobile-nav-label">Account</span>
        </button>
      </nav>

      {/* Account settings modal */}
      {showSettings && (
        <AccountSettings
          onClose={() => setShowSettings(false)}
          onChessUsernameChanged={(u, s) => {
            setShowSettings(false);
            onChessUsernameChanged?.(u, s);
          }}
        />
      )}
    </div>
  );
}
