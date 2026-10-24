// The sharing domain is the part of the teacher's email after the "@".
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) throw new Error("Invalid email");
  return email.slice(at + 1).toLowerCase();
}
