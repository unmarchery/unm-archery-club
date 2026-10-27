import type { NextConfig } from "next";

// Cache Components is off: nearly every page depends on who is signed in,
// so pages render per request and Server Actions refresh them with revalidatePath.
const nextConfig: NextConfig = {
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
