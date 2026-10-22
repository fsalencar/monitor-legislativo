import type { MetadataRoute } from "next";

export const SITE = "https://www.plenarioaberto.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
