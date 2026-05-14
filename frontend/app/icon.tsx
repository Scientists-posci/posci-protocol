import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
          color: '#ffffff',
          fontSize: 48,
          fontWeight: 500,
          fontFamily: 'Georgia, serif',
          letterSpacing: '-0.04em',
          border: '2px solid #ffffff',
          borderRadius: 64,
        }}
      >
        Φ
      </div>
    ),
    { ...size },
  );
}
