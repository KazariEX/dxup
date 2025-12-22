/* eslint-disable unused-imports/no-unused-vars */

type Plugin<T = (this: void, ctx: string) => void> = T | { handler: T };

void ({ handler: (ctx) => {} } as Plugin);
//                ^—^(definition)
void ({ handler(this, /* ---- */ ctx) {} } as Plugin);
//              ^——^(definition) ^—^(definition)
