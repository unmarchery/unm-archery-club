import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";

export type PublicInfo = {
  single_price: number; fullday_price: number; membership_fee: number | null;
  noshow_warn_after: number; noshow_ban_after: number; ban_days: number;
};

// Prices, membership fee and no-show rules, readable by visitors. Defaults keep the page up
// if the database hasn't run migration 0010 yet.
export const getPublicInfo = cache(async (): Promise<PublicInfo> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_prices");
  const d = (data ?? {}) as Partial<PublicInfo>;
  return {
    single_price: d.single_price ?? 5, fullday_price: d.fullday_price ?? 12, membership_fee: d.membership_fee ?? null,
    noshow_warn_after: d.noshow_warn_after ?? 2, noshow_ban_after: d.noshow_ban_after ?? 3, ban_days: d.ban_days ?? 14,
  };
});
