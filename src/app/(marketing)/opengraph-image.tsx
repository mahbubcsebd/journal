import { ImageResponse } from "next/og";

export const alt = "Journal — trading journal for Exness MT5";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CELLS = [120, -45, 210, 80, 0, -130, 95, 60, -20, 310, 40, -75, 180, 150, -60, 220, 35, -110, 90, 260];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#090a0d", color: "#f2f3f5", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#14b884", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 16.5 9 11l3.5 3.5L20 7" />
                <path d="M15 7h5v5" />
              </svg>
            </div>
            <span style={{ fontSize: 40, fontWeight: 700 }}>Journal</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Your trading journal, written for you.</span>
            <span style={{ fontSize: 30, color: "#9598a0" }}>Exness MT5 auto-sync · P&L calendar · analytics · AI coach</span>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 340, gap: 10, alignContent: "center", marginLeft: 40 }}>
          {CELLS.map((v, i) => (
            <div
              key={i}
              style={{
                width: 58,
                height: 58,
                borderRadius: 12,
                background: v > 0 ? `rgba(0,116,84,${0.35 + Math.min(1, v / 300) * 0.65})` : v < 0 ? `rgba(229,106,60,${0.35 + Math.min(1, -v / 150) * 0.65})` : "#181a1f",
              }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
