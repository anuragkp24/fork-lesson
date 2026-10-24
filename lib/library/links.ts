// Opens a Drive file of any type; works for anyone the file is shared with.
export function driveOpenUrl(fileId: string): string {
  return `https://drive.google.com/open?id=${encodeURIComponent(fileId)}`;
}
