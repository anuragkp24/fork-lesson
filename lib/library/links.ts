// Opens a Drive file of any type; works for anyone the file is shared with.
export function driveOpenUrl(fileId: string): string {
  return `https://drive.google.com/open?id=${encodeURIComponent(fileId)}`;
}

const PREVIEW_PATH: Record<string, string> = {
  "application/vnd.google-apps.document": "document",
  "application/vnd.google-apps.spreadsheet": "spreadsheets",
  "application/vnd.google-apps.presentation": "presentation",
};

// Opens a Drive file read-only, without the editor's "Request edit access" prompt.
export function drivePreviewUrl(fileId: string, mimeType: string | null): string {
  const id = encodeURIComponent(fileId);
  const path = mimeType ? PREVIEW_PATH[mimeType] : undefined;
  return path ? `https://docs.google.com/${path}/d/${id}/preview` : `https://drive.google.com/file/d/${id}/view`;
}
