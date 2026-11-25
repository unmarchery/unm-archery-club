// The site's public address, for Google and link previews. Netlify sets URL to the main
// site address at build time; the fallback is the current one.
export const SITE_URL = (process.env.URL || "https://unmarchery.netlify.app").replace(/\/$/, "");
