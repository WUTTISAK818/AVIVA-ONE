import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

const TARGET = process.env.NEXT_PUBLIC_TARGET;

export default function Icon() {
  const isPlus = TARGET === "plus";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isPlus
            ? "linear-gradient(135deg, #0a1f1a 0%, #13302a 60%, #2a3320 100%)"
            : "linear-gradient(135deg, #0A1A14 0%, #1a2a1a 100%)",
          color: "#D4AF37",
          fontFamily: "Georgia, serif",
          fontWeight: 600,
          fontSize: 110,
          letterSpacing: -2,
        }}
      >
        {isPlus ? "A+" : "A1"}
      </div>
    ),
    { ...size },
  );
}
