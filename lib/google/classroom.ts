import "server-only";
import type { ClassroomCourseWork } from "@/lib/sync/map";

// Read-only Classroom and Drive calls for sync. Nothing here changes Google
// data, and errors carry only the HTTP status and Google's status word,
// never a response body.

export class GoogleApiError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly googleStatus: string | null
  ) {
    super(`Google API ${httpStatus}${googleStatus ? ` ${googleStatus}` : ""}`);
  }
}

async function getJson<T>(url: URL, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) {
    let googleStatus: string | null = null;
    try {
      const body = await response.json();
      if (typeof body?.error?.status === "string") googleStatus = body.error.status;
    } catch {
      // not JSON; the HTTP status is enough
    }
    throw new GoogleApiError(response.status, googleStatus);
  }
  return (await response.json()) as T;
}

async function listAll<T>(base: string, key: string, params: Record<string, string>, token: string): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(base);
    Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await getJson<Record<string, unknown>>(url, token);
    items.push(...((page[key] as T[] | undefined) ?? []));
    pageToken = typeof page.nextPageToken === "string" ? page.nextPageToken : undefined;
  } while (pageToken);
  return items;
}

const CLASSROOM = "https://classroom.googleapis.com/v1";

export type ClassroomCourse = { id: string; name?: string; section?: string };
export type ClassroomTopic = { topicId: string; name?: string };

export function listCourses(token: string) {
  return listAll<ClassroomCourse>(
    `${CLASSROOM}/courses`,
    "courses",
    { teacherId: "me", courseStates: "ACTIVE", pageSize: "100" },
    token
  );
}

export function listTopics(courseId: string, token: string) {
  return listAll<ClassroomTopic>(`${CLASSROOM}/courses/${courseId}/topics`, "topic", { pageSize: "100" }, token);
}

export function listCourseWork(courseId: string, token: string) {
  return listAll<ClassroomCourseWork>(
    `${CLASSROOM}/courses/${courseId}/courseWork`,
    "courseWork",
    { courseWorkStates: "PUBLISHED", pageSize: "100" },
    token
  );
}

// Metadata only (the type), so the page can say PDF or Doc. Null on any failure.
export async function getDriveMimeType(fileId: string, token: string): Promise<string | null> {
  try {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
    url.searchParams.set("fields", "mimeType");
    url.searchParams.set("supportsAllDrives", "true");
    const file = await getJson<{ mimeType?: string }>(url, token);
    return file.mimeType ?? null;
  } catch {
    return null;
  }
}
