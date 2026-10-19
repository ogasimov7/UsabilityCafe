import "server-only";
import { mkdir, writeFile, readFile, readdir, stat, rm, access } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { del, get, head, list, put } from "@vercel/blob";

// Files live in a private Vercel Blob store when one is connected, otherwise on local disk (./storage).
// Recordings arrive as numbered parts ("<file>.parts/000001") and are joined into one file on submit.
export const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const ROOT = path.join(process.cwd(), "storage");
// Vercel Functions cap responses at 4.5 MB, so ranged reads are served in slices the browser keeps requesting.
const MAX_SLICE = 4 * 1024 * 1024;

function local(rel: string) {
  const full = path.join(ROOT, rel);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Bad path");
  return full;
}

const partPath = (rel: string, index: number) => `${rel}.parts/${String(index).padStart(6, "0")}`;

async function exists(rel: string) {
  if (USE_BLOB) return head(rel).then(() => true, () => false);
  return access(local(rel)).then(() => true, () => false);
}

async function write(rel: string, data: Buffer | ArrayBuffer, contentType?: string) {
  if (USE_BLOB) {
    await put(rel, data instanceof ArrayBuffer ? Buffer.from(data) : data, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
    return;
  }
  const full = local(rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data));
}

export async function saveUpload(folder: string, file: File) {
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "") || "";
  const rel = `${folder}/${randomUUID()}${ext}`;
  await write(rel, await file.arrayBuffer(), file.type || undefined);
  return rel;
}

/** Stores one recording part. Parts must arrive in order; re-sent parts are ignored. */
export async function putChunk(rel: string, index: number, data: ArrayBuffer): Promise<"ok" | "duplicate" | "out-of-order"> {
  if (await exists(partPath(rel, index))) return "duplicate";
  if (index > 0 && !(await exists(partPath(rel, index - 1)))) return "out-of-order";
  await write(partPath(rel, index), data);
  return "ok";
}

async function partNames(rel: string) {
  if (USE_BLOB) {
    const names: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: `${rel}.parts/`, cursor });
      names.push(...page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return names.sort();
  }
  const dir = local(`${rel}.parts`);
  const files = await readdir(dir).catch(() => [] as string[]);
  return files.sort().map((f) => `${rel}.parts/${f}`);
}

async function readAll(rel: string) {
  if (USE_BLOB) {
    const r = await get(rel, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) throw new Error(`Missing ${rel}`);
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  }
  return readFile(local(rel));
}

/** Joins the uploaded parts of a recording into a single playable file. */
export async function finalizeRecording(rel: string, contentType: string) {
  const parts = await partNames(rel);
  if (!parts.length) return;
  const buffers: Buffer[] = [];
  for (const p of parts) buffers.push(await readAll(p));
  await write(rel, Buffer.concat(buffers), contentType);
  await removeFiles(parts);
}

async function removeFiles(rels: string[]) {
  if (!rels.length) return;
  if (USE_BLOB) {
    for (let i = 0; i < rels.length; i += 500) await del(rels.slice(i, i + 500));
    return;
  }
  await Promise.all(rels.map((r) => rm(local(r), { force: true })));
}

/** Deletes everything stored under a folder, e.g. "sessions/<id>". */
export async function removeFolder(prefix: string) {
  if (!USE_BLOB) return rm(local(prefix), { recursive: true, force: true });
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `${prefix}/`, cursor });
    if (page.blobs.length) await del(page.blobs.map((b) => b.url));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}

export type FileRead = { stream: ReadableStream; size: number; start: number; end: number; partial: boolean };

/** Reads a stored file, optionally a byte range. Returns null when it doesn't exist. */
export async function readStored(rel: string, range?: { start: number; end?: number }): Promise<FileRead | null> {
  if (USE_BLOB) {
    const meta = await head(rel).catch(() => null);
    if (!meta) return null;
    const size = meta.size;
    if (!range && size <= MAX_SLICE) {
      const r = await get(rel, { access: "private" });
      if (!r || r.statusCode !== 200) return null;
      return { stream: r.stream, size, start: 0, end: size - 1, partial: false };
    }
    const start = range?.start ?? 0;
    if (start >= size) return { stream: new ReadableStream(), size, start, end: start - 1, partial: true };
    const end = Math.min(range?.end ?? size - 1, size - 1, start + MAX_SLICE - 1);
    const r = await get(rel, { access: "private", headers: { range: `bytes=${start}-${end}` } });
    if (!r || r.statusCode !== 200) return null;
    return { stream: r.stream, size, start, end, partial: true };
  }
  const full = local(rel);
  const s = await stat(full).catch(() => null);
  if (!s) return null;
  const start = range?.start ?? 0;
  const end = Math.min(range?.end ?? s.size - 1, s.size - 1);
  const node = start < s.size ? createReadStream(full, { start, end }) : Readable.from([]);
  return { stream: Readable.toWeb(node) as ReadableStream, size: s.size, start, end, partial: Boolean(range) };
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
