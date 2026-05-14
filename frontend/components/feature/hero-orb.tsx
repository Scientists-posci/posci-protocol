'use client';

import { motion } from 'framer-motion';

/**
 * Glowing core orb — pure CSS/SVG, no 3D library, no canvas.
 * 4 stacked layers:
 *   1. Outer atmospheric glow (huge soft blur)
 *   2. Mid-distance corona
 *   3. The orb body — radial gradient with bright top, dark equator
 *   4. Thin grid-mesh overlay clipped to the orb (suggests "scientific instrument")
 *
 * Two thin wireframe rings around it, tilted, slowly rotating.
 */
export function HeroOrb({ size = 520 }: { size?: number }) {
  return (
    <div
      className="pointer-events-none relative"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Outer atmospheric haze */}
      <div
        className="absolute inset-0 rounded-full drift"
        style={{
          background:
            'radial-gradient(circle, rgba(180,220,255,0.18), rgba(140,150,255,0.07) 45%, transparent 70%)',
          filter: 'blur(36px)',
        }}
      />

      {/* Mid corona */}
      <div
        className="absolute inset-[12%] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 55%, transparent 70%)',
          filter: 'blur(14px)',
        }}
      />

      {/* The orb body */}
      <div
        className="absolute inset-[22%] rounded-full overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 35% 25%, #f6f7fb 0%, #cdd6e3 6%, #4a5363 30%, #0e1116 65%, #050608 100%)',
          boxShadow:
            'inset 0 0 60px rgba(0,0,0,0.7), inset 0 -30px 60px rgba(0,0,0,0.85), 0 0 80px rgba(160, 200, 255, 0.25)',
        }}
      >
        {/* Grid-mesh clipped inside the orb — like a wireframe planet */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 opacity-25 spin-slow">
          {Array.from({ length: 9 }).map((_, i) => (
            <ellipse
              key={`v${i}`}
              cx="50"
              cy="50"
              rx={5 + i * 5}
              ry="50"
              fill="none"
              stroke="rgba(220,235,255,0.55)"
              strokeWidth="0.18"
            />
          ))}
          {Array.from({ length: 9 }).map((_, i) => (
            <ellipse
              key={`h${i}`}
              cx="50"
              cy="50"
              rx="50"
              ry={5 + i * 5}
              fill="none"
              stroke="rgba(220,235,255,0.45)"
              strokeWidth="0.18"
            />
          ))}
        </svg>

        {/* Specular highlight at top */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 35% at 50% 12%, rgba(255,255,255,0.45), transparent 70%)',
          }}
        />
      </div>

      {/* Tilted thin orbital ring 1 */}
      <motion.svg
        viewBox="0 0 200 200"
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      >
        <ellipse
          cx="100"
          cy="100"
          rx="88"
          ry="22"
          fill="none"
          stroke="rgba(220,235,255,0.18)"
          strokeWidth="0.5"
          transform="rotate(-18 100 100)"
        />
      </motion.svg>

      {/* Tilted thin orbital ring 2, opposite direction */}
      <motion.svg
        viewBox="0 0 200 200"
        className="absolute inset-0"
        animate={{ rotate: -360 }}
        transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
      >
        <ellipse
          cx="100"
          cy="100"
          rx="92"
          ry="14"
          fill="none"
          stroke="rgba(180,200,255,0.12)"
          strokeWidth="0.4"
          transform="rotate(42 100 100)"
        />
      </motion.svg>
    </div>
  );
}
