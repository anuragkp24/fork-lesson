import "server-only";
import { randomUUID } from "crypto";
import { GoogleApiError, apiError } from "./classroom";
import { isAllowedThumbnailUrl } from "@/lib/cards/thumbnail";
import { multipartBody, reuploadPlan } from "./drive-format";

// Drive calls for the library folder. These WRITE to the signed-in teacher's
// Drive, but only ever create: a folder, copies inside it, and a domain share
// on that folder. Originals are only read. Errors carry the HTTP status and
// Google's status word, never a response body.

const FILES = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

async function driveFetch(url: string | URL, token: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (!response.ok) throw await apiError(response);
  return response;
}

function withParams(base: string, params: Record<string, string>): URL {
  const url = new URL(base);
  url.searchParams.set("supportsAllDrives", "true");
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  return url;
}

function jsonInit(method: string, body: object): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// True when the folder is there and not in the trash.
export async function folderUsable(folderId: string, token: string): Promise<boolean> {
  try {
    const response = await driveFetch(withParams(`${FILES}/${encodeURIComponent(folderId)}`, { fields: "trashed" }), token);
    return !((await response.json()) as { trashed?: boolean }).trashed;
  } catch (err) {
    if (err instanceof GoogleApiError && (err.httpStatus === 404 || err.httpStatus === 403)) return false;
    throw err;
  }
}

export async function createFolder(name: string, token: string): Promise<string> {
  const response = await driveFetch(
    withParams(FILES, { fields: "id" }),
    token,
    jsonInit("POST", { name, mimeType: FOLDER_MIME })
  );
  return ((await response.json()) as { id: string }).id;
}

// Makes sure the whole domain can read the folder (and so its files). Does
// nothing when that share is already there.
export async function ensureDomainReader(folderId: string, domain: string, token: string): Promise<void> {
  const list = await driveFetch(
    withParams(`${FILES}/${encodeURIComponent(folderId)}/permissions`, { fields: "permissions(type,domain,role)" }),
    token
  );
  const { permissions = [] } = (await list.json()) as {
    permissions?: { type: string; domain?: string; role: string }[];
  };
  if (permissions.some((p) => p.type === "domain" && p.domain === domain)) return;

  await driveFetch(
    withParams(`${FILES}/${encodeURIComponent(folderId)}/permissions`, { fields: "id" }),
    token,
    jsonInit("POST", { type: "domain", domain, role: "reader", allowFileDiscovery: false })
  );
}

export async function getFileInfo(fileId: string, token: string): Promise<{ mimeType: string; name: string }> {
  const response = await driveFetch(
    withParams(`${FILES}/${encodeURIComponent(fileId)}`, { fields: "mimeType,name" }),
    token
  );
  return (await response.json()) as { mimeType: string; name: string };
}

// Straight copy into the folder. The cleanest result, but files.copy is
// authorized by drive.file, which only reaches files this app made, so it can
// fail on a teacher's own originals (404/403).
export async function copyFile(fileId: string, name: string, folderId: string, token: string): Promise<string> {
  const response = await driveFetch(
    withParams(`${FILES}/${encodeURIComponent(fileId)}/copy`, { fields: "id" }),
    token,
    jsonInit("POST", { name, parents: [folderId] })
  );
  return ((await response.json()) as { id: string }).id;
}

// Fallback: read the original (drive.readonly) and create a new file from its
// content (drive.file). Docs, Sheets and Slides go through Office formats and
// are converted back, so formatting can differ slightly from a true copy.
export async function reuploadFile(
  fileId: string,
  name: string,
  mimeType: string,
  folderId: string,
  token: string
): Promise<string> {
  const plan = reuploadPlan(mimeType);
  if (!plan) throw new Error("unsupported_type");

  const source = plan.exportAs
    ? withParams(`${FILES}/${encodeURIComponent(fileId)}/export`, { mimeType: plan.exportAs })
    : withParams(`${FILES}/${encodeURIComponent(fileId)}`, { alt: "media" });
  const content = new Uint8Array(await (await driveFetch(source, token)).arrayBuffer());

  const boundary = `fl_${randomUUID()}`;
  const response = await driveFetch(
    withParams(UPLOAD, { uploadType: "multipart", fields: "id" }),
    token,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: new Uint8Array(
        multipartBody({ name, mimeType: plan.uploadAs, parents: [folderId] }, plan.contentType, content, boundary)
      ),
    }
  );
  return ((await response.json()) as { id: string }).id;
}

// Moves a file to the trash (reversible, unlike delete). Used to undo copies
// when a fork fails after copying.
export async function trashFile(fileId: string, token: string): Promise<void> {
  await driveFetch(
    withParams(`${FILES}/${encodeURIComponent(fileId)}`, { fields: "id" }),
    token,
    jsonInit("PATCH", { trashed: true })
  );
}

// files.copy first; if Drive refuses (403/404, because drive.file only
// reaches files this app made), read + create instead.
export async function copyWithFallback(
  fileId: string,
  name: string,
  mimeType: string | null,
  folderId: string,
  token: string
): Promise<{ id: string; method: "copy" | "reupload" }> {
  try {
    return { id: await copyFile(fileId, name, folderId, token), method: "copy" };
  } catch (err) {
    if (!(err instanceof GoogleApiError) || (err.httpStatus !== 403 && err.httpStatus !== 404)) throw err;
    const type = mimeType ?? (await getFileInfo(fileId, token)).mimeType;
    return { id: await reuploadFile(fileId, name, type, folderId, token), method: "reupload" };
  }
}

// Read-only: whether Drive has a picture for a file yet, and where. The link
// is short-lived and only works with a credentialed request.
export async function getThumbnailInfo(
  fileId: string,
  token: string
): Promise<{ hasThumbnail: boolean; thumbnailLink: string | null; thumbnailVersion: string | null }> {
  const response = await driveFetch(
    withParams(`${FILES}/${encodeURIComponent(fileId)}`, { fields: "hasThumbnail,thumbnailLink,thumbnailVersion" }),
    token
  );
  const body = (await response.json()) as { hasThumbnail?: boolean; thumbnailLink?: string; thumbnailVersion?: string };
  return {
    hasThumbnail: !!body.hasThumbnail,
    thumbnailLink: body.thumbnailLink ?? null,
    thumbnailVersion: body.thumbnailVersion ?? null,
  };
}

const THUMBNAIL_MAX_BYTES = 1024 * 1024;
const THUMBNAIL_MAX_REDIRECTS = 2;

// Downloads a picture from a thumbnailLink with the teacher's token. Only
// https googleusercontent.com hosts (redirects included), only image types,
// at most 1 MB. Returns null for anything else; never throws on bad content.
export async function fetchThumbnail(
  link: string,
  token: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  let url = link;
  for (let hops = 0; hops <= THUMBNAIL_MAX_REDIRECTS; hops++) {
    if (!isAllowedThumbnailUrl(url)) return null;
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      if (!next) return null;
      url = new URL(next, url).toString();
      continue;
    }
    if (!response.ok) throw await apiError(response);

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(png|jpeg|gif|webp)$/.test(contentType)) return null;
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > THUMBNAIL_MAX_BYTES || !response.body) return null;

    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > THUMBNAIL_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return { bytes, contentType };
  }
  return null;
}
