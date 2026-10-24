import "server-only";
import { apiError } from "./classroom";
import type { Material } from "@/lib/fork/plan";

// Classroom calls that WRITE to the signed-in teacher's own classes: a topic
// and a DRAFT assignment. Errors carry the HTTP status and Google's status
// word only.

const CLASSROOM = "https://classroom.googleapis.com/v1";

async function post<T>(url: string, token: string, body: object): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as T;
}

export async function createTopic(courseId: string, name: string, token: string): Promise<string> {
  const topic = await post<{ topicId: string }>(`${CLASSROOM}/courses/${courseId}/topics`, token, { name });
  return topic.topicId;
}

export type DraftCourseWork = {
  title: string;
  description: string;
  workType: "ASSIGNMENT" | "SHORT_ANSWER_QUESTION";
  maxPoints: number | null;
  topicId: string | null;
  materials: Material[];
};

// Always a DRAFT with no due date, so students see nothing until the teacher
// posts it.
export async function createDraftCourseWork(
  courseId: string,
  draft: DraftCourseWork,
  token: string
): Promise<{ id: string; alternateLink?: string }> {
  return post(`${CLASSROOM}/courses/${courseId}/courseWork`, token, {
    title: draft.title,
    ...(draft.description ? { description: draft.description } : {}),
    workType: draft.workType,
    state: "DRAFT",
    ...(draft.maxPoints !== null ? { maxPoints: draft.maxPoints } : {}),
    ...(draft.topicId ? { topicId: draft.topicId } : {}),
    ...(draft.materials.length ? { materials: draft.materials } : {}),
  });
}
