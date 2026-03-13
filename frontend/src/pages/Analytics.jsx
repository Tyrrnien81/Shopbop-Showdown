import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

function makeAuthHeader(username, password) {
  return 'Basic ' + btoa(`${username}:${password}`);
}

// ------------------------------------------------------------
// Login Gate
// ------------------------------------------------------------

function LoginGate({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/analytics`, {
        headers: { Authorization: makeAuthHeader(username, password) },
      });
      if (res.status === 401) {
        setError('Invalid username or password.');
        return;
      }
      if (!res.ok) {
        setError('Server error. Try again.');
        return;
      }
      const data = await res.json();
      onSuccess(username, password, data);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.loginWrap}>
      <div style={styles.loginCard}>
        <h1 style={styles.loginTitle}>ShopBop Showdown</h1>
        <p style={styles.loginSub}>Dev Analytics — Team Access Only</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------

function Panel({ title, children }) {
  return (
    <div style={styles.panel}>
      <h2 style={styles.panelTitle}>{title}</h2>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
      {sub && <div style={styles.statSub}>{sub}</div>}
    </div>
  );
}

function BarRow({ label, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={styles.barRow}>
      <span style={styles.barLabel}>{label}</span>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${pct}%` }} />
      </div>
      <span style={styles.barCount}>{count}</span>
    </div>
  );
}

function formatDuration(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// ------------------------------------------------------------
// Game Stats Panel
// ------------------------------------------------------------

function GameStatsPanel({ gameStats }) {
  const g = gameStats;

  const themeEntries = Object.entries(g.byTheme).sort((a, b) => b[1] - a[1]);
  const maxTheme = themeEntries[0]?.[1] || 1;

  const statusEntries = Object.entries(g.byStatus).sort((a, b) => b[1] - a[1]);
  const maxStatus = statusEntries[0]?.[1] || 1;

  const timeEntries = Object.entries(g.gamesOverTime).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDay = Math.max(...timeEntries.map(([, v]) => v), 1);

  return (
    <Panel title="Game Stats">
      {/* Top-line numbers */}
      <div style={styles.statRow}>
        <StatCard label="Total Games" value={g.totalGames} />
        <StatCard label="Completion Rate" value={`${g.completionRate}%`} />
        <StatCard label="Avg Players / Game" value={g.avgPlayersPerGame} />
        <StatCard
          label="Avg Game Duration"
          value={formatDuration(g.avgDurationSeconds)}
          sub="completed games only"
        />
        <StatCard label="Solo" value={g.soloVsMultiplayer.solo} sub="single-player" />
        <StatCard label="Multiplayer" value={g.soloVsMultiplayer.multiplayer} />
      </div>

      <div style={styles.twoCol}>
        {/* Theme breakdown */}
        <div>
          <h3 style={styles.subHeading}>Games by Theme</h3>
          {themeEntries.length === 0
            ? <p style={styles.empty}>No data yet.</p>
            : themeEntries.map(([theme, count]) => (
                <BarRow key={theme} label={theme} count={count} max={maxTheme} />
              ))
          }
        </div>

        {/* Status breakdown */}
        <div>
          <h3 style={styles.subHeading}>Games by Status</h3>
          {statusEntries.length === 0
            ? <p style={styles.empty}>No data yet.</p>
            : statusEntries.map(([status, count]) => (
                <BarRow key={status} label={status} count={count} max={maxStatus} />
              ))
          }
        </div>
      </div>

      {/* Games over time */}
      {timeEntries.length > 0 && (
        <>
          <h3 style={{ ...styles.subHeading, marginTop: 28 }}>Games Created Per Day</h3>
          <div style={styles.timeGrid}>
            {timeEntries.map(([day, count]) => (
              <BarRow key={day} label={day} count={count} max={maxDay} />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------
// Dashboard shell
// ------------------------------------------------------------

function Dashboard({ data, onLogout }) {
  const { gameStats } = data;
  return (
    <div style={styles.dashWrap}>
      <header style={styles.header}>
        <span style={styles.headerTitle}>ShopBop Showdown — Analytics</span>
        <button style={styles.logoutBtn} onClick={onLogout}>Sign out</button>
      </header>
      <main style={styles.main}>
        <GameStatsPanel gameStats={gameStats} />
        {/* Product panels added in commits 9–10 */}
      </main>
    </div>
  );
}

// ------------------------------------------------------------
// Page root
// ------------------------------------------------------------

export default function Analytics() {
  const [creds, setCreds] = useState(null);   // { username, password }
  const [data, setData] = useState(null);

  function handleSuccess(username, password, initialData) {
    setCreds({ username, password });
    setData(initialData);
  }

  function handleLogout() {
    setCreds(null);
    setData(null);
  }

  if (!creds) return <LoginGate onSuccess={handleSuccess} />;
  return <Dashboard data={data} onLogout={handleLogout} />;
}

// ------------------------------------------------------------
// Inline styles (keeps this page self-contained)
// ------------------------------------------------------------

const styles = {
  loginWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-cream)',
  },
  loginCard: {
    background: 'var(--bg-white)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    padding: '40px 36px',
    width: '100%',
    maxWidth: 400,
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
    color: 'var(--text-dark)',
  },
  loginSub: {
    fontSize: 13,
    color: 'var(--text-muted)',
    marginBottom: 28,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-dark)',
    marginTop: 10,
  },
  input: {
    padding: '10px 12px',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    outline: 'none',
  },
  error: {
    fontSize: 13,
    color: 'var(--error)',
    marginTop: 6,
  },
  btn: {
    marginTop: 20,
    padding: '12px',
    background: 'var(--primary-orange)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  dashWrap: {
    minHeight: '100vh',
    background: 'var(--bg-cream)',
  },
  header: {
    background: 'var(--bg-white)',
    borderBottom: '1px solid var(--border-light)',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: 16,
    color: 'var(--text-dark)',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 14px',
    fontSize: 13,
    cursor: 'pointer',
    color: 'var(--text-muted)',
  },
  main: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '32px 24px',
  },
  panel: {
    background: 'var(--bg-white)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    padding: '28px 32px',
    marginBottom: 24,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 20,
    color: 'var(--text-dark)',
  },
  statRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 28,
  },
  statCard: {
    flex: '1 1 120px',
    background: 'var(--bg-cream)',
    borderRadius: 'var(--radius-md)',
    padding: '16px 20px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--primary-orange)',
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-dark)',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statSub: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 32,
  },
  subHeading: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-muted)',
    marginBottom: 12,
  },
  barRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  barLabel: {
    width: 160,
    fontSize: 13,
    color: 'var(--text-dark)',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  barTrack: {
    flex: 1,
    height: 8,
    background: 'var(--bg-cream)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'var(--primary-orange)',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  barCount: {
    width: 32,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-dark)',
    textAlign: 'right',
    flexShrink: 0,
  },
  timeGrid: {
    columns: 2,
    gap: 8,
  },
  empty: {
    fontSize: 13,
    color: 'var(--text-muted)',
  },
};
