// Classroom's web URLs carry the course and assignment ids as unpadded
// base64 of the decimal id.
const encodeId = (id: string) => Buffer.from(id).toString("base64").replace(/=+$/, "");

// Classroom only returns alternateLink for PUBLISHED work, so a draft's link
// is built from its ids.
export function draftLink(googleCourseId: string, googleCourseWorkId: string): string {
  return `https://classroom.google.com/c/${encodeId(googleCourseId)}/a/${encodeId(googleCourseWorkId)}/details`;
}
