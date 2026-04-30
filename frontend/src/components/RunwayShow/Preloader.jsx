export default function Preloader({ message = 'Preparing the runway…' }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: '13px',
        letterSpacing: '0.35em',
        textTransform: 'uppercase',
        fontFamily: "'Inter', system-ui, sans-serif",
        fontWeight: 500,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {message}
    </div>
  );
}
