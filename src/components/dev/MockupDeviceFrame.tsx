import type { CSSProperties, ReactNode } from "react";
import {
  MOCKUP_BG_RAISED,
  MOCKUP_BORDER,
  MOCKUP_GOLD,
  MOCKUP_MUTED,
  MOCKUP_RED,
  MOCKUP_TEXT,
} from "../../dev/mockupFixtures";

type MockupDeviceFrameProps = {
  title: string;
  note: string;
  children: ReactNode;
  /** Fixed content width for consistent screenshots (~1440 desktop). */
  width?: number;
  height?: number;
};

const shellStyle: CSSProperties = {
  background: "#161616",
  border: `1px solid ${MOCKUP_BORDER}`,
  borderRadius: "12px",
  overflow: "hidden",
  boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
  width: "100%",
};

export default function MockupDeviceFrame({
  title,
  note,
  children,
  width = 1440,
  height = 900,
}: MockupDeviceFrameProps) {
  return (
    <section style={{ marginBottom: "48px" }}>
      <div style={{ marginBottom: "12px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 700,
            color: MOCKUP_TEXT,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "13px",
            color: MOCKUP_MUTED,
            lineHeight: 1.45,
          }}
        >
          {note}
        </p>
      </div>

      <div style={shellStyle}>
        <div
          style={{
            background: "#121212",
            borderBottom: `1px solid ${MOCKUP_BORDER}`,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            {[MOCKUP_RED, MOCKUP_GOLD, "#333333"].map((color) => (
              <span
                key={color}
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: color,
                }}
              />
            ))}
          </div>
          <div
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "12px",
              color: "#666666",
              fontWeight: 500,
            }}
          >
            Gryph ClubConnect · {title}
          </div>
          <div style={{ width: "52px" }} aria-hidden />
        </div>

        <div
          style={{
            background: MOCKUP_BG_RAISED,
            overflow: "auto",
          }}
        >
          <div
            style={{
              width,
              minHeight: height,
              margin: "0 auto",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
