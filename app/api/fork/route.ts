import { NextResponse, type NextRequest } from "next/server";
import { getAccessToken } from "@/lib/google/access-token";
import { isTopicChoice } from "@/lib/fork/plan";
import { runFork } from "@/lib/fork/run";
import { createClient, getUser } from "@/lib/supabase/server";

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  // Only our own pages may post here.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return error("Forbidden.", 403);

  const user = await getUser();
  if (!user) return error("Please sign in again.", 401);

  const body = await request.json().catch(() => null);
  if (
    typeof body?.lessonId !== "string" ||
    typeof body?.courseId !== "string" ||
    !isTopicChoice(body?.topicChoice)
  ) {
    return error("Bad request.", 400);
  }

  const token = await getAccessToken(user.id);
  if (token.status !== "ok") {
    return error(
      token.status === "reconnect_required" ? "Google needs you to sign in again." : "Couldn't reach Google. Try again.",
      token.status === "reconnect_required" ? 401 : 502
    );
  }

  const result = await runFork({
    userId: user.id,
    token: token.accessToken,
    lessonId: body.lessonId,
    courseId: body.courseId,
    topicChoice: body.topicChoice,
    supabase: await createClient(),
  });

  if (!result.ok) return error(result.error, result.httpStatus);
  return NextResponse.json(result);
}
