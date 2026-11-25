"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const SLOWMO_AT = 2.6; // seconds into the loop where the arrow lands in frame and slows (measured from the clip)

// Hero (handoff 5.3) and ambient fade (5.4). The club's loop video on a stage that copies object-fit: cover,
// biased left so the arrow stays in shot. The headline and CTA fade in once, when the video reaches the slow
// motion, and stay through later loops. The ambient band samples the video's live bottom-edge colours four
// times a second and dissolves them into the page.
export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ambRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [paused, setPaused] = useState(false);
  const userPaused = useRef(false);

  useEffect(() => {
    const hero = heroRef.current!, video = videoRef.current!, stage = stageRef.current!, amb = ambRef.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    let done = false;
    const reveal = () => { if (!done) { done = true; setRevealed(true); } };
    const onTime = () => { if (video.currentTime >= SLOWMO_AT) reveal(); };

    if (reduce) {
      // A single still frame: no autoplay, the copy shows straight away.
      video.pause();
      userPaused.current = true;
      const still = () => { video.currentTime = 4; };
      if (video.readyState >= 1) still(); else video.addEventListener("loadedmetadata", still, { once: true });
      timers.push(window.setTimeout(() => { setPaused(true); reveal(); }, 0));
    } else {
      video.addEventListener("timeupdate", onTime);
      const arm = () => timers.push(window.setTimeout(reveal, Math.max(0, (SLOWMO_AT - video.currentTime) * 1000) + 250));
      video.addEventListener("playing", arm, { once: true });
      timers.push(window.setTimeout(reveal, SLOWMO_AT * 1000 + 2500)); // autoplay blocked: still reveal
      video.play().catch(() => {});
    }

    // Play only while the hero is on screen (unless the visitor paused it).
    const io = new IntersectionObserver(([e]) => {
      if (!userPaused.current) { if (e.isIntersecting) video.play().catch(() => {}); else video.pause(); }
    }, { rootMargin: "-72px 0px 0px 0px" });
    io.observe(hero);

    // Ambient fade: average the visible bottom edge of the video into three colours.
    const sc = document.createElement("canvas"); sc.width = 24; sc.height = 2;
    const sx = sc.getContext("2d", { willReadFrequently: true })!;
    const m = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim().match(/[0-9a-f]{2}/gi);
    const canvasRGB = m ? m.map((h) => parseInt(h, 16)) : [8, 19, 14];
    let ambOK = true, ambTimer = 0;
    const sample = () => {
      if (!ambOK || video.readyState < 2 || !video.videoWidth) return;
      const hr = hero.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      const vw = video.videoWidth, vh = video.videoHeight;
      const fx0 = Math.max(0, (hr.left - sr.left) / sr.width), fx1 = Math.min(1, (hr.right - sr.left) / sr.width);
      const fyB = Math.min(1, (hr.bottom - sr.top) / sr.height), band = 0.05;
      try {
        sx.drawImage(video, fx0 * vw, (fyB - band) * vh, (fx1 - fx0) * vw, band * vh, 0, 0, 24, 2);
        const d = sx.getImageData(0, 0, 24, 2).data;
        const avg = (c0: number, c1: number, dark: number) => {
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = 0; y < 2; y++) for (let x = c0; x < c1; x++) { const i = (y * 24 + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
          return `rgb(${[r / n, g / n, b / n].map((v, k) => Math.round(v + (canvasRGB[k] - v) * dark)).join(",")})`;
        };
        amb.style.setProperty("--amb-l", avg(0, 8, .45)); // the scrim darkens the bottom-left corner
        amb.style.setProperty("--amb-m", avg(8, 16, .18));
        amb.style.setProperty("--amb-r", avg(16, 24, .15));
      } catch {
        ambOK = false; // tainted canvas: keep the CSS fallback colours
      }
    };
    const ambIO = new IntersectionObserver(([e]) => {
      window.clearInterval(ambTimer);
      if (e.isIntersecting && !reduce) ambTimer = window.setInterval(sample, 250);
      sample();
    });
    ambIO.observe(hero);
    video.addEventListener("loadeddata", sample);

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(ambTimer);
      io.disconnect(); ambIO.disconnect();
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadeddata", sample);
    };
  }, []);

  const togglePause = () => {
    const v = videoRef.current!;
    userPaused.current = !userPaused.current;
    if (userPaused.current) v.pause(); else v.play().catch(() => {});
    setPaused(userPaused.current);
  };

  return (
    <>
      <section ref={heroRef} className={`hero${revealed ? " is-revealed" : ""}`} data-hero aria-label="Introduction">
        <div className="hero__stage" ref={stageRef}>
          <video ref={videoRef} className="hero__video" src="/media/hero-loop.mp4" poster="/media/hero-poster.jpg"
            muted loop playsInline preload="auto" aria-hidden="true" />
        </div>
        <div className="hero__scrim" aria-hidden="true" />
        <div className="hero__copy">
          <h1 className="hero__title" data-reveal>
            <span className="line">Aim,</span>
            <span className="line">Hit,</span>
            <span className="line">and Never Quit</span>
          </h1>
          <div className="hero__cta" data-reveal>
            <Link className="btn btn--light btn--lg" href="/sessions" data-magnetic>
              <span className="btn__label">Book a session</span>
              <ArrowGlyph />
            </Link>
          </div>
        </div>
        <button className="hero__pause" type="button" onClick={togglePause} aria-pressed={paused} aria-label={paused ? "Play background video" : "Pause background video"}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {paused ? <path d="M8 5.5v13l11-6.5z" /> : <g><rect x="7" y="5" width="3.5" height="14" rx="1" /><rect x="13.5" y="5" width="3.5" height="14" rx="1" /></g>}
          </svg>
        </button>
      </section>
      <div className="ambient" ref={ambRef} aria-hidden="true" />
    </>
  );
}

export function ArrowGlyph() {
  return <svg className="btn__arrow" viewBox="0 0 32 12" aria-hidden="true"><path d="M0 6h28M22 1l6 5-6 5M3 1l5 5-5 5M9 1l5 5-5 5" /></svg>;
}
