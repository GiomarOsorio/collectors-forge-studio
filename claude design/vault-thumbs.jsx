// vault-thumbs.jsx — SVG iso "model" thumbnails for the Vault library.
// Pure SVG, no real geometry — each shape code maps to a stylized iso silhouette
// on a build plate, rendered in the spool tone the model is associated with.
// Exposes <VaultThumb shape={shape} tone={tone} ... />

function VaultThumb({ shape, tone = '#A78BFA', size = 'card' }) {
  // Three size presets — preview-sized SVG with consistent ratio.
  const dims = {
    card:  { w: 280, h: 170 },
    grid:  { w: 220, h: 140 },
    sheet: { w: 360, h: 200 },
  }[size] || { w: 280, h: 170 };

  const W = dims.w, H = dims.h;
  const cx = W / 2;
  const cy = H * 0.62;

  // helper to build iso build plate
  const plate = (px = 0.42, py = 0.18) => {
    const pw = W * px;   // half-width of plate
    const ph = W * py;   // half-height (depth) of plate
    return [
      [cx - pw, cy + ph * 0.5],
      [cx, cy + ph],
      [cx + pw, cy + ph * 0.5],
      [cx, cy],
    ];
  };

  const platePts = plate();
  const platePath = `M ${platePts.map((p) => p.join(',')).join(' L ')} Z`;

  // shape-specific silhouette content
  const content = (() => {
    switch (shape) {
      case 'dragon':
      case 'mini':
        // tall iso prism, tapered
        return (
          <polygon
            points={[
              [cx - W * 0.18, cy],
              [cx, cy - H * 0.06],
              [cx + W * 0.18, cy],
              [cx + W * 0.08, cy - H * 0.55],
              [cx, cy - H * 0.62],
              [cx - W * 0.08, cy - H * 0.55],
            ].map((p) => p.join(',')).join(' ')}
            fill={`url(#vt-grad-${shape})`}
            stroke={tone}
            strokeWidth="1"
            opacity="0.95"
          />
        );
      case 'planter':
        // shorter wider hexagonal-ish pot
        return (
          <React.Fragment>
            <polygon
              points={[
                [cx - W * 0.22, cy],
                [cx, cy + 4],
                [cx + W * 0.22, cy],
                [cx + W * 0.18, cy - H * 0.32],
                [cx, cy - H * 0.36],
                [cx - W * 0.18, cy - H * 0.32],
              ].map((p) => p.join(',')).join(' ')}
              fill={`url(#vt-grad-${shape})`}
              stroke={tone}
              strokeWidth="1"
            />
            {/* a hint of foliage */}
            <circle cx={cx - 8} cy={cy - H * 0.4} r="10" fill={tone} opacity="0.55" />
            <circle cx={cx + 6} cy={cy - H * 0.44} r="7"  fill={tone} opacity="0.45" />
          </React.Fragment>
        );
      case 'bracket':
        // L-shape
        return (
          <polygon
            points={[
              [cx - W * 0.22, cy + 4],
              [cx + W * 0.06, cy + 4],
              [cx + W * 0.06, cy - H * 0.06],
              [cx + W * 0.22, cy - H * 0.06],
              [cx + W * 0.22, cy - H * 0.32],
              [cx - W * 0.22, cy - H * 0.32],
            ].map((p) => p.join(',')).join(' ')}
            fill={`url(#vt-grad-${shape})`}
            stroke={tone}
            strokeWidth="1"
          />
        );
      case 'hex':
        // long hex grip
        return (
          <polygon
            points={[
              [cx - W * 0.28, cy - H * 0.1],
              [cx - W * 0.22, cy - H * 0.18],
              [cx + W * 0.22, cy - H * 0.18],
              [cx + W * 0.28, cy - H * 0.1],
              [cx + W * 0.22, cy - H * 0.02],
              [cx - W * 0.22, cy - H * 0.02],
            ].map((p) => p.join(',')).join(' ')}
            fill={`url(#vt-grad-${shape})`}
            stroke={tone}
            strokeWidth="1"
          />
        );
      case 'gear':
        // pseudo-iso gear (cog top view tilted)
        return (
          <g transform={`translate(${cx}, ${cy - H * 0.22})`}>
            <g transform="rotate(0)">
              {[...Array(10)].map((_, i) => {
                const a = (i / 10) * Math.PI * 2;
                const r1 = W * 0.18, r2 = W * 0.22;
                const x1 = Math.cos(a) * r2;
                const y1 = Math.sin(a) * r2 * 0.45;
                const w = 6;
                return (
                  <rect key={i}
                    x={-w / 2} y={-r2 - 4} width={w} height={(r2 - r1) + 4}
                    fill={tone} opacity="0.85"
                    transform={`rotate(${(i / 10) * 360})`}
                  />
                );
              })}
              <ellipse rx={W * 0.18} ry={W * 0.18 * 0.45} fill={`url(#vt-grad-${shape})`} stroke={tone} strokeWidth="1" />
              <ellipse rx={W * 0.06} ry={W * 0.06 * 0.45} fill="var(--surf-card-2)" stroke={tone} strokeWidth="0.8" opacity="0.7" />
            </g>
          </g>
        );
      case 'ring':
        // lattice ring (top)
        return (
          <g transform={`translate(${cx}, ${cy - H * 0.22})`}>
            <ellipse rx={W * 0.16} ry={W * 0.16 * 0.4} fill="none" stroke={tone} strokeWidth="6" opacity="0.85" />
            <ellipse rx={W * 0.16} ry={W * 0.16 * 0.4} fill="none" stroke={`url(#vt-grad-${shape})`} strokeWidth="2" />
            {/* lattice cross-marks */}
            {[...Array(12)].map((_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <line key={i}
                  x1={Math.cos(a) * W * 0.13} y1={Math.sin(a) * W * 0.13 * 0.4}
                  x2={Math.cos(a) * W * 0.19} y2={Math.sin(a) * W * 0.19 * 0.4}
                  stroke={tone} strokeWidth="1" opacity="0.6"
                />
              );
            })}
          </g>
        );
      case 'phone':
        // angled phone stand
        return (
          <polygon
            points={[
              [cx - W * 0.16, cy - 2],
              [cx + W * 0.12, cy - 2],
              [cx + W * 0.16, cy - H * 0.5],
              [cx - W * 0.04, cy - H * 0.42],
            ].map((p) => p.join(',')).join(' ')}
            fill={`url(#vt-grad-${shape})`}
            stroke={tone} strokeWidth="1"
          />
        );
      case 'lattice':
        // open lattice cube
        return (
          <g transform={`translate(${cx - W * 0.18}, ${cy - H * 0.42})`}>
            {[...Array(4)].map((_, r) => [...Array(4)].map((__, c) => (
              <rect key={`${r}-${c}`}
                x={c * (W * 0.09)} y={r * (H * 0.1)}
                width={W * 0.07} height={H * 0.08}
                fill="none" stroke={tone} strokeWidth="1.2" opacity="0.85"
              />
            )))}
            <rect x="0" y="0" width={W * 0.36} height={H * 0.4} fill={`url(#vt-grad-${shape})`} opacity="0.3" />
          </g>
        );
      case 'logo':
        // flat plate with embossed circle
        return (
          <g>
            <rect x={cx - W * 0.22} y={cy - H * 0.22} width={W * 0.44} height={H * 0.18}
              fill={`url(#vt-grad-${shape})`} stroke={tone} strokeWidth="1" rx="4" />
            <circle cx={cx} cy={cy - H * 0.13} r={H * 0.06} fill="none" stroke={tone} strokeWidth="2" />
            <circle cx={cx} cy={cy - H * 0.13} r={H * 0.025} fill={tone} />
          </g>
        );
      case 'tube':
        // little cylinder
        return (
          <g transform={`translate(${cx}, ${cy - H * 0.18})`}>
            <ellipse rx={W * 0.08} ry={W * 0.08 * 0.4} fill={tone} opacity="0.6" />
            <rect x={-W * 0.08} y="0" width={W * 0.16} height={H * 0.16}
              fill={`url(#vt-grad-${shape})`} stroke={tone} strokeWidth="1" />
            <ellipse cy={H * 0.16} rx={W * 0.08} ry={W * 0.08 * 0.4} fill={tone} opacity="0.9" />
          </g>
        );
      case 'organizer':
        // grid of compartments
        return (
          <g>
            <rect x={cx - W * 0.3} y={cy - H * 0.32} width={W * 0.6} height={H * 0.3}
              fill={`url(#vt-grad-${shape})`} stroke={tone} strokeWidth="1" rx="3" />
            {[...Array(3)].map((_, r) => [...Array(5)].map((__, c) => (
              <rect key={`${r}-${c}`}
                x={cx - W * 0.3 + 6 + c * ((W * 0.6 - 12) / 5)}
                y={cy - H * 0.32 + 4 + r * ((H * 0.3 - 8) / 3)}
                width={(W * 0.6 - 12) / 5 - 2}
                height={(H * 0.3 - 8) / 3 - 2}
                fill="none" stroke={tone} strokeWidth="0.6" opacity="0.6"
              />
            )))}
          </g>
        );
      case 'cliff':
        // wide low slab
        return (
          <polygon
            points={[
              [cx - W * 0.32, cy + 2],
              [cx + W * 0.32, cy + 2],
              [cx + W * 0.32, cy - H * 0.18],
              [cx - W * 0.32, cy - H * 0.18],
            ].map((p) => p.join(',')).join(' ')}
            fill={`url(#vt-grad-${shape})`}
            stroke={tone} strokeWidth="1"
          />
        );
      case 'spool':
        // flat tray with circular wells
        return (
          <g>
            <rect x={cx - W * 0.3} y={cy - H * 0.18} width={W * 0.6} height={H * 0.18}
              fill={`url(#vt-grad-${shape})`} stroke={tone} strokeWidth="1" rx="6" />
            {[0.25, 0.5, 0.75].map((t, i) => (
              <circle key={i}
                cx={cx - W * 0.3 + W * 0.6 * t}
                cy={cy - H * 0.09}
                r={H * 0.06}
                fill="none" stroke={tone} strokeWidth="1.5" opacity="0.7"
              />
            ))}
          </g>
        );
      default:
        // generic box
        return (
          <polygon
            points={[
              [cx - W * 0.18, cy],
              [cx, cy + 4],
              [cx + W * 0.18, cy],
              [cx + W * 0.16, cy - H * 0.4],
              [cx, cy - H * 0.44],
              [cx - W * 0.16, cy - H * 0.4],
            ].map((p) => p.join(',')).join(' ')}
            fill={`url(#vt-grad-${shape})`}
            stroke={tone} strokeWidth="1"
          />
        );
    }
  })();

  // unique-id suffix per render so duplicate gradient ids don't collide
  const id = React.useId ? React.useId().replace(/:/g, '') : Math.random().toString(36).slice(2);
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`vt-plate-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A2030" />
          <stop offset="100%" stopColor="#0F1219" />
        </linearGradient>
        <linearGradient id={`vt-grad-${shape}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.92" />
          <stop offset="100%" stopColor={tone} stopOpacity="0.5" />
        </linearGradient>
        <pattern id={`vt-grid-${id}`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="matrix(1.2, 0.55, -1.2, 0.55, 0, 0)">
          <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#2a3142" strokeWidth="0.4" />
        </pattern>
      </defs>

      {/* glow tint behind */}
      <circle cx={cx} cy={cy - H * 0.18} r={W * 0.36}
        fill={`url(#vt-glow-${id})`} opacity="0.4" />
      <defs>
        <radialGradient id={`vt-glow-${id}`}>
          <stop offset="0%" stopColor={tone} stopOpacity="0.4" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* plate */}
      <path d={platePath} fill={`url(#vt-plate-${id})`} stroke="#2a3142" strokeWidth="0.8" />
      <path d={platePath} fill={`url(#vt-grid-${id})`} opacity="0.6" />

      {/* origin marker */}
      <circle cx={platePts[0][0] + 6} cy={platePts[0][1] - 1} r="1.5" fill="#F59E0B" />

      {/* model */}
      {content}
    </svg>
  );
}

Object.assign(window, { VaultThumb });
