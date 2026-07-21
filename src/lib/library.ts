import { get, set, del, keys } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";

export type LibraryKind = "artwork" | "wall";

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  name: string;
  dataUrl: string; // always a data:image/* URL (needed by server fn)
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  remote?: boolean;
  storagePath?: string;
  dirty?: boolean; // local edits not yet pushed to cloud
}

const PREFIX = "mural.lib.";
const BUCKET = "library";
const keyFor = (id: string) => `${PREFIX}${id}`;

// ---------- local (IndexedDB) ----------
async function getLocal(id: string): Promise<LibraryItem | undefined> {
  return await get<LibraryItem>(keyFor(id));
}

async function putLocal(item: LibraryItem): Promise<void> {
  await set(keyFor(item.id), item);
}

async function listLocalAll(): Promise<LibraryItem[]> {
  const allKeys = await keys();
  const items: LibraryItem[] = [];
  for (const k of allKeys) {
    if (typeof k === "string" && k.startsWith(PREFIX)) {
      const v = await get<LibraryItem>(k);
      if (v) items.push(v);
    }
  }
  return items;
}

// ---------- helpers ----------
function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const ext = mime.split("/")[1]?.split("+")[0] ?? "png";
  return { blob: new Blob([arr], { type: mime }), ext };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function newerWins(a: LibraryItem, b: LibraryItem): LibraryItem {
  return a.updatedAt >= b.updatedAt ? a : b;
}

