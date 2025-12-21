/* eslint-disable unused-imports/no-unused-vars */

/* -------------- vanilla signature -------------- */

type Plugin<T = (ctx: string) => void> = T | { handler: T };

void ({ handler: (ctx) => {} } as Plugin);
//                ^—^(definition)
void ({ handler(ctx) {} } as Plugin);
//              ^—^(definition)
