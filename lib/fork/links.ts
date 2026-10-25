// Classroom's web URLs carry the course id as unpadded base64 of the decimal id.
const encodeId = (id: string) => Buffer.from(id).toString("base64").replace(/=+$/, "");

// Drafts have no URL of their own in Classroom (opening one leaves the address
// at the class's Classwork tab), so a fork links to that tab.
export function classworkLink(googleCourseId: string): string {
  return `https://classroom.google.com/w/${encodeId(googleCourseId)}/t/all`;
}
