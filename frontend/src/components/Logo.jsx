export function Logo({ size = 40, className = "" }) {
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size, color: "hsl(32 95% 44%)" }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke="currentColor">
        <polygon
          points="50 3, 93 28, 93 72, 50 97, 7 72, 7 28"
          stroke="currentColor"
          strokeWidth="6"
          fill="hsl(40 100% 97%)"
          strokeLinejoin="round"
        />
        <ellipse cx="50" cy="56" rx="14" ry="20" fill="currentColor" />
        <path d="M 37 50 L 63 50 M 37 62 L 63 62" stroke="hsl(40 100% 97%)" strokeWidth="3" />
        <path
          d="M 50 40 C 30 22, 16 36, 36 50 M 50 40 C 70 22, 84 36, 64 50"
          fill="hsl(40 100% 92% / 0.85)"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="50" cy="28" r="5" fill="currentColor" />
      </svg>
    </span>
  );
}

export function BrandMark({ subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={42} />
      <div className="leading-tight">
        <div className="font-display text-lg font-semibold tracking-tight text-foreground">
          HoneyBee
        </div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {subtitle || "Physiotherapy Centre"}
        </div>
      </div>
    </div>
  );
}
