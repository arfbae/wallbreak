// SVG debug overlay visualizing detected wall plane, vanishing lines,
// mural placement quad, and foreground occluder regions per scene.
// Coordinates are in a 0–100 viewBox so the overlay scales with the slot.

type SceneId = "container" | "corner" | "concrete";

type DebugMap = {
  wallQuad: [number, number][]; // 4 pts — detected paintable plane
  muralQuad: [number, number][]; // 4 pts — mural placement bounds
  vanishing: { from: [number, number]; to: [number, number] }[];
  occluders: { points: [number, number][]; label: string }[];
  vp: [number, number]; // vanishing point
};

const DEBUG: Record<SceneId, DebugMap> = {
  container: {
    wallQuad: [
      [8, 22],
      [92, 14],
      [94, 86],
      [6, 80],
    ],
    muralQuad: [
      [18, 32],
      [82, 26],
      [84, 74],
      [16, 70],
    ],
    vanishing: [
      { from: [8, 22], to: [120, 50] },
      { from: [6, 80], to: [120, 50] },
    ],
    occluders: [],
    vp: [120, 50],
  },
  corner: {
    wallQuad: [
      [4, 18],
      [52, 28],
      [52, 86],
      [4, 92],
    ],
    muralQuad: [
      [10, 26],
      [50, 34],
      [50, 80],
      [10, 84],
      [96, 26],
      [54, 34],
      [54, 80],
      [96, 30],
    ],
    vanishing: [
      { from: [4, 18], to: [-30, 55] },
      { from: [4, 92], to: [-30, 55] },
      { from: [96, 22], to: [130, 55] },
      { from: [96, 90], to: [130, 55] },
    ],
    occluders: [],
    vp: [52, 55],
  },
  concrete: {
    wallQuad: [
      [4, 10],
      [96, 14],
      [96, 88],
      [4, 92],
    ],
    muralQuad: [
      [14, 22],
      [88, 24],
      [88, 80],
      [14, 82],
    ],
    vanishing: [
      { from: [4, 10], to: [50, 50] },
      { from: [96, 14], to: [50, 50] },
    ],
    occluders: [
      {
        label: "Utility Pole",
        points: [
          [38, 4],
          [44, 4],
          [46, 98],
          [36, 98],
        ],
      },
      {
        label: "Power Lines",
        points: [
          [0, 28],
          [100, 22],
          [100, 25],
          [0, 31],
        ],
      },
    ],
    vp: [50, 50],
  },
};

function toPoints(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x},${y}`).join(" ");
}

export function DebugOverlay({ sceneId }: { sceneId: string }) {
  const data = DEBUG[sceneId as SceneId];
  if (!data) return null;

  const muralChunks: [number, number][][] = [];
  if (sceneId === "corner") {
    muralChunks.push(data.muralQuad.slice(0, 4));
    muralChunks.push(data.muralQuad.slice(4, 8));
  } else {
    muralChunks.push(data.muralQuad);
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {/* Dark scrim so overlay reads on any image */}
      <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.25)" />

      {/* Wall plane */}
      <polygon
        points={toPoints(data.wallQuad)}
        fill="rgba(34,197,94,0.10)"
        stroke="rgba(34,197,94,0.9)"
        strokeWidth="0.25"
        strokeDasharray="1.2,0.8"
      />

      {/* Vanishing lines */}
      {data.vanishing.map((v, i) => (
        <line
          key={i}
          x1={v.from[0]}
          y1={v.from[1]}
          x2={v.to[0]}
          y2={v.to[1]}
          stroke="rgba(217,70,239,0.7)"
          strokeWidth="0.18"
          strokeDasharray="0.6,0.6"
        />
      ))}

      {/* Vanishing point */}
      <circle
        cx={data.vp[0]}
        cy={data.vp[1]}
        r="0.9"
        fill="rgba(217,70,239,1)"
        stroke="white"
        strokeWidth="0.15"
      />

      {/* Mural placement quads */}
      {muralChunks.map((q, i) => (
        <polygon
          key={i}
          points={toPoints(q)}
          fill="rgba(56,189,248,0.12)"
          stroke="rgba(56,189,248,1)"
          strokeWidth="0.3"
        />
      ))}

      {/* Occluders */}
      {data.occluders.map((o, i) => (
        <g key={i}>
          <polygon
            points={toPoints(o.points)}
            fill="rgba(239,68,68,0.18)"
            stroke="rgba(239,68,68,0.95)"
            strokeWidth="0.22"
            strokeDasharray="0.8,0.4"
          />
        </g>
      ))}

      {/* Labels via foreignObject for crisp text */}
      <foreignObject x="2" y="2" width="96" height="10">
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: 2.4,
            lineHeight: 1,
            color: "white",
          }}
        >
          <span style={{ background: "rgba(34,197,94,0.85)", color: "black", padding: "0.4px 1px" }}>
            WALL PLANE
          </span>
          <span style={{ background: "rgba(56,189,248,0.9)", color: "black", padding: "0.4px 1px" }}>
            MURAL BOUNDS
          </span>
          <span style={{ background: "rgba(217,70,239,0.85)", color: "black", padding: "0.4px 1px" }}>
            VP · VANISH
          </span>
          {data.occluders.length > 0 && (
            <span style={{ background: "rgba(239,68,68,0.9)", color: "white", padding: "0.4px 1px" }}>
              OCCLUDER
            </span>
          )}
        </div>
      </foreignObject>

      {/* Occluder name tags */}
      {data.occluders.map((o, i) => {
        const cx = o.points.reduce((s, p) => s + p[0], 0) / o.points.length;
        const cy = o.points.reduce((s, p) => s + p[1], 0) / o.points.length;
        return (
          <text
            key={`l-${i}`}
            x={cx}
            y={cy}
            fill="white"
            fontSize="2.2"
            textAnchor="middle"
            style={{ fontFamily: "ui-monospace", textTransform: "uppercase", letterSpacing: 0.3 }}
          >
            {o.label}
          </text>
        );
      })}
    </svg>
  );
}
