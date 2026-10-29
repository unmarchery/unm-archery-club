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
  MEMBERS_FREE: "Members train for free, so there's no need to top up.",
  INVALID_METHOD: "Choose DuitNow QR or cash.",
  INVALID_QUANTITY: "Choose between 1 and 20 passes of each kind.",
  BANK_REF_REQUIRED: "Enter the transaction reference number from your banking app.",
  RECEIPT_REQUIRED: "Add a screenshot of your payment receipt.",
  BANK_REF_USED: "That transaction reference has already been sent. Check the number, or ask the treasurer.",
  TOO_MANY_PENDING: "You already have 3 top-ups waiting. Please wait until the treasurer checks them.",
  TOPUP_NOT_FOUND: "That top-up has already been handled.",
  REASON_REQUIRED: "Write a reason, so the archer knows what to fix.",
  INVALID_LINK: "Paste a WhatsApp group invite link (it starts with https://chat.whatsapp.com/).",
  INVALID_PATH: "That picture couldn't be saved. Please try again.",
  RECEIPT_NOT_FOUND: "That receipt has already been deleted.",
  TOPUP_PENDING: "Approve or reject this top-up first.",
  DELETE_PENDING: "Someone has already asked to delete this receipt. Agree to that request instead.",
  REQUEST_EXPIRED: "This request is more than 14 days old. Ask again if the receipt should still go.",
  TREASURER_AND_PRESIDENT: "The Treasurer and the President or VP must both agree to delete a receipt.",
};

export type ActionResult = { ok: true; refunded?: boolean } | { ok: false; message: string };

export function messageFor(error: { message?: string } | null | undefined) {
  const text = error?.message ?? "";
  const code = Object.keys(MESSAGES).find((c) => text.includes(c));
  return code ? MESSAGES[code] : "Something went wrong. Please try again.";
}
