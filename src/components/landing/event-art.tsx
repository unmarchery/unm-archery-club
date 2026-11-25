// Drawn art for events without a picture (from the prototype's event cards). Which drawing, and the
// under-glow colour, follow the event's name: Robin Hood → green, Ranking → gold, Cupid/Valentine → pink,
// anything else → a target in visor cyan.
export type EventTone = "robin" | "rank" | "cupid" | "target";

export function toneFor(title: string): EventTone {
  if (/robin|hood|sherwood/i.test(title)) return "robin";
  if (/rank|league|competition|tournament|championship/i.test(title)) return "rank";
  if (/cupid|valentine|love|heart/i.test(title)) return "cupid";
  return "target";
}

export const GLOW: Record<EventTone, string> = { robin: "128 228 112", rank: "227 185 85", cupid: "255 128 180", target: "95 227 214" };

const GRID = <g className="art-grid"><path d="M0 60h400M0 120h400M0 180h400M0 240h400M80 0v300M160 0v300M240 0v300M320 0v300" /></g>;

export function EventArt({ tone }: { tone: EventTone }) {
  if (tone === "robin") {
    return (
      <svg viewBox="0 0 400 300" aria-hidden="true">{GRID}
        <path d="M0 300V120l26-48 22 40 18-70 24 64 20-44 24 58v180zM296 300V96l22-54 20 46 18-62 24 70 20-40v244z" className="f-s2" />
        <circle cx="206" cy="158" r="96" className="f-s2 s-hair" /><circle cx="206" cy="158" r="76" className="f-none s-ink" strokeWidth="2" />
        <circle cx="206" cy="158" r="56" className="f-none s-acc" strokeWidth="3" /><circle cx="206" cy="158" r="36" className="f-pri" /><circle cx="206" cy="158" r="17" className="f-gold" />
        <path d="M206 158 318 66" className="s-ink" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M318 66l15-3-7 13zM318 66l2 14 9-9z" className="f-green" />
        <path d="M214 151 330 56" className="s-acc" strokeWidth="2.4" strokeLinecap="round" /><path d="M330 56l16-4-8 14zM330 56l2 15 10-10z" className="f-acc" />
        <g className="s-gold" strokeWidth="2" strokeLinecap="round"><path d="M300 74l12-14M306 80l16-8M296 70l2-16" /></g>
        <g transform="translate(24 26)"><path d="M6 58C22 22 66 6 112 18c-8 8-12 18-12 30C70 38 38 44 6 58z" className="f-green" /><path d="M12 56c30-10 58-12 88-8" className="s-gold" strokeWidth="3" /><path d="M84 30c20-26 50-34 78-30-26 6-48 18-68 40z" className="f-pri" /><path d="M90 34c20-18 42-26 66-28" className="s-ink" strokeWidth="1.2" opacity=".6" /></g>
      </svg>
    );
  }
  if (tone === "rank") {
    return (
      <svg viewBox="0 0 400 300" aria-hidden="true">{GRID}
        <g className="t-mono"><text x="58" y="96" className="f-gold">01</text><text x="58" y="166" className="f-ink">02</text><text x="58" y="236" className="f-pri">03</text></g>
        <rect x="118" y="64" width="232" height="40" rx="8" className="f-s2 s-acc" strokeWidth="2" /><rect x="118" y="64" width="208" height="40" rx="8" className="f-gold" opacity=".9" />
        <rect x="118" y="134" width="180" height="40" rx="8" className="f-ink" opacity=".75" /><rect x="118" y="204" width="146" height="40" rx="8" className="f-pri" />
        <path d="M360 150l14-18 14 18M374 132v52" className="f-none s-acc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "cupid") {
    return (
      <svg viewBox="0 0 400 300" aria-hidden="true">{GRID}
        <path d="M200 262C120 206 76 164 76 116c0-32 24-56 56-56 30 0 50 18 68 44 18-26 38-44 68-44 32 0 56 24 56 56 0 48-44 90-124 146z" className="f-pink" />
        <path d="M200 226C146 188 116 158 116 124c0-18 14-32 32-32 22 0 36 16 52 38 16-22 30-38 52-38 18 0 32 14 32 32 0 34-30 64-84 102z" className="f-pri" />
        <path d="M52 238 348 66" className="s-ink" strokeWidth="3.2" strokeLinecap="round" /><path d="M348 66l17-1-9 14zM348 66l-2 16 13-7z" className="f-gold" />
        <path d="M52 238l-6-15 12 3zM52 238l-15-2 9-10zM62 232l-6-15 12 3zM62 232l-15-2 9-10z" className="f-pink" />
        <g className="f-pink" opacity=".7"><path d="M330 200c-8-6-12-10-12-15 0-4 3-6 6-6s5 2 6 4c1-2 3-4 6-4s6 2 6 6c0 5-4 9-12 15z" /><path d="M80 52c-6-4-9-7-9-11 0-3 2-5 5-5 2 0 3 1 4 3 1-2 2-3 4-3 3 0 5 2 5 5 0 4-3 7-9 11z" /></g>
        <g className="s-gold" strokeWidth="2" strokeLinecap="round"><path d="M300 236v14M293 243h14M110 268v10M105 273h10" /></g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 400 300" aria-hidden="true">{GRID}
      <circle cx="200" cy="150" r="104" className="f-s2 s-hair" /><circle cx="200" cy="150" r="84" className="f-none s-ink" strokeWidth="2" />
      <circle cx="200" cy="150" r="62" className="f-none s-acc" strokeWidth="3" /><circle cx="200" cy="150" r="40" className="f-pri" /><circle cx="200" cy="150" r="19" className="f-gold" />
      <path d="M200 150 330 70" className="s-acc" strokeWidth="2.8" strokeLinecap="round" /><path d="M330 70l17-3-8 15zM330 70l1 17 11-11z" className="f-acc" />
      <g className="s-gold" strokeWidth="2" strokeLinecap="round"><path d="M314 80l13-14M320 86l17-7M310 76l2-17" /></g>
    </svg>
  );
}
