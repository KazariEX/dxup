/* eslint-disable ts/no-unused-expressions */
/* eslint-disable unused-imports/no-unused-vars */

type Plugin<T = (this: void, ctx: string) => void> = T | { handler: T };

(): Plugin => ({ handler: (ctx) => {} });
//                         ^—^(definition)
(): Plugin => ({ handler(this, /* ---- */ ctx) {} });
//                       ^——^(definition) ^—^(definition)

type MakeAsync<T> = T extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R> | void
    : never;

(): MakeAsync<Plugin> => (ctx) => {};
//                        ^—^(definition)
