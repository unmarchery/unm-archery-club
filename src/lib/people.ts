// Exco positions and access switches, shared by the Exco and People pages.
export const POSITIONS = [
  "President", "Vice President", "Secretary", "Treasurer", "Events", "Marketing", "Equipment",
  "Treasurer Dept", "Events Dept", "Marketing Dept", "Equipment Dept",
];
export const OFFICER_POSITIONS = ["President", "Vice President", "Treasurer"];

// Every switch the People page shows, in order. "owner" (President access) is shown but
// never switched here.
export const SWITCHES: { key: string; label: string; hint: string }[] = [
  { key: "manage_members", label: "Members and accounts", hint: "Member checks, starter accounts" },
  { key: "approve_topups", label: "Approve top-ups", hint: "Approvals page, payment details, Finance" },
  { key: "export_finance", label: "Download finance", hint: "Finance page and the Excel download" },
  { key: "change_positions", label: "Change positions", hint: "Positions and what each exco handles" },
  { key: "write_notes", label: "Write notes", hint: "Notes about exco on this page" },
  { key: "edit_settings", label: "Settings", hint: "Club rules (page coming soon)" },
  { key: "manage_sessions", label: "Sessions", hint: "Cancel or add sessions (coming soon)" },
  { key: "assign_duty", label: "Duty roster", hint: "Coming soon" },
  { key: "take_attendance", label: "Attendance", hint: "Coming soon" },
];
