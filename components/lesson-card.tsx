import Link from "next/link";
import type { ReactNode } from "react";
import { CardPicture } from "@/components/card-picture";
import { ForkIcon } from "@/components/fork-icon";
import { SaveButton } from "@/components/save-button";
import { YouTag } from "@/components/you-tag";
import { cardMedia, type MediaAttachment } from "@/lib/cards/media";
import type { TagCount } from "@/lib/hub/tags";
import { forkedLabel } from "@/lib/library/forks";
import { attachmentLabel } from "@/lib/sync/map";
import { card } from "@/lib/ui";

export type CardAttachment = MediaAttachment & { unsupported_type: string | null };

// "Forked 3 times" with the fork icon, or a quiet "Not forked yet".
export function ForkedCount({ count }: { count: number }) {
  const label = forkedLabel(count);
  return label ? (
    <span className="inline-flex items-center gap-1.5 font-semibold text-brand">
      <ForkIcon /> {label}
    </span>
  ) : (
    <span className="text-muted">Not forked yet</span>
  );
}

// One lesson card, for the Library, Saved and My lessons. Three parts in the
// same places on every card: the picture (same size, file types as labels on
// it), the text, and a bottom line pinned to the bottom. The title is the
// link and stretches over the whole card (after:absolute); anything else
// clickable in the footer sits on top of it (relative z-10), so links and
// buttons never nest.
export function LessonCard({
  href,
  title,
  classLine,
  course,
  teacher,
  isYou = false,
  topic,
  attachments,
  lessonId,
  pictureLessonId,
  pictureAttachments,
  tags = [],
  notice,
  footerLeft,
  footerRight,
}: {
  href: string | null;
  title: string;
  classLine?: string;
  course?: string | null;
  teacher?: string | null;
  isYou?: boolean;
  topic?: string | null;
  attachments: CardAttachment[];
  lessonId: string;
  // A fork card shows its original's picture.
  pictureLessonId?: string;
  pictureAttachments?: MediaAttachment[];
  tags?: TagCount[];
  notice?: ReactNode;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
}) {
  const media = cardMedia(pictureLessonId ?? lessonId, pictureAttachments ?? attachments);
  const labels = [...attachments].sort((a, b) => a.position - b.position).map(attachmentLabel);
  return (
    <div
      className={`${card} relative flex h-full flex-col overflow-hidden transition-colors ${href ? "hover:border-brand" : ""}`}
    >
      <CardPicture media={media} course={course} labels={labels} />
      <div className="flex flex-1 flex-col gap-1 px-3.5 pt-3">
        <p className="truncate text-[11px] font-bold uppercase tracking-[.06em] text-brand">{classLine ?? " "}</p>
        <h4 className="line-clamp-2 min-h-[2.6em] text-[15.5px] font-bold leading-[1.3]">
          {href ? (
            <Link href={href} className="after:absolute after:inset-0 after:content-[''] hover:text-brand">
              {title}
            </Link>
          ) : (
            title
          )}
        </h4>
        <p className="flex min-h-[1.2em] min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
          {isYou ? <YouTag /> : teacher && <span className="truncate">{teacher}</span>}
          {topic && <span className="truncate">{teacher && !isYou ? "· " : ""}{topic}</span>}
        </p>
        <div className="mt-1 flex min-h-[22px] flex-nowrap items-center gap-1 overflow-hidden">
          {tags.length > 0 ? (
            <ul className="flex flex-nowrap gap-1" aria-label="What teachers like">
              {tags.map((t) => (
                <li
                  key={t.tag}
                  className="whitespace-nowrap rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand"
                >
                  {t.label} · {t.n}
                </li>
              ))}
            </ul>
          ) : (
            notice
          )}
        </div>
      </div>
      <div className="mx-0 mt-2.5 flex min-h-[38px] items-center justify-between gap-2 border-t border-line/60 px-3.5 py-2 text-xs">
        <div className="relative z-10 flex min-w-0 items-center">{footerLeft}</div>
        <div className="relative z-10 flex shrink-0 items-center">{footerRight}</div>
      </div>
    </div>
  );
}

export type LibraryLesson = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  topic_name: string | null;
  source_updated_at: string | null;
  teacher: { name: string | null; email: string } | null;
  course: { name: string; section: string | null } | null;
  attachments: CardAttachment[];
};

// users!lessons_owner_id_fkey: saved_lessons is a second lessons-to-users path,
// so a bare users embed is ambiguous (PGRST201).
export const LIBRARY_LESSON_SELECT =
  "id, owner_id, title, description, topic_name, source_updated_at, teacher:users!lessons_owner_id_fkey(name, email), course:courses(name, section), attachments(kind, mime_type, url, unsupported_type, position, library_file_id, thumbnail_path, thumbnail_version)";

// A Library or Saved card: class, teacher, top tags, how often it was forked,
// and the Save button on everyone else's lessons.
export function LibraryCard({
  lesson,
  mine,
  saved,
  forkCount,
  tags,
}: {
  lesson: LibraryLesson;
  mine: boolean;
  saved: boolean;
  forkCount: number;
  tags: TagCount[];
}) {
  const classLine = lesson.course
    ? `${lesson.course.name}${lesson.course.section ? ` · ${lesson.course.section}` : ""}`
    : "Class";
  return (
    <LessonCard
      href={`/lesson/${lesson.id}`}
      title={lesson.title}
      classLine={classLine}
      course={lesson.course?.name}
      teacher={lesson.teacher?.name ?? lesson.teacher?.email ?? "A teacher"}
      isYou={mine}
      topic={lesson.topic_name}
      attachments={lesson.attachments}
      lessonId={lesson.id}
      tags={tags}
      footerLeft={<ForkedCount count={forkCount} />}
      footerRight={mine ? null : <SaveButton lessonId={lesson.id} initialSaved={saved} />}
    />
  );
}
