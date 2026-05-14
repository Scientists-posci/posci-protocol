/**
 * Monochrome POSCI brand mark — Starlink-inflected.
 *
 * Variants:
 *   default  — thin white outline of a circle with Φ glyph in the middle.
 *   solid    — solid white block, black Φ inside (high-contrast inverse).
 *   orbital  — outline circle + a single thin tilted ring (hero use).
 *
 * Pure SVG, no gradient, no glow. Lives well at any size from 16px to 1024px.
 */
type Props = {
  size?: number | string;
  className?: string;
  variant?: 'default' | 'solid' | 'orbital';
  stroke?: number;
};

export function PosciLogo({
  size = 40,
  className,
  variant = 'default',
  stroke = 1.5,
}: Props) {
  const isSolid = variant === 'solid';
  const isOrbital = variant === 'orbital';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-label="POSCI"
      role="img"
    >
      {/* Body */}
      {isSolid ? (
        <circle cx="50" cy="50" r="48" fill="currentColor" />
      ) : (
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
        />
      )}

      {/* Optional thin orbital ring — hero variant */}
      {isOrbital && (
        <g transform="rotate(-22 50 50)">
          <ellipse
            cx="50"
            cy="50"
            rx="46"
            ry="14"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.55"
            strokeWidth={stroke}
          />
          <circle cx="4" cy="50" r="1.6" fill="currentColor" />
        </g>
      )}

      {/* Φ glyph */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="500"
        fontSize="58"
        fill={isSolid ? 'black' : 'currentColor'}
      >
        Φ
      </text>
    </svg>
  );
}
