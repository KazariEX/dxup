<script lang="ts" setup>
    definePageMeta({
        layout: "center",
    });
</script>

<!-- -------------- layout-slots -------------- -->

<!-- eslint-disable vue/valid-v-slot -->
<template>
    <template #side="{ one }">
        <!--           ^—^(definition) -->
        This "{{ one satisfies string }}" comes from the layout slot.
    </template>
    <div>About Page</div>
</template>
