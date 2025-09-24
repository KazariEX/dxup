declare global {
    const foo: typeof import("./source")["foo"];
    const { bar }: typeof import("./source");
}

export {};
