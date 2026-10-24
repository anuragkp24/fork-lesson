// Pure helpers for the re-upload fallback (see lib/google/drive.ts).

const OFFICE_FOR_GOOGLE: Record<string, string> = {
  "application/vnd.google-apps.document":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.google-apps.spreadsheet":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.presentation":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export type ReuploadPlan = {
  // Set for Google-native files, which are exported before upload.
  exportAs: string | null;
  // The mimeType the new file gets. For a native file this makes Drive
  // convert the upload back into a Doc, Sheet or Slides file.
  uploadAs: string;
  // The content type of the bytes being uploaded.
  contentType: string;
};

// Null for Google types that can't be re-uploaded (forms, shortcuts, folders…).
export function reuploadPlan(mimeType: string): ReuploadPlan | null {
  const office = OFFICE_FOR_GOOGLE[mimeType];
  if (office) return { exportAs: office, uploadAs: mimeType, contentType: office };
  if (mimeType.startsWith("application/vnd.google-apps.")) return null;
  return { exportAs: null, uploadAs: mimeType, contentType: mimeType };
}

// multipart/related body for Drive's uploadType=multipart: JSON metadata,
// then the file bytes.
export function multipartBody(
  metadata: object,
  contentType: string,
  content: Uint8Array,
  boundary: string
): Buffer {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
}
