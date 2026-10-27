// Turns the short error codes raised by the database functions into plain messages.
const MESSAGES: Record<string, string> = {
  NOT_SIGNED_IN: "Please log in again.",
  NO_PROFILE: "Your account has no student profile yet. Ask the exco to check it.",
  BANNED: "You're paused from booking because of no-shows. You can book again once the ban ends.",
  SLOT_NOT_FOUND: "That session no longer exists.",
  SLOT_CANCELLED: "That session was cancelled.",
  SLOT_STARTED: "That session has already started.",
  NOT_OPEN_YET: "Booking for that week isn't open yet.",
  ALREADY_BOOKED: "You've already booked that slot.",
  SLOT_FULL: "Sorry, that slot just filled up.",
  NONMEMBER_FULL: "All non-member spots in that slot are taken.",
  NO_PASSES: "You don't have a pass for that. Top up first.",
  PASS_REQUIRED: "Choose which pass to use.",
  BOOKING_NOT_FOUND: "We couldn't find that booking.",
  NOT_CANCELLABLE: "That booking can't be cancelled any more.",
  ALREADY_STARTED: "That session has already started, so it can't be cancelled.",
  ALREADY_MEMBER: "You're already a member.",
  REQUEST_PENDING: "You already have a member check waiting for the exco.",
  NOT_ALLOWED: "You don't have permission to do that.",
  REQUEST_NOT_FOUND: "That request has already been handled.",
  OWN_REQUEST: "Another exco member needs to decide your own request.",
};

export type ActionResult = { ok: true; refunded?: boolean } | { ok: false; message: string };

export function messageFor(error: { message?: string } | null | undefined) {
  const text = error?.message ?? "";
  const code = Object.keys(MESSAGES).find((c) => text.includes(c));
  return code ? MESSAGES[code] : "Something went wrong. Please try again.";
}
