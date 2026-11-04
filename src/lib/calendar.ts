// An "Add to Google Calendar" link for a training session.
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(startsAt: string, endsAt: string) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "UNM Archery Club training",
    dates: `${stamp(startsAt)}/${stamp(endsAt)}`,
    details: "Booked on the UNM Archery Club website.",
    location: "University of Nottingham Malaysia, Semenyih",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// A 15-minute reminder for the moment a session day opens for booking.
export function bookingOpensUrl(dayLabel: string, opensAt: string) {
  const end = new Date(Date.parse(opensAt) + 15 * 60_000).toISOString();
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `UNM Archery: booking opens for ${dayLabel}`,
    dates: `${stamp(opensAt)}/${stamp(end)}`,
    details: "Book your slot on the UNM Archery Club website.",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
