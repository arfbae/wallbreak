import { get, set, del, keys } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";

export type LibraryKind = "artwork" | "wall";

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  name: string;
  dataUrl: string; // always a data:image/* URL (needed by server fn)
  createdAt: number;
  remote?: boolean;
  storagePath?: string;
}

const PREFIX = "mural.lib.";
const BUCKET = "library";
const keyFor = (id: string) => `${PREFIX}${id}`;

// ---------- local (IndexedDB) ----------
async function listLocal(): Promise<LibraryItem[]> {
  const allKeys = await keys();
  const items: LibraryItem[] = [];
  for (const k of allKeys) {
    if (typeof k === "string" && k.startsWith(PREFIX)) {
      const v = await get<LibraryItem>(k);
      if (v) items.push(v);
    }
  }
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

async function saveLocal(kind: LibraryKind, dataUrl: string, name?: string): Promise<LibraryItem> {
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: LibraryItem = {
    id,
    kind,
    name: name ?? `${kind === "artwork" ? "Artwork" : "Wall"} ${new Date().toLocaleString()}`,
    dataUrl,
    createdAt: Date.now(),
  };
  await set(keyFor(id), item);
  return item;
}

async function deleteLocal(id: string): Promise<void> {
  await del(keyFor(id));
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

// ---------- cloud ----------
async function listCloud(userId: string): Promise<LibraryItem[]> {
  const { data, error } = await supabase
    .from("library_items")
    .select("id, kind, name, storage_path, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const items: LibraryItem[] = [];
  for (const row of data ?? []) {
    const { data: file } = await supabase.storage.from(BUCKET).download(row.storage_path);
    if (!file) continue;
    const dataUrl = await blobToDataUrl(file);
    items.push({
      id: row.id,
      kind: row.kind as LibraryKind,
      name: row.name,
      dataUrl,
      createdAt: new Date(row.created_at).getTime(),
      remote: true,
      storagePath: row.storage_path,
    });
  }
  return items;
  void userId;
}

async function saveCloud(
  userId: string,
  kind: LibraryKind,
  dataUrl: string,
  name?: string,
): Promise<LibraryItem> {
  const { blob, ext } = dataUrlToBlob(dataUrl);
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (upErr) throw upErr;
  const displayName = name ?? `${kind === "artwork" ? "Artwork" : "Wall"} ${new Date().toLocaleString()}`;
  const { data: row, error: insErr } = await supabase
    .from("library_items")
    .insert({ id, user_id: userId, kind, name: displayName, storage_path: path })
    .select()
    .single();
  if (insErr) throw insErr;
  return {
    id: row.id,
    kind,
    name: displayName,
    dataUrl,
    createdAt: new Date(row.created_at).getTime(),
    remote: true,
    storagePath: path,
  };
}

async function deleteCloud(id: string): Promise<void> {
  const { data: row } = await supabase
    .from("library_items")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (row?.storage_path) {
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
  }
  await supabase.from("library_items").delete().eq("id", id);
}

// ---------- public API (auto-routes cloud vs local) ----------
export async function listLibrary(): Promise<LibraryItem[]> {
  const uid = await currentUserId();
  if (uid) {
    try {
      return await listCloud(uid);
    } catch (e) {
      console.warn("cloud list failed, falling back to local", e);
    }
  }
  return listLocal();
}

export async function saveLibraryItem(
  kind: LibraryKind,
  dataUrl: string,
  name?: string,
): Promise<LibraryItem> {
  const uid = await currentUserId();
  if (uid) {
    try {
      return await saveCloud(uid, kind, dataUrl, name);
    } catch (e) {
      console.warn("cloud save failed, saving locally", e);
    }
  }
  return saveLocal(kind, dataUrl, name);
}

export async function deleteLibraryItem(id: string): Promise<void> {
  const uid = await currentUserId();
  if (uid) {
    try {
      await deleteCloud(id);
      return;
    } catch (e) {
      console.warn("cloud delete failed, trying local", e);
    }
  }
  await deleteLocal(id);
}

// ---------- migration ----------
const MIGRATED_FLAG = "mural.lib.migrated.";

export async function migrateLocalToCloudIfNeeded(userId: string): Promise<number> {
  const flagKey = `${MIGRATED_FLAG}${userId}`;
  if (localStorage.getItem(flagKey)) return 0;
  const local = await listLocal();
  let count = 0;
  for (const it of local) {
    try {
      await saveCloud(userId, it.kind, it.dataUrl, it.name);
      await deleteLocal(it.id);
      count++;
    } catch (e) {
      console.warn("migrate item failed", it.id, e);
    }
  }
  localStorage.setItem(flagKey, String(Date.now()));
  return count;
}
