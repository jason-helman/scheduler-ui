<script setup>
import { BadgeList } from '../../common'

defineProps({
    isCompressed: {
        type: Boolean,
        default: false
    },
    compactBadgeLabels: {
        type: Array,
        default: () => []
    },
    compactBadgeCount: {
        type: Number,
        default: 0
    },
    useCompactBadgeOverlay: {
        type: Boolean,
        default: false
    },
    inlineBadges: {
        type: Array,
        default: () => []
    },
    coTeachers: {
        type: Array,
        default: () => []
    },
    coTeacherBadgeItems: {
        type: Array,
        default: () => []
    },
    mainSectionBadgeItems: {
        type: Array,
        default: () => []
    },
    subsectionBadgeItems: {
        type: Array,
        default: () => []
    },
    effectiveInlineBadgeRows: {
        type: Number,
        default: 1
    },
    enrolledCount: {
        type: Number,
        default: 0
    },
    courseCapacity: {
        type: Number,
        default: null
    },
    seatUtilization: {
        type: Number,
        default: null
    },
    hasCapacityRisk: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['jump-to-teacher', 'jump-to-section'])
</script>

<template>
    <div
        v-if="useCompactBadgeOverlay && compactBadgeCount > 0"
        class="absolute top-4 left-2 right-2 z-30 opacity-0 translate-y-1 group-hover/segment:opacity-100 group-hover/segment:translate-y-0 transition-all duration-150 pointer-events-auto"
    >
        <div class="rounded-md border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 shadow-sm p-1 flex flex-wrap gap-1">
            <BadgeList :items="compactBadgeLabels" />
            <BadgeList :items="coTeacherBadgeItems" @item-click="item => emit('jump-to-teacher', item.payload)" />
            <BadgeList :items="mainSectionBadgeItems" @item-click="item => emit('jump-to-section', item.payload)" />
            <BadgeList :items="subsectionBadgeItems" @item-click="item => emit('jump-to-section', item.payload)" />
        </div>
    </div>

    <div v-if="!useCompactBadgeOverlay" class="space-y-1.5 mt-1 mb-1.5 shrink-0">
        <BadgeList :items="inlineBadges" :collapse-wrapped="!isCompressed" :max-rows="effectiveInlineBadgeRows" />

        <div v-if="!isCompressed" class="flex items-center justify-between text-[7px] font-bold">
            <span class="text-slate-400 dark:text-slate-500 uppercase tracking-wider">Seats</span>
            <span :class="[hasCapacityRisk ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-300']">
                {{ enrolledCount }}<template v-if="courseCapacity">/{{ courseCapacity }}</template>
                <template v-if="seatUtilization != null"> · {{ seatUtilization }}%</template>
            </span>
        </div>

        <div v-if="coTeachers.length > 0" class="flex flex-wrap gap-1 items-center">
            <span :class="['font-black uppercase tracking-wider text-teal-500 dark:text-teal-300 select-none cursor-default', isCompressed ? 'text-[6px]' : 'text-[7px]']">With</span>
            <BadgeList :items="coTeacherBadgeItems" shape="rounded" @item-click="item => emit('jump-to-teacher', item.payload)" />
        </div>

        <div v-if="mainSectionBadgeItems.length > 0" class="flex flex-nowrap gap-1 items-center min-w-0">
            <span :class="['font-black uppercase tracking-wider text-indigo-500 dark:text-indigo-300 select-none cursor-default shrink-0', isCompressed ? 'text-[6px]' : 'text-[7px]']">Main</span>
            <BadgeList
                :items="mainSectionBadgeItems"
                shape="rounded"
                :wrap="false"
                container-class="min-w-0 flex-1"
                @item-click="item => emit('jump-to-section', item.payload)"
            />
        </div>

        <div v-if="subsectionBadgeItems.length > 0" class="flex flex-nowrap gap-1 items-center min-w-0">
            <span :class="['font-black uppercase tracking-wider text-violet-500 dark:text-violet-300 select-none cursor-default shrink-0', isCompressed ? 'text-[6px]' : 'text-[7px]']">Subsections</span>
            <BadgeList
                :items="subsectionBadgeItems"
                shape="rounded"
                :wrap="false"
                container-class="min-w-0 flex-1"
                @item-click="item => emit('jump-to-section', item.payload)"
            />
        </div>
    </div>
</template>
