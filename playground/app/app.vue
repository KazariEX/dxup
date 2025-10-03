<script lang="ts" setup>
    // runtime config
    const config = useRuntimeConfig();
    void config.foo.bar;
    void config.foo.baz;
    void config.foo.qux;
    void config.public.hello;

    // auto imports
    void foo;

    // nitro routes
    useFetch("/api/foo");
</script>

<!-- eslint-disable vue/component-name-in-template-casing -->
<template>
    <FooBar />
    <lazy-foo-bar />
</template>
