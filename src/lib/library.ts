import { get, set, del, keys } from "idb-keyval";

export type LibraryKind = "artwork" | "wall";

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  name: string;
  dataUrl: string;
  createdAt: number;
}

const PREFIX = "mural.lib.";
const keyFor = (id: string) => `${PREFIX}${id}`;

export async function listLibrary(): Promise<LibraryItem[]> {
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

export async function saveLibraryItem(
  kind: LibraryKind,
  dataUrl: string,
  name?: string,
): Promise<LibraryItem> {
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

export async function deleteLibraryItem(id: string): Promise<void> {
  await del(keyFor(id));
}
