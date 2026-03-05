<script setup>
import Badge from 'primevue/badge'
import BadgeChip from '../BadgeChip.vue'
import CopyButton from '../CopyButton.vue'

defineProps({
    teacher: {
        type: Object,
        required: true
    },
    showIds: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['open-unplaced'])
</script>

<template>
    <div :id="`teacher-row-${teacher.teacherId}`" class="flex flex-col gap-1 py-1 px-1.5 rounded transition-colors duration-150">
        <div class="flex items-start justify-between gap-1">
            <span class="truncate leading-tight text-[11px] text-gray-900 dark:text-gray-100" v-tooltip.top="teacher.teacherName">
                {{ teacher.teacherName }}
            </span>
            <CopyButton v-if="showIds && teacher.teacherId != null" :value="teacher.teacherId" label="Teacher ID" />
        </div>

        <div class="flex flex-wrap items-center gap-1 text-[8px] font-black uppercase tracking-wider">
            <BadgeChip :label="`${teacher.summary?.sections ?? 0} Sec`" tone="slate" size="sm" shape="rounded" />
            <BadgeChip :label="`${teacher.summary?.students ?? 0} Stu`" tone="blue" size="sm" shape="rounded" />
            <BadgeChip
                :label="`${teacher.summary?.placementPct ?? 100}% Placed`"
                :tone="(teacher.summary?.unplaced ?? 0) > 0 ? 'amber' : 'emerald'"
                size="sm"
                shape="rounded"
            />
        </div>

        <div class="text-[8px] font-bold text-gray-500 dark:text-gray-400 leading-tight">
            <span class="uppercase tracking-wider">Classrooms:</span>
            <BadgeChip
                class="ml-1"
                :label="`${teacher.summary?.classroomCount ?? teacher.summary?.roomDiversity ?? 0}`"
                tone="slate"
                size="sm"
                shape="rounded"
                :tooltip="teacher.summary?.classroomList || 'No classrooms'"
            />
        </div>

        <div class="text-[8px] font-bold text-gray-500 dark:text-gray-400 leading-tight">
            <span class="uppercase tracking-wider">Departments:</span>
            <BadgeChip
                class="ml-1"
                :label="`${teacher.summary?.departmentCount ?? 0}`"
                tone="slate"
                size="sm"
                shape="rounded"
                :tooltip="teacher.summary?.departmentList || 'No departments'"
            />
        </div>

        <div class="text-[8px] font-bold text-gray-500 dark:text-gray-400 leading-tight">
            <span class="uppercase tracking-wider">Subjects:</span>
            <BadgeChip
                class="ml-1"
                :label="`${teacher.summary?.subjectCount ?? 0}`"
                tone="slate"
                size="sm"
                shape="rounded"
                :tooltip="teacher.summary?.subjectList || 'No subjects'"
            />
        </div>

        <div
            v-if="(teacher.unplacedSections || []).length > 0"
            class="flex items-center gap-1.5 animate-pulse cursor-pointer hover:opacity-80 transition-opacity"
            @click="emit('open-unplaced', teacher)"
        >
            <Badge :value="teacher.unplacedSections.length" severity="danger" class="!text-[8px] !min-w-[1.2rem] !h-[1.2rem]" />
            <span class="text-[9px] font-black text-red-500 uppercase tracking-tighter hover:underline">Unplaced</span>
        </div>
    </div>
</template>
