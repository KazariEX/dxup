<script lang="ts" setup>
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
</script>

<!-- eslint-disable vue/component-name-in-template-casing -->
<template>
    <FooBar />
    <lazy-foo-bar />
</template>
