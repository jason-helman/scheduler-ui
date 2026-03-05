<script setup>
defineProps({
    section: {
        type: Object,
        required: true
    },
    isCompressed: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['view-students'])
</script>

<template>
    <div :class="['flex items-center justify-between mt-auto pt-1 border-t border-gray-50 dark:border-gray-800 shrink-0', isCompressed ? 'gap-1' : '']">
        <div :class="['flex items-center gap-1 text-gray-400 dark:text-gray-500 font-bold truncate flex-1', isCompressed ? 'text-[7px]' : 'text-[8px]']">
            <i :class="['pi pi-map-marker', isCompressed ? 'text-[6px]' : 'text-[7px]']" />
            {{ section.room_name }}
        </div>
        <button
            type="button"
            @click.stop="emit('view-students')"
            :class="[
                'flex items-center gap-1 font-black text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer',
                isCompressed ? 'text-[7px]' : 'text-[8px]'
            ]"
            v-tooltip.top="'View Students'"
        >
            <i :class="['pi pi-users', isCompressed ? 'text-[7px]' : 'text-[8px]']" />
            {{ section.student_count }}
        </button>
    </div>
</template>
