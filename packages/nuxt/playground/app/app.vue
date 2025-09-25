<script lang="ts" setup>
    const config = useRuntimeConfig();
    void config.foo.bar;

    useFetch("/api/foo");
</script>
