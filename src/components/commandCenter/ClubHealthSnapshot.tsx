import { useState, type CSSProperties } from "react";
import Spinner from "../ui/Spinner";

const GOLD = "#FFC429";
const ACCENT_RED = "#E51937";
const CARD_BORDER = "#2a2a2a";

export type ClubHealthMetric = {
  id: string;
  label: string;
  value: string | number;
  onClick: () => void;
  highlight?: boolean;
};

export function ClubHealthSnapshot({
  metrics,
  loading,
}: {
  metrics: ClubHealthMetric[];
  loading: boolean;
}) {
  return (
    <section
      style={{
        background: "#141414",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <h2
        style={{
          margin: "0 0 12px",
          fontSize: "15px",
          fontWeight: 700,
          color: "#ffffff",
          letterSpacing: "-0.01em",
        }}
      >
        Club Health Snapshot
      </h2>
      {loading ? (
        <div className="flex justify-center py-4">
          <Spinner label="Loading club health…" />
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "8px",
          }}
        >
          {metrics.map((metric) => (
            <HealthMetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      )}
    </section>
  );
}

function HealthMetricCard({ metric }: { metric: ClubHealthMetric }) {
  const [hovered, setHovered] = useState(false);
  const style: CSSProperties = {
    background: hovered ? "#1f1f1f" : "#1a1a1a",
    border: `1px solid ${metric.highlight && Number(metric.value) > 0 ? "rgba(229, 25, 55, 0.35)" : CARD_BORDER}`,
    borderRadius: "8px",
    padding: "10px 12px",
    textAlign: "left",
    cursor: "pointer",
    transition: "background 0.15s ease",
  };

  return (
    <button
      type="button"
      onClick={metric.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={style}
    >
      <p
        style={{
          margin: "0 0 6px",
          fontSize: "10px",
          fontWeight: 700,
          color: "#a0a0a0",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {metric.label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "20px",
          fontWeight: 800,
          color:
            metric.highlight && Number(metric.value) > 0 ? ACCENT_RED : "#ffffff",
          lineHeight: 1.1,
        }}
      >
        {metric.value}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: "11px", color: GOLD, fontWeight: 600 }}>
        Open →
      </p>
    </button>
  );
}
