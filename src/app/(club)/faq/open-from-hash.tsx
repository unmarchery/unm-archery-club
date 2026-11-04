"use client";

import { useEffect } from "react";

// Opens the answer named in the link, e.g. /faq#q-tiers from the leaderboard.
export function OpenFromHash() {
  useEffect(() => {
    const open = () => {
      const el = location.hash ? document.getElementById(location.hash.slice(1)) : null;
      if (el instanceof HTMLDetailsElement) { el.open = true; el.scrollIntoView({ block: "start" }); }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
