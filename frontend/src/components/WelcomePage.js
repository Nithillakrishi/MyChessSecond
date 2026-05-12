import React from 'react';
import './WelcomePage.css';

const TC_ICONS  = { bullet: '⚡', blitz: '🔥', rapid: '⏱', classical: '♟' };
const TC_COLORS = { bullet: '#E58B00', blitz: '#7FA650', rapid: '#5B9BD5', classical: '#9B59B6' };

// Semantic data colors — do NOT use --green/--gold/--red so charts stay readable in all themes
const WIN_COLOR  = '#7FA650';
const DRAW_COLOR = '#E58B00';
const LOSS_COLOR = '#C0392B';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const MAX_BAR_PX = 64;

function MiniBarChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="wp-chart-bars">
      {data.map(d => {
        const h = Math.max(4, Math.round((d.value / max) * MAX_BAR_PX));
        return (
          <div key={d.key} className="wp-chart-col">
            <div className="wp-chart-bar-wrap">
              <div
                className="wp-chart-bar"
                style={{ height: `${h}px`, background: d.color }}
                title={`${d.key}: ${d.value}`}
              />
            </div>
            <div className="wp-chart-x">{d.key}</div>
          </div>
        );
      })}
    </div>
  );
}

function WDLDonut({ wins, draws, losses }) {
  const total = wins + draws + losses || 1;
  const wp = (wins  / total) * 100;
  const dp = (draws / total) * 100;
  const lp = (losses / total) * 100;
  const r = 36, cx = 44, cy = 44, stroke = 10;
  const circ = 2 * Math.PI * r;

  function arc(pct, offset) {
    return { strokeDasharray: `${(pct / 100) * circ} ${circ}`, strokeDashoffset: -offset * circ / 100 };
  }

  return (
    <div className="wp-donut-wrap">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={WIN_COLOR}  strokeWidth={stroke}
          strokeLinecap="butt" style={arc(wp, 0)}       transform={`rotate(-90 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={DRAW_COLOR} strokeWidth={stroke}
          strokeLinecap="butt" style={arc(dp, wp)}      transform={`rotate(-90 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={LOSS_COLOR} strokeWidth={stroke}
          strokeLinecap="butt" style={arc(lp, wp + dp)} transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--cream)">
          {Math.round(wp)}%
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="var(--muted)">win rate</text>
      </svg>
      <div className="wp-donut-legend">
        <span style={{ color: WIN_COLOR  }}>■ {wins}W</span>
        <span style={{ color: DRAW_COLOR }}>■ {draws}D</span>
        <span style={{ color: LOSS_COLOR }}>■ {losses}L</span>
      </div>
    </div>
  );
}

const MODE_CARDS = [
  { id: 'coach',     icon: '♟', color: '#7FA650', gradient: 'linear-gradient(135deg,rgba(127,166,80,0.18) 0%,rgba(92,122,56,0.08) 100%)',  border: 'rgba(127,166,80,0.4)',  title: 'AI Opening Coach',   desc: 'Lines from your own game history.' },
  { id: 'explorer',  icon: '🌐', color: '#E58B00', gradient: 'linear-gradient(135deg,rgba(229,139,0,0.18) 0%,rgba(184,110,0,0.08) 100%)',   border: 'rgba(229,139,0,0.4)',   title: 'Chess Explorer',     desc: 'Global stats from ChessDB.' },
  { id: 'stockfish', icon: '⚡', color: '#5B9BD5', gradient: 'linear-gradient(135deg,rgba(91,155,213,0.18) 0%,rgba(60,110,170,0.08) 100%)',  border: 'rgba(91,155,213,0.4)',  title: 'Engine Training',    desc: 'Stockfish 3-line analysis.' },
  { id: 'opponent',  icon: '👥', color: '#C4874A', gradient: 'linear-gradient(135deg,rgba(196,135,74,0.18) 0%,rgba(160,100,50,0.08) 100%)',  border: 'rgba(196,135,74,0.4)',  title: 'vs Player Database', desc: 'Arrow-based opponent training.' },
  { id: 'position',  icon: '🎯', color: '#9B59B6', gradient: 'linear-gradient(135deg,rgba(155,89,182,0.18) 0%,rgba(120,60,150,0.08) 100%)', border: 'rgba(155,89,182,0.4)',  title: 'Custom Position',    desc: 'Load any FEN for analysis.' },
  { id: 'playvs',    icon: '♜', color: '#C0392B', gradient: 'linear-gradient(135deg,rgba(192,57,43,0.18) 0%,rgba(150,40,30,0.08) 100%)',   border: 'rgba(192,57,43,0.4)',   title: 'Play vs Stockfish',  desc: '5 difficulty levels.' },
];

export default function WelcomePage({ username, profile, onSelect, onRefresh }) {
  const wins   = profile?.wins   ?? 0;
  const draws  = profile?.draws  ?? 0;
  const losses = profile?.losses ?? 0;
  const total  = profile?.total_games ?? 0;
  const timeControls = profile?.time_controls ?? {};

  const tcEntries = Object.entries(timeControls)
    .filter(([, v]) => v.games > 0)
    .sort((a, b) => b[1].games - a[1].games);

  const tcBarData = tcEntries.map(([k, v]) => ({
    key: k.charAt(0).toUpperCase() + k.slice(1),
    value: v.games,
    color: TC_COLORS[k] || '#B58863',
  }));

  const topOpeningsWhite = profile?.top_openings_white ?? [];
  const topOpeningsBlack = profile?.top_openings_black ?? [];

  return (
    <div className="wp-root">
      <div className="wp-greeting">
        <div className="wp-greeting-glow" />
        <p className="wp-hi">{getGreeting()},</p>
        <h1 className="wp-name">{username}</h1>
        <p className="wp-tagline">good to have you here. ready to level up?</p>
        {total > 0 && onRefresh && (
          <button onClick={onRefresh} className="wp-refresh-btn" title="Refresh data from Chess.com">
            🔄 Refresh
          </button>
        )}
      </div>

      {total > 0 && (
        <div className="wp-stats-section">
          {/* Top stats row */}
          <div className="wp-stats-row">
            <div className="wp-stat-card">
              <span className="wp-stat-big">{total.toLocaleString()}</span>
              <span className="wp-stat-lbl">Games analyzed</span>
            </div>
            <div className="wp-stat-card">
              <span className="wp-stat-big" style={{ color: WIN_COLOR }}>
                {Math.round((wins / total) * 100)}%
              </span>
              <span className="wp-stat-lbl">Win rate</span>
            </div>
            <div className="wp-stat-card">
              <span className="wp-stat-big">{profile?.total_games_as_white ?? 0}</span>
              <span className="wp-stat-lbl">As White</span>
            </div>
            <div className="wp-stat-card">
              <span className="wp-stat-big">{profile?.total_games_as_black ?? 0}</span>
              <span className="wp-stat-lbl">As Black</span>
            </div>
            {profile?.avg_elo_white > 0 && (
              <div className="wp-stat-card">
                <span className="wp-stat-big">{Math.round(profile.avg_elo_white)}</span>
                <span className="wp-stat-lbl">Avg rating</span>
              </div>
            )}
          </div>

          {/* Charts row */}
          <div className="wp-charts-row">
            {/* W/D/L donut */}
            <div className="wp-chart-card">
              <div className="wp-chart-title">Overall Results</div>
              <WDLDonut wins={wins} draws={draws} losses={losses} />
            </div>

            {/* Time controls bar + detail */}
            {tcBarData.length > 0 && (
              <div className="wp-chart-card wp-chart-card-grow">
                <div className="wp-chart-title">Games by Time Control</div>
                <MiniBarChart data={tcBarData} />
                <div className="wp-tc-details">
                  {tcEntries.map(([k, v]) => (
                    <div key={k} className="wp-tc-row">
                      <span className="wp-tc-icon">{TC_ICONS[k]}</span>
                      <span className="wp-tc-name" style={{ color: TC_COLORS[k] }}>
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </span>
                      <span className="wp-tc-games">{v.games.toLocaleString()} games</span>
                      <div className="wp-tc-wdl">
                        <span style={{ color: WIN_COLOR  }}>{v.wins}W</span>
                        <span style={{ color: DRAW_COLOR }}>{v.draws}D</span>
                        <span style={{ color: LOSS_COLOR }}>{v.losses}L</span>
                      </div>
                      <div className="wp-tc-bar-outer">
                        <div className="wp-tc-bar-fill"
                          style={{ width: `${v.win_rate}%`, background: TC_COLORS[k] || WIN_COLOR }} />
                      </div>
                      <span className="wp-tc-wr" style={{ color: WIN_COLOR }}>{v.win_rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top openings as White */}
            {topOpeningsWhite.length > 0 && (
              <div className="wp-chart-card wp-chart-card-grow">
                <div className="wp-chart-title">Your Openings (as White)</div>
                <div className="wp-tc-details">
                  {topOpeningsWhite.map(o => (
                    <div key={o.name} className="wp-tc-row">
                      <span className="wp-opening-name">{o.name}</span>
                      <span className="wp-tc-games">{o.games.toLocaleString()} games</span>
                      <div className="wp-tc-wdl">
                        <span style={{ color: WIN_COLOR  }}>{o.wins}W</span>
                        <span style={{ color: DRAW_COLOR }}>{o.draws}D</span>
                        <span style={{ color: LOSS_COLOR }}>{o.losses}L</span>
                      </div>
                      <div className="wp-tc-bar-outer">
                        <div className="wp-tc-bar-fill" style={{ width: `${o.win_rate}%`, background: WIN_COLOR }} />
                      </div>
                      <span className="wp-tc-wr" style={{ color: WIN_COLOR }}>{o.win_rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top openings as Black */}
            {topOpeningsBlack.length > 0 && (
              <div className="wp-chart-card wp-chart-card-grow">
                <div className="wp-chart-title">Your Openings (as Black)</div>
                <div className="wp-tc-details">
                  {topOpeningsBlack.map(o => (
                    <div key={o.name} className="wp-tc-row">
                      <span className="wp-opening-name">{o.name}</span>
                      <span className="wp-tc-games">{o.games.toLocaleString()} games</span>
                      <div className="wp-tc-wdl">
                        <span style={{ color: WIN_COLOR  }}>{o.wins}W</span>
                        <span style={{ color: DRAW_COLOR }}>{o.draws}D</span>
                        <span style={{ color: LOSS_COLOR }}>{o.losses}L</span>
                      </div>
                      <div className="wp-tc-bar-outer">
                        <div className="wp-tc-bar-fill" style={{ width: `${o.win_rate}%`, background: '#5B9BD5' }} />
                      </div>
                      <span className="wp-tc-wr" style={{ color: '#5B9BD5' }}>{o.win_rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode cards */}
      <div className="wp-section-label">Choose your training mode</div>
      <div className="wp-cards">
        {MODE_CARDS.map(card => (
          <button
            key={card.id}
            className="wp-card"
            style={{ background: card.gradient, borderColor: card.border }}
            onClick={() => onSelect(card.id)}
          >
            <div className="wp-card-icon" style={{ color: card.color }}>{card.icon}</div>
            <div className="wp-card-body">
              <h3 style={{ color: card.color }}>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
