// Two letters for the avatar: first and last name, else the email's start.
export function initials(name: string | null | undefined, email: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email ?? "?").slice(0, 2).toUpperCase();
}

// "Sofia" from "Sofia Marchetti"; null when there is no name.
export function firstName(name: string | null | undefined): string | null {
  return (name ?? "").trim().split(/\s+/)[0] || null;
}
