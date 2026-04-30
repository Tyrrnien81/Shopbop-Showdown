import { lazy, Suspense, useEffect, useState } from 'react';
import { historyApi, outfitApi } from '../../services/api';

const RunwayShow = lazy(() => import('./RunwayShow'));

function mapOutfit(o, fallbackName) {
  return {
    tryOnImageUrl: o.tryOnImageUrl,
    playerName: o.playerName || o.username || fallbackName || 'Contestant',
    totalCost: typeof o.totalPrice === 'number' ? o.totalPrice : 0,
    itemCount: Array.isArray(o.products) ? o.products.length : 0,
    playerId: o.playerId || o.outfitId,
  };
}

async function findRealOutfits() {
  // Scan Hall of Fame history for a recent game whose outfits have S3 images.
  const historyRes = await historyApi.getHistory();
  const entries = historyRes?.data?.history || historyRes?.data?.games || historyRes?.data || [];
  for (const entry of entries) {
    const gameId = entry.gameId || entry.id;
    if (!gameId) continue;
    try {
      const outfitsRes = await outfitApi.getOutfits(gameId);
      const outfits = (outfitsRes?.data?.outfits || []).filter(o => o.tryOnImageUrl);
      if (outfits.length > 0) {
        return {
          gameId,
          theme: entry.themeName || entry.theme || 'Runway',
          outfits,
        };
      }
    } catch {
      /* skip and try the next game */
    }
  }
  return null;
}

const wrapperStyle = {
  minHeight: '100vh',
  background: '#0a0a0a',
  color: 'white',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Inter', system-ui, sans-serif",
  padding: '40px 24px',
  gap: '24px',
};

const labelStyle = {
  fontSize: '12px',
  letterSpacing: '0.25em',
  textTransform: 'uppercase',
  color: 'rgba(255, 255, 255, 0.55)',
};

const inputStyle = {
  width: 'min(520px, 80vw)',
  padding: '10px 14px',
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  borderRadius: '4px',
  color: 'white',
  fontSize: '13px',
  fontFamily: 'inherit',
};

const buttonStyle = {
  padding: '10px 24px',
  background: 'white',
  color: '#0a0a0a',
  border: 'none',
  borderRadius: '999px',
  fontSize: '12px',
  letterSpacing: '0.25em',
  textTransform: 'uppercase',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

export default function RunwayPreview() {
  const [status, setStatus] = useState('loading'); // loading | ready | empty | error
  const [payload, setPayload] = useState(null); // { outfits, theme, gameId }
  const [errorMessage, setErrorMessage] = useState('');
  const [manualUrl, setManualUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    findRealOutfits()
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          setStatus('empty');
          return;
        }
        setPayload({
          outfits: found.outfits.map(o => mapOutfit(o)),
          theme: found.theme,
          gameId: found.gameId,
        });
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Runway preview fetch failed:', err);
        setErrorMessage(err?.message || 'Request failed');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const playManual = () => {
    const url = manualUrl.trim();
    if (!url) return;
    setPayload({
      outfits: [mapOutfit({ tryOnImageUrl: url, playerName: 'Manual Test' })],
      theme: 'Manual Test',
      gameId: 'manual',
    });
    setStatus('ready');
  };

  const resetToChooser = () => {
    setStatus('empty');
    setPayload(null);
  };

  if (status === 'ready' && payload) {
    return (
      <Suspense fallback={<div style={{ height: '100vh', background: '#0a0a0a' }} />}>
        <RunwayShow
          outfits={payload.outfits}
          theme={payload.theme}
          onComplete={resetToChooser}
        />
      </Suspense>
    );
  }

  return (
    <div style={wrapperStyle}>
      <h1
        style={{
          margin: 0,
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(28px, 4vw, 40px)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontWeight: 400,
        }}
      >
        Runway Preview
      </h1>

      {status === 'loading' && (
        <div style={labelStyle}>Looking for recent outfits…</div>
      )}

      {status === 'empty' && (
        <div style={{ ...labelStyle, textAlign: 'center', maxWidth: '520px', lineHeight: 1.6 }}>
          No outfits with images found. Play a game first and submit outfits, or paste an S3 image URL below to preview the runway.
        </div>
      )}

      {status === 'error' && (
        <div style={{ ...labelStyle, color: '#f08080', textAlign: 'center' }}>
          Couldn't reach the backend: {errorMessage}. Paste an S3 image URL below to preview the runway.
        </div>
      )}

      {(status === 'empty' || status === 'error') && (
        <>
          <label style={labelStyle} htmlFor="runway-preview-url">
            Try-on image URL
          </label>
          <input
            id="runway-preview-url"
            type="url"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && playManual()}
            placeholder="https://shopbop-showdown-outfits.s3.us-east-1.amazonaws.com/outfits/…"
            style={inputStyle}
          />
          <button type="button" onClick={playManual} style={buttonStyle}>
            Play
          </button>
        </>
      )}
    </div>
  );
}
