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
