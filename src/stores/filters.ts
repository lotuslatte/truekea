import { create } from 'zustand';

import type { ItemCondition, ItemKind, KnowledgeFormat, KnowledgeModality } from '@/types/database';

type FiltersState = {
  categoryId: number | null;
  radiusKm: number;
  donationsOnly: boolean;
  kind: ItemKind | null;
  search: string;
  format: KnowledgeFormat | null;
  modality: KnowledgeModality | null;
  condition: ItemCondition | null;
  setCategoryId: (categoryId: number | null) => void;
  setRadiusKm: (radiusKm: number) => void;
  setDonationsOnly: (donationsOnly: boolean) => void;
  setKind: (kind: ItemKind | null) => void;
  setSearch: (search: string) => void;
  setFormat: (format: KnowledgeFormat | null) => void;
  setModality: (modality: KnowledgeModality | null) => void;
  setCondition: (condition: ItemCondition | null) => void;
  reset: () => void;
};

const initialState = {
  categoryId: null,
  radiusKm: 10,
  donationsOnly: false,
  kind: null,
  search: '',
  format: null,
  modality: null,
  condition: null,
} as const;

export const useFilters = create<FiltersState>((set) => ({
  ...initialState,
  setCategoryId: (categoryId) => set({ categoryId }),
  setRadiusKm: (radiusKm) => set({ radiusKm }),
  setDonationsOnly: (donationsOnly) => set({ donationsOnly }),
  // Al cambiar de tipo se limpian los filtros contextuales que ya no aplican:
  // objetos no tienen formato/modalidad, saberes no tienen estado, y "todo"
  // (kind null) no muestra ninguno de los tres.
  setKind: (kind) =>
    set(
      kind === 'object'
        ? { kind, format: null, modality: null }
        : kind === 'knowledge'
          ? { kind, condition: null }
          : { kind, format: null, modality: null, condition: null },
    ),
  setSearch: (search) => set({ search }),
  setFormat: (format) => set({ format }),
  setModality: (modality) => set({ modality }),
  setCondition: (condition) => set({ condition }),
  reset: () => set({ ...initialState }),
}));
