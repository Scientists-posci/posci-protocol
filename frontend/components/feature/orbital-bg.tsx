/**
 * Background atmosphere — Starlink-inflected.
 *
 * No bouncy rings, no aurora. A subtle hairline grid at low opacity that
 * suggests "technical / scientific instrument", and a horizon-style vignette
 * fade. Pure CSS, no animation.
 */
export function OrbitalBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Faint hairline grid — very subtle, just texture */}
      <div className="absolute inset-0 hairlines opacity-25" />
      {/* Star-field — sparse fixed dots */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.55) 0.6px, transparent 1px)',
          backgroundSize: '180px 180px',
          backgroundPosition: '0 0',
        }}
      />
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.8) 0.5px, transparent 1px)',
          backgroundSize: '60px 60px',
          backgroundPosition: '23px 41px',
        }}
      />
      {/* Bottom void fade — focuses attention upward */}
      <div
        className="absolute inset-x-0 bottom-0 h-[35vh]"
        style={{
          background:
            'linear-gradient(to top, hsl(220 10% 3%), hsl(220 10% 3% / 0.6) 30%, transparent 100%)',
        }}
      />
    </div>
  );
}
