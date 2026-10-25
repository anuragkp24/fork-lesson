// The My lessons tab, from ?tab=. Anything but "saved" is "mine".
export function lessonsTab(param: string | string[] | undefined): "mine" | "saved" {
  return param === "saved" ? "saved" : "mine";
}

// The one warning line on a My lessons card: Drive files that didn't make it
// into the library. Null when there are none.
export function publishProblemLabel(attachments: { kind: string; publish_error: string | null }[]): string | null {
  const n = attachments.filter((a) => a.kind === "drive" && a.publish_error).length;
  if (n === 0) return null;
  return `${n} ${n === 1 ? "file" : "files"} couldn't be shared`;
}
