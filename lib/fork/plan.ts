// Pure decisions for a fork: which topic, which work type, which materials.

export type TopicChoice = "existing" | "create" | "none";

export function isTopicChoice(value: unknown): value is TopicChoice {
  return value === "existing" || value === "create" || value === "none";
}

const norm = (name: string) => name.trim().toLowerCase();

// The class's topic with the same name as the lesson's (case-insensitive,
// trimmed), if there is one.
export function topicMatch<T extends { name?: string | null }>(
  lessonTopic: string | null,
  classTopics: T[]
): T | null {
  if (!lessonTopic || !norm(lessonTopic)) return null;
  return classTopics.find((t) => t.name && norm(t.name) === norm(lessonTopic)) ?? null;
}

// Multiple-choice questions need their choices, which we don't keep, so they
// come across as plain assignments.
export function forkWorkType(workType: string | null): "ASSIGNMENT" | "SHORT_ANSWER_QUESTION" {
  return workType === "SHORT_ANSWER_QUESTION" ? "SHORT_ANSWER_QUESTION" : "ASSIGNMENT";
}

export function youtubeIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      return u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ?? null;
    }
  } catch {
    // not a URL
  }
  return null;
}

export type ForkSourceAttachment = {
  id: string;
  kind: string;
  title: string | null;
  url: string | null;
  share_mode: string | null;
  library_file_id: string | null;
  unsupported_type: string | null;
};

export type Material =
  | { driveFile: { driveFile: { id: string }; shareMode: string } }
  | { youtubeVideo: { id: string } }
  | { link: { url: string } };

export type NotCopied = { title: string; reason: "form" | "other" | "not_in_library" | "copy_failed" };

const SHARE_MODES = new Set(["VIEW", "EDIT", "STUDENT_COPY"]);

// copies maps a source attachment id to the id of the teacher's new Drive copy.
export function buildMaterials(
  attachments: ForkSourceAttachment[],
  copies: Map<string, string>
): { materials: Material[]; notCopied: NotCopied[] } {
  const materials: Material[] = [];
  const notCopied: NotCopied[] = [];

  for (const att of attachments) {
    const title = att.title ?? "(untitled)";
    if (att.kind === "drive") {
      const copyId = copies.get(att.id);
      if (copyId) {
        const shareMode = att.share_mode && SHARE_MODES.has(att.share_mode) ? att.share_mode : "VIEW";
        materials.push({ driveFile: { driveFile: { id: copyId }, shareMode } });
      } else {
        notCopied.push({ title, reason: att.library_file_id ? "copy_failed" : "not_in_library" });
      }
    } else if (att.kind === "youtube") {
      const id = youtubeIdFromUrl(att.url);
      if (id) materials.push({ youtubeVideo: { id } });
      else if (att.url) materials.push({ link: { url: att.url } });
    } else if (att.kind === "link" && att.url) {
      materials.push({ link: { url: att.url } });
    } else {
      notCopied.push({ title, reason: att.unsupported_type === "form" ? "form" : "other" });
    }
  }
  return { materials, notCopied };
}

const REASON_TEXT: Record<NotCopied["reason"], string> = {
  form: "a Google Form that can't be copied",
  other: "an attachment that can't be copied",
  not_in_library: "a file that wasn't shared to the library",
  copy_failed: "a file that failed to copy",
};

export function describeNotCopied(n: NotCopied): string {
  return `“${n.title}” (${REASON_TEXT[n.reason]})`;
}

// Appended to the draft's instructions so the forking teacher sees what to re-add.
export function reAddNote(notCopied: NotCopied[]): string {
  if (notCopied.length === 0) return "";
  const lines = notCopied.map((n) => `- ${describeNotCopied(n)}`);
  return `\n\nNote from Fork Lesson: the original lesson also had these. Please re-add them:\n${lines.join("\n")}`;
}
