import type { NextConfig } from "next";

const GSI_HOST = "https://cyberjapandata.gsi.go.jp";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/tiles/:layer/:z/:x/:y.:ext",
        destination: `${GSI_HOST}/xyz/:layer/:z/:x/:y.:ext`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/tiles/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, s-maxage=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
