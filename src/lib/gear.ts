export type Gear = {
  hand: "RH" | "LH";
  draw_lbs: string; // a weight like "18", or "Not sure"
  own_bow: boolean;
  own_bow_type: string | null;
  own_bow_lbs: number | null;
};

export type ClubBows = { RH: number[]; LH: number[] };

export const BOW_TYPES = ["Recurve", "Compound", "Barebow", "Traditional"];

export type Tag = { label: string; tone?: "gold" | "warn" };

// Tag chips for an archer's equipment, e.g. [Right-handed] [18 lbs] [Club bow].
export function gearTags(g: Partial<Gear>): Tag[] {
  if (g.own_bow) {
    const tags: Tag[] = [{ label: "Own bow" }];
    if (g.own_bow_type) tags.push({ label: g.own_bow_type });
    if (g.own_bow_lbs) tags.push({ label: `${g.own_bow_lbs} lbs`, tone: "gold" });
    return tags;
  }
  return [
    { label: g.hand === "LH" ? "Left-handed" : "Right-handed" },
    { label: !g.draw_lbs || g.draw_lbs === "Not sure" ? "Any weight" : `${g.draw_lbs} lbs`, tone: "gold" },
    { label: "Club bow" },
  ];
}
