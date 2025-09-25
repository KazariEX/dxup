<script lang="ts" setup>
    const config = useRuntimeConfig();
    void config.foo.bar;
    void config.public.baz;

    useFetch("/api/foo");
</script>