// ---------- cloud primitives ----------
interface CloudRow {
  id: string;
  kind: LibraryKind;
  name: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

async function fetchCloudRows(): Promise<CloudRow[]> {
  const { data, error } = await supabase
    .from("library_items")
    .select("id, kind, name, storage_path, created_at, updated_at, deleted_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CloudRow[];
}

async function downloadCloudDataUrl(path: string): Promise<string | null> {
  const { data: file } = await supabase.storage.from(BUCKET).download(path);
  if (!file) return null;
  return await blobToDataUrl(file);
}

async function uploadCloudFile(userId: string, id: string, dataUrl: string): Promise<string> {
  const { blob, ext } = dataUrlToBlob(dataUrl);
  const path = `${userId}/${id}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  return path;
}

async function pushLocalToCloud(userId: string, item: LibraryItem): Promise<LibraryItem> {
  // Ensure file present when we have raw data; if item was cloud-origin with only a
  // rename change we can skip re-upload.
  let path = item.storagePath;
  if (!path) path = await uploadCloudFile(userId, item.id, item.dataUrl);
  const payload = {
    id: item.id,
    user_id: userId,
    kind: item.kind,
    name: item.name,
    storage_path: path,
    created_at: new Date(item.createdAt).toISOString(),
    updated_at: new Date(item.updatedAt).toISOString(),
    deleted_at: item.deletedAt ? new Date(item.deletedAt).toISOString() : null,
  };
  const { error } = await supabase
    .from("library_items")
    .upsert(payload, { onConflict: "id" });
  if (error) throw error;
  return { ...item, remote: true, storagePath: path, dirty: false };
}

// ---------- merge / sync ----------
async function syncWithCloud(userId: string): Promise<LibraryItem[]> {
  const localItems = await listLocalAll();
  const localMap = new Map(localItems.map((i) => [i.id, i]));

  const cloudRows = await fetchCloudRows();
  const cloudMap = new Map(cloudRows.map((r) => [r.id, r]));

  const seen = new Set<string>();

  // 1. Reconcile items present in cloud (with or without local twin).
  for (const row of cloudRows) {
    seen.add(row.id);
    const cloudUpdatedAt = new Date(row.updated_at).getTime();
    const cloudDeletedAt = row.deleted_at ? new Date(row.deleted_at).getTime() : undefined;
    const local = localMap.get(row.id);

    if (local && local.updatedAt > cloudUpdatedAt) {
      // Local is newer — push (may be rename or tombstone).
      try {
        const pushed = await pushLocalToCloud(userId, local);
        await putLocal(pushed);
      } catch (e) {
        console.warn("push newer local failed", row.id, e);
      }
      continue;
    }

    // Cloud is newer or equal — adopt cloud version locally.
    let dataUrl = local?.dataUrl;
    if (!dataUrl || (local && local.storagePath !== row.storage_path)) {
      dataUrl = (await downloadCloudDataUrl(row.storage_path)) ?? "";
    }
    const merged: LibraryItem = {
      id: row.id,
      kind: row.kind,
      name: row.name,
      dataUrl: dataUrl ?? "",
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: cloudUpdatedAt,
      deletedAt: cloudDeletedAt,
      remote: true,
      storagePath: row.storage_path,
      dirty: false,
    };
    if (merged.dataUrl) await putLocal(merged);
  }

  // 2. Local-only items → push if not yet in cloud.
  for (const local of localItems) {
    if (seen.has(local.id)) continue;
    try {
      const pushed = await pushLocalToCloud(userId, local);
      await putLocal(pushed);
    } catch (e) {
      console.warn("push local-only failed", local.id, e);
}

// ---------- shareable signed links ----------
// Mints a time-limited signed URL for a cloud library item. Only works for
// items already synced to cloud (item.storagePath present) and while the
// caller is signed in — RLS on the bucket enforces that only the owner can
// mint the link. The recipient of the link does NOT need an account.
export async function createShareLink(
  item: LibraryItem,
  expiresInSeconds: number = 60 * 60 * 24 * 7, // 7 days
): Promise<string> {
  if (!item.storagePath) {
    throw new Error("This item is only stored locally. Sign in to sync it, then share.");
  }
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(item.storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Failed to create share link");
  }
  return data.signedUrl;
}
  }

  // 3. Return active, freshest local snapshot.
  const finalItems = await listLocalAll();
  return finalItems
    .filter((i) => !i.deletedAt && i.dataUrl)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ---------- public API ----------
export async function listLibrary(): Promise<LibraryItem[]> {
  const uid = await currentUserId();
  if (uid) {
    try {
      return await syncWithCloud(uid);
    } catch (e) {
      console.warn("cloud sync failed, using local", e);
    }
  }
  const items = await listLocalAll();
  return items
    .filter((i) => !i.deletedAt)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveLibraryItem(
  kind: LibraryKind,
  dataUrl: string,
  name?: string,
): Promise<LibraryItem> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const item: LibraryItem = {
    id,
    kind,
    name: name ?? `${kind === "artwork" ? "Artwork" : "Wall"} ${new Date().toLocaleString()}`,
    dataUrl,
    createdAt: now,
    updatedAt: now,
    dirty: true,
  };
  await putLocal(item);

  const uid = await currentUserId();
  if (uid) {
    try {
      const pushed = await pushLocalToCloud(uid, item);
      await putLocal(pushed);
      return pushed;
    } catch (e) {
      console.warn("cloud save failed, kept local (will retry on next sync)", e);
    }
  }
  return item;
}

export async function renameLibraryItem(id: string, name: string): Promise<void> {
  const local = await getLocal(id);
  if (!local) return;
  const updated: LibraryItem = { ...local, name, updatedAt: Date.now(), dirty: true };
  await putLocal(updated);
  const uid = await currentUserId();
  if (uid) {
    try {
      const pushed = await pushLocalToCloud(uid, updated);
      await putLocal(pushed);
    } catch (e) {
      console.warn("cloud rename failed, will retry on next sync", e);
    }
  }
}

export async function deleteLibraryItem(id: string): Promise<void> {
  const local = await getLocal(id);
  const now = Date.now();
  const tombstone: LibraryItem = local
    ? { ...local, deletedAt: now, updatedAt: now, dirty: true }
    : {
        id,
        kind: "artwork",
        name: "",
        dataUrl: "",
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
        dirty: true,
      };
  await putLocal(tombstone);

  const uid = await currentUserId();
  if (uid) {
    try {
      const { error } = await supabase
        .from("library_items")
        .update({ deleted_at: new Date(now).toISOString() })
        .eq("id", id);
      if (error) throw error;
      // Best-effort: remove the underlying file too so storage doesn't linger.
      if (local?.storagePath) {
        await supabase.storage.from(BUCKET).remove([local.storagePath]);
      }
      await putLocal({ ...tombstone, dirty: false, remote: true });
    } catch (e) {
      console.warn("cloud delete failed, will retry on next sync", e);
    }
  } else {
    // Offline / signed out — drop the tombstone locally after a short delay by
    // just removing the empty record now; nothing to sync.
    if (!local || !local.storagePath) await del(keyFor(id));
  }
}

// ---------- migration ----------
const MIGRATED_FLAG = "mural.lib.migrated.";

export async function migrateLocalToCloudIfNeeded(userId: string): Promise<number> {
  const flagKey = `${MIGRATED_FLAG}${userId}`;
  if (localStorage.getItem(flagKey)) return 0;
  const local = await listLocalAll();
  let count = 0;
  for (const it of local) {
    if (it.deletedAt) continue;
    try {
      const pushed = await pushLocalToCloud(userId, it);
      await putLocal(pushed);
      count++;
    } catch (e) {
      console.warn("migrate item failed", it.id, e);
    }
  }
  localStorage.setItem(flagKey, String(Date.now()));
  return count;
}

// Kept for compatibility with older callers that import this helper.
export { newerWins as __newerWins };
