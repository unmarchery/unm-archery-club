import type { NextConfig } from "next";

// Cache Components is off: nearly every page depends on who is signed in,
// so pages render per request and Server Actions refresh them with revalidatePath.
const nextConfig: NextConfig = {
  experimental: {
    // Receipts and the club QR are uploaded through Server Actions. Pictures are shrunk in
    // the browser first; this leaves room for a PDF receipt (the upload code allows 4 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
