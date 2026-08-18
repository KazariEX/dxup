export const pageGates = ((globalThis as any).__pageGates ??= new Map<string, (() => void)[]>()) as Map<string, (() => void)[]>;

export function holdPage(key: string) {
  return new Promise<void>((resolve) => {
    const resolvers = pageGates.get(key) ?? [];
    resolvers.push(resolve);
    pageGates.set(key, resolvers);
  });
}
