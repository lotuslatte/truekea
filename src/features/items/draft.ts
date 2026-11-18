import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { ItemCondition, ItemKind, KnowledgeFormat, KnowledgeModality } from '@/types/database';

const KEY = 'truekea:publish_draft:v1';

/** Everything typed in the publish form, as plain JSON. Dates are ISO strings. */
export type PublishDraft = {
  step: number;
  kind: ItemKind;
  format: KnowledgeFormat;
  modality: KnowledgeModality;
  photos: string[];
  title: string;
  description: string;
  categoryId: number | null;
  district: string | null;
  condition: ItemCondition | null;
  eventAt: string | null;
  capacity: string;
  isDonation: boolean;
  isPerishable: boolean;
  pickupAt: string | null;
  lookingFor: string;
  savedAt: string;
};

/** A draft is worth keeping once the person typed something or added a photo. */
export function draftHasContent(d: Pick<PublishDraft, 'title' | 'description' | 'photos' | 'lookingFor'>): boolean {
  return d.title.trim().length > 0 || d.description.trim().length > 0 || d.lookingFor.trim().length > 0 || d.photos.length > 0;
}

/** Parses a stored draft; anything malformed or without content reads as "no draft". */
export function parseDraft(raw: string | null): PublishDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<PublishDraft>;
    if (typeof d !== 'object' || d === null || typeof d.title !== 'string' || typeof d.description !== 'string') return null;
    const draft: PublishDraft = {
      step: typeof d.step === 'number' && d.step >= 1 && d.step <= 3 ? d.step : 1,
      kind: d.kind === 'knowledge' ? 'knowledge' : 'object',
      format: d.format === 'circle' ? 'circle' : 'one_on_one',
      modality: d.modality === 'virtual' ? 'virtual' : 'in_person',
      photos: Array.isArray(d.photos) ? d.photos.filter((p): p is string => typeof p === 'string') : [],
      title: d.title,
      description: d.description,
      categoryId: typeof d.categoryId === 'number' ? d.categoryId : null,
      district: typeof d.district === 'string' ? d.district : null,
      condition: d.condition ?? null,
      eventAt: typeof d.eventAt === 'string' ? d.eventAt : null,
      capacity: typeof d.capacity === 'string' ? d.capacity : '',
      isDonation: d.isDonation === true,
      isPerishable: d.isPerishable === true,
      pickupAt: typeof d.pickupAt === 'string' ? d.pickupAt : null,
      lookingFor: typeof d.lookingFor === 'string' ? d.lookingFor : '',
      savedAt: typeof d.savedAt === 'string' ? d.savedAt : new Date(0).toISOString(),
    };
    return draftHasContent(draft) ? draft : null;
  } catch {
    return null;
  }
}

export async function loadDraft(): Promise<PublishDraft | null> {
  try {
    const draft = parseDraft(await AsyncStorage.getItem(KEY));
    // On web the picked photos are blob: URLs that die with the page.
    if (draft && Platform.OS === 'web') draft.photos = [];
    return draft;
  } catch {
    return null;
  }
}

export async function saveDraft(draft: PublishDraft): Promise<void> {
  try {
    if (draftHasContent(draft)) await AsyncStorage.setItem(KEY, JSON.stringify(draft));
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // A draft that cannot be stored is not worth interrupting the form.
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
