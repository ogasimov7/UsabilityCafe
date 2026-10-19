import "server-only";
import { mkdir, writeFile, appendFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Local disk storage for development. Swap for object storage (S3, Vercel Blob)
// plus a managed video service in production.
export const STORAGE_ROOT = path.join(process.cwd(), "storage");

function safe(rel: string) {
  const full = path.join(STORAGE_ROOT, rel);
  if (!full.startsWith(STORAGE_ROOT + path.sep)) throw new Error("Bad path");
  return full;
}

export async function saveUpload(folder: string, file: File) {
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "") || "";
  const rel = path.join(folder, `${randomUUID()}${ext}`);
  const full = safe(rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return rel;
}

export async function appendChunk(rel: string, data: ArrayBuffer, first: boolean) {
  const full = safe(rel);
  await mkdir(path.dirname(full), { recursive: true });
  if (first) await writeFile(full, Buffer.from(data));
  else await appendFile(full, Buffer.from(data));
}

export async function fileInfo(rel: string) {
  const full = safe(rel);
  const s = await stat(full);
  return { full, size: s.size };
}

export function readStream(full: string, start?: number, end?: number) {
  return createReadStream(full, { start, end });
}

export const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};
