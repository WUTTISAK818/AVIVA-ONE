import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0A1A14 0%, #1a2a1a 100%)",
          color: "#D4AF37",
          fontFamily: "Georgia, serif",
          fontWeight: 600,
          fontSize: 102,
          letterSpacing: -2,
        }}
      >
        A1
      </div>
    ),
    { ...size },
  );
}
