// Starter password for accounts the exco creates: the first word of the name on the
// membership form, lowercase letters only, followed by the student ID.
// "Alex Tan", 20512034 -> "alex20512034"
export function starterPassword(fullName: string | null, studentId: string) {
  const first = (fullName ?? "").trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") || "archer";
  return `${first}${studentId}`;
}

export const STARTER_RULE =
  "the first word of your name as you wrote it on the membership form, in lowercase, followed by your student ID";
