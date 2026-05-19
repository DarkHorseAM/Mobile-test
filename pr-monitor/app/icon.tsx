import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0A0A",
          color: "#FFFFFF",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: "-0.04em",
        }}
      >
        DPR
      </div>
    ),
    { ...size },
  );
}
