<script setup>
const props = defineProps({
    section: {
        type: Object,
        required: true
    },
    isCompressed: {
        type: Boolean,
        default: false
    },
    useCompactBadgeOverlay: {
        type: Boolean,
        default: false
    },
    compactBadgeCount: {
        type: Number,
        default: 0
    }
})

const emit = defineEmits(['toggle-lock'])
</script>

<template>
    <div class="flex items-start justify-between gap-1 shrink-0">
        <div class="flex items-start gap-1 min-w-0 flex-1">
            <span
                v-if="useCompactBadgeOverlay && compactBadgeCount > 0"
                class="inline-flex items-center justify-center min-w-[12px] h-[12px] px-1 rounded-full text-[7px] font-black bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 shrink-0 cursor-help"
            >
                {{ compactBadgeCount }}
            </span>
            <div
                :class="[
                    'font-black uppercase tracking-tighter line-clamp-1 leading-tight mb-0.5 min-w-0 flex-1',
                    isCompressed ? 'text-[8px]' : 'text-[9px]',
                    section.isLab ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
                ]"
                v-tooltip.top="section.course_name"
            >
                {{ section.course_name }}
            </div>
        </div>
        <i
            :class="[
                'pi cursor-pointer transition-colors',
                isCompressed ? 'text-[8px]' : 'text-[10px]',
                section.locked ? 'pi-lock text-amber-500' : 'pi-lock-open text-gray-300 hover:text-blue-400'
            ]"
            @click.stop="emit('toggle-lock', section.sectionId)"
            v-tooltip.top="section.locked ? 'Unlock Placement' : 'Lock Placement'"
        />
    </div>
</template>
