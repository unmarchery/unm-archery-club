import type { Gear } from "@/lib/gear";

// Data the Book a session page hands to its client parts (all plain, serialisable values).
export type MyBooking = {
  id: string;
  slotId: string;
  day: string; // "Tue 24 Nov"
  time: string; // "5–6pm"
  startsAt: string;
  passKind: "member" | "single" | "full";
  group: string | null; // a day pass's three bookings share one group
  gear: Partial<Gear>;
  cancelNote: string; // what happens to the pass if cancelled now
  calendar: string; // Add to Google Calendar link
};

export type SlotRow = {
  id: string;
  time: string; // "4–5pm"
  cancelled: boolean;
  cancelledReason: string | null;
  started: boolean;
  left: number; // places this archer can still take (members: all; guests: within the guest cap)
  fill: number; // % of the slot booked
  mine: MyBooking | null;
  waitlist: { position: number; waiting: number } | null; // offered when full and more than an hour away
};

export type DayCard = {
  key: string;
  title: string; // "Tuesday, 24 November"
  short: string; // "Tue 24 Nov"
  range: string; // "4–7pm"
  locked: { text: string; soon: string | null; calendar: string | null } | null; // not open for booking yet
  slots: SlotRow[];
  canDay: boolean; // "Book the whole day" is possible
  dayIds: string[]; // the live slots a whole-day booking takes
  allMine: boolean; // every hour is booked by this archer
  anyMine: boolean;
};

export type Account = {
  member: boolean;
  handle: string;
  year: string; // "2026/27"
  singles: number;
  fulls: number;
  gear: Gear;
  clubBows: { RH: number[]; LH: number[] };
  noshow: { warn: number; ban: number; days: number };
  prices: { single: number; full: number };
};
