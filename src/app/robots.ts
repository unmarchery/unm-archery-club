import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Lets search engines read the public pages. Member and exco pages already send visitors to
// the sign-in page, and the sign-in pages and Ranking ask not to be listed (noindex).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/exco/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
