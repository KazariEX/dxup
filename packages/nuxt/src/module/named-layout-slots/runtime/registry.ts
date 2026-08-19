import type { InjectionKey, ShallowRef, Slots } from "vue";

export interface LayoutSlotsRegistry {
  slots: ShallowRef<Slots | null>;
  ready: Promise<void>;
  use: (slots: Slots) => void;
  invalidate: () => void;
}

export const injectionKey = Symbol.for("dxup:layout-slots") as InjectionKey<LayoutSlotsRegistry>;
