import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'POSCI — Proof of Scientist';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 80px',
          background: '#000000',
          color: '#ffffff',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* top: brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid #ffffff',
              borderRadius: 999,
              fontSize: 38,
              fontFamily: 'Georgia, serif',
              fontWeight: 500,
              letterSpacing: '-0.04em',
            }}
          >
            Φ
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>POSCI</div>
            <div
              style={{
                display: 'flex',
                fontSize: 11,
                color: '#9ca3af',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              Proof of Scientist
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1 }} />

        {/* Editorial title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 156,
              fontWeight: 200,
              lineHeight: 0.95,
              letterSpacing: '-0.04em',
            }}
          >
            Mine the chain.
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              color: '#9ca3af',
              lineHeight: 1.4,
              maxWidth: 880,
              fontWeight: 400,
            }}
          >
            21,000,000 cap. No owner. LP burned. 95% mined via PoW in your browser.
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1 }} />

        {/* Footer hairline */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.18)',
            fontSize: 13,
            color: '#9ca3af',
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
          }}
        >
          <div style={{ display: 'flex' }}>Ethereum mainnet · Uniswap V4</div>
          <div style={{ display: 'flex' }}>scientistsdapp.x</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
