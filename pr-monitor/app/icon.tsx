import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" fill="#E40100" />
          <polygon
            points="0,0 64,0 64,18 60,24 56,18 52,28 48,22 44,32 40,26 36,36 32,28 28,40 24,32 20,44 16,36 12,48 8,40 4,52 0,44"
            fill="#0A0A0A"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
