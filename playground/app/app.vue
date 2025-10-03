<script lang="ts" setup>
    const config = useRuntimeConfig();
    void config.foo.bar;
    void config.foo.baz;
    void config.foo.qux;
    void config.public.hello;

    useFetch("/api/foo");
</script>

<!-- eslint-disable vue/component-name-in-template-casing -->
<template>
    <FooBar />
    <lazy-foo-bar />
</template>
