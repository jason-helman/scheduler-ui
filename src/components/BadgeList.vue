<script setup>
import BadgeChip from './BadgeChip.vue'

const props = defineProps({
    items: {
        type: Array,
        default: () => []
    },
    size: {
        type: String,
        default: 'xs'
    },
    shape: {
        type: String,
        default: 'pill'
    },
    gapClass: {
        type: String,
        default: 'gap-1'
    },
    containerClass: {
        type: String,
        default: ''
    }
})

const emit = defineEmits(['item-click'])

const getKey = (item, idx) => item?.key ?? `${item?.label ?? 'item'}-${idx}`
const isInteractive = (item) => !!item?.interactive || !!item?.clickable
</script>

<template>
    <div :class="['flex flex-wrap', gapClass, containerClass]">
        <BadgeChip
            v-for="(item, idx) in items"
            :key="getKey(item, idx)"
            :label="item.label"
            :tone="item.tone || 'slate'"
            :size="item.size || size"
            :shape="item.shape || shape"
            :tooltip="item.tooltip || ''"
            :as-button="isInteractive(item)"
            :interactive="isInteractive(item)"
            @click="emit('item-click', item)"
        />
    </div>
</template>
