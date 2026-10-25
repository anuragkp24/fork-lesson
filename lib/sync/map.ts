// Pure mapping from Classroom API objects to our rows. No network, no
// database. Only assignment data is read: no submissions, grades or rosters.

type DriveFileMaterial = {
  driveFile?: { id?: string; title?: string; alternateLink?: string };
  shareMode?: string;
};

export type ClassroomMaterial = {
  driveFile?: DriveFileMaterial;
  youtubeVideo?: { id?: string; title?: string; alternateLink?: string };
  link?: { url?: string; title?: string };
  form?: { formUrl?: string; title?: string };
};

export type ClassroomCourseWork = {
  id: string;
  title?: string;
  description?: string;
  materials?: ClassroomMaterial[];
  state?: string;
  maxPoints?: number;
  workType?: string;
  assigneeMode?: string;
  topicId?: string;
  updateTime?: string;
};

export type MappedAttachment = {
  position: number;
  kind: "drive" | "youtube" | "link" | "unsupported";
  title: string | null;
  url: string | null;
  drive_file_id: string | null;
  share_mode: string | null;
  unsupported_type: string | null;
};

export type MappedLesson = {
  google_coursework_id: string;
  title: string;
  description: string | null;
  work_type: string | null;
  max_points: number | null;
  topic_id: string | null;
  source_updated_at: string | null;
  attachments: MappedAttachment[];
};

export type MapResult =
  | { status: "ok"; lesson: MappedLesson }
  | { status: "skipped"; reason: "not_published" | "individual_students" };

const NO_ATTACHMENT = {
  title: null,
  url: null,
  drive_file_id: null,
  share_mode: null,
  unsupported_type: null,
} as const;

export function mapMaterial(material: ClassroomMaterial, position: number): MappedAttachment {
  const drive = material.driveFile?.driveFile;
  if (drive?.id) {
    return {
      ...NO_ATTACHMENT,
      position,
      kind: "drive",
      title: drive.title ?? null,
      url: drive.alternateLink ?? null,
      drive_file_id: drive.id,
      share_mode: material.driveFile?.shareMode ?? null,
    };
  }

  const video = material.youtubeVideo;
  if (video) {
    return {
      ...NO_ATTACHMENT,
      position,
      kind: "youtube",
      title: video.title ?? null,
      url: video.alternateLink ?? null,
    };
  }

  if (material.link?.url) {
    return {
      ...NO_ATTACHMENT,
      position,
      kind: "link",
      title: material.link.title ?? null,
      url: material.link.url,
    };
  }

  // Forms, and anything else we don't copy (add-ons): a "re-add" note.
  if (material.form) {
    return {
      ...NO_ATTACHMENT,
      position,
      kind: "unsupported",
      title: material.form.title ?? null,
      url: material.form.formUrl ?? null,
      unsupported_type: "form",
    };
  }
  return { ...NO_ATTACHMENT, position, kind: "unsupported", unsupported_type: "other" };
}

// The lesson for a piece of courseWork, whoever it is assigned to.
export function mapLesson(work: ClassroomCourseWork): MappedLesson {
  return {
    google_coursework_id: work.id,
    title: work.title?.trim() || "(untitled)",
    description: work.description?.trim() || null,
    work_type: work.workType ?? null,
    max_points: typeof work.maxPoints === "number" ? work.maxPoints : null,
    topic_id: work.topicId ?? null,
    source_updated_at: work.updateTime ?? null,
    attachments: (work.materials ?? []).map(mapMaterial),
  };
}

export function mapCourseWork(work: ClassroomCourseWork): MapResult {
  if (work.state && work.state !== "PUBLISHED") return { status: "skipped", reason: "not_published" };
  if (work.assigneeMode === "INDIVIDUAL_STUDENTS") {
    return { status: "skipped", reason: "individual_students" };
  }
  return { status: "ok", lesson: mapLesson(work) };
}

type KeyFields = Pick<MappedAttachment, "kind" | "drive_file_id" | "url" | "position">;

// Identifies an attachment across syncs, so a re-sync updates the row it
// already has (and later slices keep the library copy it points to).
// Repeats of the same file get a #n suffix.
export function attachmentKeys(items: KeyFields[]): string[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base =
      item.kind === "drive"
        ? `drive:${item.drive_file_id}`
        : item.kind === "unsupported"
          ? `unsupported:${item.position}`
          : `${item.kind}:${item.url}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}#${count}`;
  });
}

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.google-apps.document": "Doc",
  "application/vnd.google-apps.spreadsheet": "Sheet",
  "application/vnd.google-apps.presentation": "Slides",
  "application/vnd.google-apps.form": "Form",
  "application/vnd.google-apps.drawing": "Drawing",
};

export function attachmentLabel(att: {
  kind: string;
  mime_type: string | null;
  unsupported_type: string | null;
}): string {
  switch (att.kind) {
    case "drive":
      return (att.mime_type && MIME_LABELS[att.mime_type]) || "File";
    case "youtube":
      return "Video";
    case "link":
      return "Link";
    default:
      return att.unsupported_type === "form" ? "Form" : "Attachment";
  }
}
