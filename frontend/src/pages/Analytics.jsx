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
// Dashboard shell (populated in later commits)
// ------------------------------------------------------------

function Dashboard({ data, onLogout }) {
  return (
    <div style={styles.dashWrap}>
      <header style={styles.header}>
        <span style={styles.headerTitle}>ShopBop Showdown — Analytics</span>
        <button style={styles.logoutBtn} onClick={onLogout}>Sign out</button>
      </header>
      <main style={styles.main}>
        {/* Panels added in commits 8–10 */}
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 48 }}>
          Dashboard loading…
        </p>
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
};
