import { ExcoHeader } from "./header";
import "./exco.css";

// Exco pages (handoff 8.4): the same tokens and fonts, calmer. A small CRT band heads every tool page;
// no video, signs, sparks or marquees. Controls and permissions live in each page, unchanged.
export default function ExcoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="exco">
      <ExcoHeader />
      {children}
    </div>
  );
}
