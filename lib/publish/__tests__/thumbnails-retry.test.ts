import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/google/drive", () => ({
  getThumbnailInfo: vi.fn(async () => ({ hasThumbnail: false, thumbnailLink: null, thumbnailVersion: null })),
  fetchThumbnail: vi.fn(),
}));

import { getThumbnailInfo } from "@/lib/google/drive";
import { RETRY_WAIT_MS, retryNewPictures } from "../thumbnails";

// Just enough of the Supabase query builder for retryNewPictures.
function fakeAdmin(rows: { id: string; position: number; kind: string; library_file_id: string; thumbnail_path: null }[]) {
  const updates: string[] = [];
  const select = {
    in: () => select,
    is: () => select,
    not: async () => ({ data: rows, error: null }),
  };
  return {
    updates,
    client: {
      from: () => ({
        select: () => select,
        update: () => ({
          eq: async (_col: string, id: string) => {
            updates.push(id);
            return { error: null };
          },
        }),
      }),
    } as never,
  };
}

const row = (id: string) => ({ id, position: 0, kind: "drive", library_file_id: `lib-${id}`, thumbnail_path: null });

describe("retryNewPictures", () => {
  it("does nothing, and does not wait, when nothing was copied in this run", async () => {
    const wait = vi.fn(async () => {});
    const { client } = fakeAdmin([]);
    await retryNewPictures(client, "u1", "token", [], wait);
    expect(wait).not.toHaveBeenCalled();
  });

  it("does not wait when every new copy already has a picture", async () => {
    const wait = vi.fn(async () => {});
    const { client } = fakeAdmin([]);
    await retryNewPictures(client, "u1", "token", ["a1"], wait);
    expect(wait).not.toHaveBeenCalled();
  });

  it("waits once, then looks again at each new copy without a picture", async () => {
    vi.mocked(getThumbnailInfo).mockClear();
    const wait = vi.fn(async () => {});
    const { client, updates } = fakeAdmin([row("a1"), row("a2")]);
    await retryNewPictures(client, "u1", "token", ["a1", "a2"], wait);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(RETRY_WAIT_MS);
    expect(getThumbnailInfo).toHaveBeenCalledTimes(2);
    expect(updates).toEqual(["a1", "a2"]); // still no picture: the check is stamped
  });

  it("looks at no more than ten files", async () => {
    vi.mocked(getThumbnailInfo).mockClear();
    const ids = Array.from({ length: 14 }, (_, i) => `a${i}`);
    const { client } = fakeAdmin(ids.map(row));
    await retryNewPictures(client, "u1", "token", ids, async () => {});
    expect(getThumbnailInfo).toHaveBeenCalledTimes(10);
  });

  it("never throws", async () => {
    const broken = { from: () => { throw new Error("db down"); } } as never;
    await expect(retryNewPictures(broken, "u1", "token", ["a1"], async () => {})).resolves.toBeUndefined();
  });
});
