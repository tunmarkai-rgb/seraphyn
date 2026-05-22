export default function BrandLogo({
  tone = 'dark',
  size = 40,
  showWordmark = true,
  showTagline = false,
  align = 'left',
}) {
  const lightTone = tone === 'light'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: showWordmark ? '12px' : '0',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${size + 22}px`,
          height: `${size + 22}px`,
          borderRadius: '50%',
          background: lightTone ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.98)',
          border: lightTone ? '1px solid rgba(255,255,255,0.26)' : '1px solid rgba(44,62,80,0.10)',
          boxShadow: lightTone ? '0 12px 28px rgba(6,16,26,0.18)' : '0 10px 24px rgba(44,62,80,0.08)',
          overflow: 'hidden',
          flexShrink: 0
        }}
      >
        <img
          src="/logo.png"
          alt="Seraphyn"
          style={{ height: `${size}px`, width: 'auto', objectFit: 'contain', display: 'block' }}
        />
      </span>
      {showWordmark && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: size >= 40 ? '24px' : '20px',
              color: lightTone ? 'var(--warm-white)' : 'var(--deep-navy)',
              letterSpacing: '0.02em',
            }}
          >
            Seraphyn
          </span>
          {showTagline && (
            <span
              style={{
                marginTop: '5px',
                fontSize: '10px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: lightTone ? 'rgba(245,245,240,0.55)' : 'var(--text-muted)',
              }}
            >
              Healthcare Staffing
            </span>
          )}
        </span>
      )}
    </span>
  )
}
