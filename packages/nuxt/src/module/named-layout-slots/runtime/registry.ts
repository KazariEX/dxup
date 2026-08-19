import type { InjectionKey, ShallowRef, Slots } from "vue";

export interface LayoutSlotsRegistry {
  slots: ShallowRef<Slots | null>;
  ready: Promise<void>;
  use: (slots: Slots) => void;
  invalidate: () => void;
  getOwner: (name: string) => number | undefined;
}

export const injectionKey = Symbol.for("dxup:layout-slots") as InjectionKey<LayoutSlotsRegistry>;
