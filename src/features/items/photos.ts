import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

import { runPool } from '@/lib/pool';
import { supabase } from '@/lib/supabase';
import type { ItemPhoto } from '@/types/database';

export const MAX_PHOTOS = 6;
const UPLOADS_AT_ONCE = 3;

/** A photo in the editor: a local file not uploaded yet, or a stored one. */
export type EditablePhoto = { uri: string; existing?: ItemPhoto };

export type UploadProgress = (done: number, total: number) => void;

/** Resizes and uploads local photos, three at a time. Returns the storage paths in input order. */
export async function uploadPhotoFiles(
  uid: string,
  itemId: string,
  uris: string[],
  onProgress?: UploadProgress,
): Promise<string[]> {
  const stamp = Date.now();
  return runPool(
    uris,
    UPLOADS_AT_ONCE,
    async (uri, i) => {
      const resized = await manipulateAsync(uri, [{ resize: { width: 1600 } }], {
        compress: 0.8,
        format: SaveFormat.JPEG,
      });
      const buf = await (await fetch(resized.uri)).arrayBuffer();
      // Storage RLS requires the `${uid}/` prefix.
      const storagePath = `${uid}/${itemId}-${stamp}-${i}.jpg`;
      const { error } = await supabase.storage.from('item-photos').upload(storagePath, buf, { contentType: 'image/jpeg' });
      if (error) throw error;
      return storagePath;
    },
    onProgress,
  );
}

/** True when the editor list matches what is stored, in the same order. */
export function photosUnchanged(original: ItemPhoto[], edited: EditablePhoto[]): boolean {
  const before = [...original].sort((a, b) => a.position - b.position).map((p) => p.id);
  if (edited.some((p) => !p.existing)) return false;
  const after = edited.map((p) => p.existing?.id);
  return before.length === after.length && before.every((id, i) => id === after[i]);
}

/**
 * Saves the edited photo list of an existing item. New files are uploaded,
 * then the rows are written again in the new order and the old rows deleted
 * (item_photos allows insert and delete, not update). Writing first means a
 * failure in the middle leaves extra rows, never an item without photos.
 */
export async function saveItemPhotos(
  uid: string,
  itemId: string,
  original: ItemPhoto[],
  edited: EditablePhoto[],
  onProgress?: UploadProgress,
): Promise<void> {
  if (photosUnchanged(original, edited)) return;

  const fresh = edited.filter((p) => !p.existing);
  const uploaded = await uploadPhotoFiles(uid, itemId, fresh.map((p) => p.uri), onProgress);
  let next = 0;
  const paths = edited.map((p) => p.existing?.storage_path ?? (uploaded[next++] as string));

  if (paths.length > 0) {
    const { error } = await supabase
      .from('item_photos')
      .insert(paths.map((storage_path, position) => ({ item_id: itemId, storage_path, position })));
    if (error) throw error;
  }
  if (original.length > 0) {
    const { error } = await supabase.from('item_photos').delete().in('id', original.map((p) => p.id));
    if (error) throw error;
  }
  const kept = new Set(paths);
  const orphaned = original.map((p) => p.storage_path).filter((path) => !kept.has(path));
  if (orphaned.length > 0) {
    // Best effort: a file left behind costs storage, not correctness.
    await supabase.storage.from('item-photos').remove(orphaned).catch(() => undefined);
  }
}
