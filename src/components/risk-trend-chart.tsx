/**
 * Lightweight inline-SVG stacked bar chart — no chart library dependency,
 * to keep the build light on a memory-constrained self-hosted server. Shows
 * scan volume by risk level over the last N days, across every repo the
 * signed-in user can see.
 *
 * Risk (high/medium/low) is a status encoding, not a categorical one — it
 * always ships with a text legend and axis labels below, never color alone.
 */

export type TrendDay = { label: string; high: number; medium: number; low: number };

const COLOR = { high: "var(--high)", medium: "var(--medium)", low: "var(--low)" } as const;

export function RiskTrendChart({ days }: { days: TrendDay[] }) {
  const width = 640;
  const height = 160;
  const padTop = 8;
  const padBottom = 22;
  const padX = 4;
  const plotHeight = height - padTop - padBottom;

  const max = Math.max(1, ...days.map((d) => d.high + d.medium + d.low));
  const barCount = days.length || 1;
  const gap = 4;
  const barWidth = Math.max(2, (width - padX * 2 - gap * (barCount - 1)) / barCount);
  const segGap = 2; // surface-color gap between stacked segments

  const hasAnyData = days.some((d) => d.high + d.medium + d.low > 0);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Scans by risk level over time"
      >
        {/* baseline */}
        <line
          x1={padX}
          y1={height - padBottom}
          x2={width - padX}
          y2={height - padBottom}
          stroke="var(--line)"
          strokeWidth={1}
        />
        {!hasAnyData ? (
          <text x={width / 2} y={height / 2} textAnchor="middle" fontSize="11" fill="var(--ink-dim)">
            No scans in this period yet
          </text>
        ) : (
          days.map((d, i) => {
            const x = padX + i * (barWidth + gap);
            const segs: { key: "high" | "medium" | "low"; value: number }[] = [
              { key: "low", value: d.low },
              { key: "medium", value: d.medium },
              { key: "high", value: d.high },
            ];
            let yCursor = height - padBottom;
            const total = d.high + d.medium + d.low;
            const showLabel = i === days.length - 1 || i === 0 || i % Math.ceil(barCount / 6) === 0;
            return (
              <g key={d.label}>
                {segs.map((seg) => {
                  if (seg.value === 0) return null;
                  const segHeight = (seg.value / max) * plotHeight;
                  const y = yCursor - segHeight;
                  yCursor = y - segGap;
                  const isTop = seg.key === "high" ? d.high > 0 : seg.key === "medium" ? d.high === 0 && d.medium > 0 : d.high === 0 && d.medium === 0;
                  return (
                    <rect
                      key={seg.key}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(1, segHeight)}
                      rx={isTop ? Math.min(3, barWidth / 2) : 0}
                      fill={COLOR[seg.key]}
                    >
                      <title>
                        {d.label}: {seg.value} {seg.key} risk scan(s)
                      </title>
                    </rect>
                  );
                })}
                {total > 0 ? (
                  <title>
                    {d.label}: {total} scan(s) — {d.high} high, {d.medium} medium, {d.low} low
                  </title>
                ) : null}
                {showLabel ? (
                  <text
                    x={x + barWidth / 2}
                    y={height - padBottom + 14}
                    textAnchor="middle"
                    fontSize="9"
                    fill="var(--ink-dim)"
                  >
                    {d.label}
                  </text>
                ) : null}
              </g>
            );
          })
        )}
      </svg>
      <div className="flex items-center gap-4 mt-1 px-1">
        <Legend color={COLOR.high} label="High" />
        <Legend color={COLOR.medium} label="Medium" />
        <Legend color={COLOR.low} label="Low" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10.5px] text-ink-dim">
      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
