import { ImageResponse } from "next/og";

export const alt = "levera — launch coins on Robinhood with up to 2× leverage";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Typographic only, on purpose: ImageResponse rasterises with Satori, which
// supports a limited SVG subset, so referencing the brand mark here risks the
// card failing to render at build time.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "#131514",
          color: "#fafafa",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            letterSpacing: -0.5,
            color: "#ECE3D1",
            marginBottom: 34,
          }}
        >
          levera
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: 74,
            lineHeight: 1.15,
            letterSpacing: -2,
          }}
        >
          Launch coins on Robinhood with up to&nbsp;
          <span style={{ color: "#ECE3D1" }}>2×</span>&nbsp;leverage
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#a1a1aa", marginTop: 36 }}>
          Launching soon — join the waitlist for early access.
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#71717a", marginTop: 52 }}>
          Robinhood Chain · 4663
        </div>
      </div>
    ),
    size,
  );
}
