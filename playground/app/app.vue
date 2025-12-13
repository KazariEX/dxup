<script lang="tsx" setup>
    import type { RouteLocationRaw } from "vue-router";
    import { NuxtLink } from "#components";

    /* -------------- middleware -------------- */

    definePageMeta({
        middleware: ["auth"],
        //           ^————^(definition)
    });

    /* -------------- runtime config -------------- */

    const config = useRuntimeConfig();

    void config.foo.bar;
    //              ^—^(definition)
    void config.foo.baz;
    //              ^—^(definition)
    void config.foo.qux;
    //              ^—^(definition)
    void config.public.hello;
    //                 ^———^(definition)

    /* -------------- auto imports -------------- */

    void foo;
    //   ^—^(definition)

    /* -------------- import glob -------------- */

    import(`~/assets/${name}.webp`);
    //     ^—————————————————————^(definition)
    import.meta.glob("~/assets/*.webp");
    //               ^———————————————^(definition)

    /* -------------- nitro routes -------------- */

    $fetch("/sitemap");
    //     ^————————^(definition)
    $fetch("/fallback.json");
    //     ^——————————————^(definition)
    useFetch("/api/foo");
    //       ^————————^(definition)
    useLazyFetch("/api/foo", { method: "post" });
    //           ^————————^(definition)

    /* -------------- typed pages -------------- */

    <NuxtLink to={{ name: "about" }} />;
    //                    ^—————^(definition)
    computed<RouteLocationRaw>(() => ({ name: "contact" }));
    //                                        ^———————^(definition)
    [{ name: "about" }] satisfies MaybeRefOrGetter<RouteLocationRaw>[];
    //       ^—————^(definition)
</script>

<!-- eslint-disable vue/component-name-in-template-casing -->
<template>
    <FooBar />
    <lazy-foo-bar />
</template>
