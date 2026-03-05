<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { store } from '../../store'
import Dialog from 'primevue/dialog'
import CopyButton from '../common/CopyButton.vue'
import BadgeList from '../common/BadgeList.vue'
import { useSectionBadges } from '../../composables/useSectionBadges'
import { getCourseByIdMap, getHighlightClass, getStudentByIdMap } from '../../utils/scheduleHelpers'

const props = defineProps({
    section: Object,
    hoveredSection: Object,
    currentTeacherId: [Number, String],
    jumpPulseSectionId: [Number, String],
    jumpPulseVisible: Boolean
})

const emit = defineEmits(['hover', 'leave', 'toggle-lock', 'jump-to-teacher', 'jump-to-section'])
const showStudentsDialog = ref(false)
const cardEl = ref(null)
const bodyEl = ref(null)
const badgeRowsToShow = ref(1)
const measuredBadgeRows = ref(null)
let badgeFitToken = 0
let cardResizeObserver = null

const scheduledStudents = computed(() => {
    const sectionStudentIds = props.section.scheduledStudentIds || props.section.scheduled_student_ids || []
    if (!store.localDataset || !Array.isArray(store.localDataset.students) || sectionStudentIds.length === 0) return []

    const studentById = getStudentByIdMap(store.localDataset)

    return sectionStudentIds
        .map(id => {
            const student = studentById.get(String(id))
            if (!student) return null

            const displayName =
                student.name ||
                student.fullName ||
                student.student_name ||
                [student.first_name, student.last_name].filter(Boolean).join(' ') ||
                String(id)

            return { ...student, _displayName: displayName }
        })
        .filter(Boolean)
})

const enrolledCount = computed(() => Number(props.section.student_count ?? scheduledStudents.value.length ?? 0))

const courseCapacity = computed(() => {
    if (!store.localDataset) return null
    const course = getCourseByIdMap(store.localDataset).get(props.section.courseId)
    return Number(course?.capacity) || null
})

const seatUtilization = computed(() => {
    if (!courseCapacity.value) return null
    return Math.round((enrolledCount.value / courseCapacity.value) * 100)
})

const hasCapacityRisk = computed(() => {
    if (!courseCapacity.value) return false
    return enrolledCount.value > courseCapacity.value
})
const {
    compactBadgeLabels,
    inlineBadges,
    compactBadgeCount,
    useCompactBadgeOverlay,
    coTeachers,
    coTeacherBadgeItems,
    mainSectionBadgeItems
} = useSectionBadges({
    section: computed(() => props.section),
    currentTeacherId: computed(() => props.currentTeacherId),
    localDataset: computed(() => store.localDataset),
    isCompressed: computed(() => store.isCompressed)
})
const effectiveInlineBadgeRows = computed(() =>
    measuredBadgeRows.value != null ? measuredBadgeRows.value : badgeRowsToShow.value
)
const isJumpPulseActive = computed(() =>
    !!props.jumpPulseVisible &&
    props.jumpPulseSectionId != null &&
    String(props.section.sectionId) === String(props.jumpPulseSectionId)
)

const recomputeBadgeRows = async () => {
    const token = ++badgeFitToken

    if (store.isCompressed || useCompactBadgeOverlay.value || inlineBadges.value.length === 0) {
        measuredBadgeRows.value = null
        badgeRowsToShow.value = 1
        return
    }

    if (!bodyEl.value) return

    const maxRows = Math.max(1, inlineBadges.value.length)
    let fitRows = 1

    for (let rows = maxRows; rows >= 1; rows -= 1) {
        measuredBadgeRows.value = rows
        await nextTick()
        if (token !== badgeFitToken) return
        if (!bodyEl.value) return

        const overflows = (bodyEl.value.scrollHeight - bodyEl.value.clientHeight) > 1
        if (!overflows) {
            fitRows = rows
            break
        }
    }

    if (token !== badgeFitToken) return
    badgeRowsToShow.value = fitRows
    measuredBadgeRows.value = null
}

onMounted(() => {
    recomputeBadgeRows()
    if (typeof ResizeObserver === 'undefined' || !cardEl.value) return
    cardResizeObserver = new ResizeObserver(() => recomputeBadgeRows())
    cardResizeObserver.observe(cardEl.value)
})

onBeforeUnmount(() => {
    if (!cardResizeObserver) return
    cardResizeObserver.disconnect()
    cardResizeObserver = null
})

watch(
    () => [
        store.isCompressed,
        useCompactBadgeOverlay.value,
        inlineBadges.value.length,
        coTeacherBadgeItems.value.length,
        mainSectionBadgeItems.value.length
    ],
    () => {
        recomputeBadgeRows()
    }
)

</script>

<template>
    <div
         ref="cardEl"
         :data-section-id="section.sectionId"
         @mouseenter="emit('hover', section)"
         @mouseleave="emit('leave')"
         :style="{ 
            gridRow: `${section.startQ} / ${section.endQ + 1}`
         }"
         :class="[
            'border bg-white dark:bg-gray-900 shadow-sm transition-[box-shadow,background-color,border-color,outline-color] duration-300 hover:shadow-md flex flex-col justify-between overflow-hidden z-10 w-full h-full min-h-0 group/segment relative hover:z-[200] cursor-default ring-inset hover:ring-2 hover:ring-blue-500/40',
            isJumpPulseActive ? 'jump-pulse-hover' : '',
            store.isCompressed ? 'p-1.5 rounded-lg' : 'p-2.5 rounded-xl',
            section.locked ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10' : 'border-gray-100 dark:border-gray-700',
            section.isLab ? 'is-lab' : '',
            getHighlightClass(section, hoveredSection)
         ]">
        
        <!-- Debug ID Overlay -->
        <div v-if="store.showIds" class="absolute inset-0 bg-blue-600/95 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover/segment:opacity-100 transition-opacity z-50 p-2">
            <div class="flex items-center justify-between w-full">
                <span class="text-[8px] font-black text-blue-100 uppercase">Course</span>
                <CopyButton v-if="section.courseId != null" :value="section.courseId" label="Course ID" class="!bg-white/20 !text-white !border-white/20 hover:!bg-white/30" />
            </div>
            <div class="flex items-center justify-between w-full">
                <span class="text-[8px] font-black text-blue-100 uppercase">Section</span>
                <CopyButton v-if="section.sectionId != null" :value="section.sectionId" label="Section ID" class="!bg-white/20 !text-white !border-white/20 hover:!bg-white/30" />
            </div>
            <div v-if="section.classroomId != null" class="flex items-center justify-between w-full">
                <span class="text-[8px] font-black text-blue-100 uppercase">Room</span>
                <CopyButton :value="section.classroomId" label="Room ID" class="!bg-white/20 !text-white !border-white/20 hover:!bg-white/30" />
            </div>
        </div>

        <div
            v-if="useCompactBadgeOverlay && compactBadgeCount > 0"
            class="absolute top-4 left-2 right-2 z-30 opacity-0 translate-y-1 group-hover/segment:opacity-100 group-hover/segment:translate-y-0 transition-all duration-150 pointer-events-auto"
        >
            <div class="rounded-md border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 shadow-sm p-1 flex flex-wrap gap-1">
                <BadgeList :items="compactBadgeLabels" />
                <BadgeList
                    :items="coTeacherBadgeItems"
                    @item-click="item => emit('jump-to-teacher', item.payload)"
                />
                <BadgeList
                    :items="mainSectionBadgeItems"
                    @item-click="item => emit('jump-to-section', item.payload)"
                />
            </div>
        </div>

        <div ref="bodyEl" class="flex-1 min-h-0 text-center flex flex-col overflow-hidden">
            <div class="flex items-start justify-between gap-1 shrink-0">
                <div class="flex items-start gap-1 min-w-0 flex-1">
                    <span
                        v-if="useCompactBadgeOverlay && compactBadgeCount > 0"
                        class="inline-flex items-center justify-center min-w-[12px] h-[12px] px-1 rounded-full text-[7px] font-black bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 shrink-0 cursor-help"
                    >
                        {{ compactBadgeCount }}
                    </span>
                    <div :class="['font-black uppercase tracking-tighter line-clamp-1 leading-tight mb-0.5 min-w-0 flex-1', store.isCompressed ? 'text-[8px]' : 'text-[9px]', section.isLab ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400']"
                         v-tooltip.top="section.course_name">
                        {{ section.course_name }}
                    </div>
                </div>
                <i :class="['pi cursor-pointer transition-colors', store.isCompressed ? 'text-[8px]' : 'text-[10px]', section.locked ? 'pi-lock text-amber-500' : 'pi-lock-open text-gray-300 hover:text-blue-400']" 
                   @click.stop="emit('toggle-lock', section.sectionId)"
                   v-tooltip.top="section.locked ? 'Unlock Placement' : 'Lock Placement'"></i>
            </div>
            
            <div v-if="!useCompactBadgeOverlay" class="space-y-1.5 mt-1 mb-1.5 shrink-0">
                    <BadgeList
                        :items="inlineBadges"
                        :collapse-wrapped="!store.isCompressed"
                        :max-rows="effectiveInlineBadgeRows"
                    />

                    <div v-if="!store.isCompressed" class="flex items-center justify-between text-[7px] font-bold">
                        <span class="text-slate-400 dark:text-slate-500 uppercase tracking-wider">Seats</span>
                        <span
                            :class="[
                                hasCapacityRisk ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-300'
                            ]"
                        >
                            {{ enrolledCount }}<template v-if="courseCapacity">/{{ courseCapacity }}</template>
                            <template v-if="seatUtilization != null"> · {{ seatUtilization }}%</template>
                        </span>
                    </div>

                    <div v-if="coTeachers.length > 0" class="flex flex-wrap gap-1 items-center">
                    <span :class="['font-black uppercase tracking-wider text-teal-500 dark:text-teal-300 select-none cursor-default', store.isCompressed ? 'text-[6px]' : 'text-[7px]']">With</span>
                    <BadgeList
                        :items="coTeacherBadgeItems"
                        shape="rounded"
                        @item-click="item => emit('jump-to-teacher', item.payload)"
                    />
                    </div>
                    <div v-if="mainSectionBadgeItems.length > 0" class="flex flex-wrap gap-1 items-center">
                    <span :class="['font-black uppercase tracking-wider text-indigo-500 dark:text-indigo-300 select-none cursor-default', store.isCompressed ? 'text-[6px]' : 'text-[7px]']">Main</span>
                    <BadgeList
                        :items="mainSectionBadgeItems"
                        shape="rounded"
                        @item-click="item => emit('jump-to-section', item.payload)"
                    />
                    </div>
            </div>
        </div>
        
        <div :class="['flex items-center justify-between mt-auto pt-1 border-t border-gray-50 dark:border-gray-800 shrink-0', store.isCompressed ? 'gap-1' : '']">
            <div :class="['flex items-center gap-1 text-gray-400 dark:text-gray-500 font-bold truncate flex-1', store.isCompressed ? 'text-[7px]' : 'text-[8px]']">
                <i :class="['pi pi-map-marker', store.isCompressed ? 'text-[6px]' : 'text-[7px]']"></i>
                {{ section.room_name }}
            </div>
            <button
                type="button"
                @click.stop="showStudentsDialog = true"
                :class="[
                    'flex items-center gap-1 font-black text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer',
                    store.isCompressed ? 'text-[7px]' : 'text-[8px]'
                ]"
                v-tooltip.top="'View Students'"
            >
                <i :class="['pi pi-users', store.isCompressed ? 'text-[7px]' : 'text-[8px]']"></i>
                {{ section.student_count }}
            </button>
        </div>
    </div>

    <Dialog
        v-if="showStudentsDialog"
        v-model:visible="showStudentsDialog"
        modal
        :header="`${section.course_name} · Students`"
        :style="{ width: '26rem' }"
        :dismissableMask="true"
    >
        <div class="max-h-[55vh] overflow-y-auto pr-1 space-y-1.5">
            <div
                v-for="st in scheduledStudents"
                :key="st.studentId || st.student_id || st.id || st._displayName"
                class="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 bg-gray-50 dark:bg-gray-800/60"
            >
                <span class="truncate text-xs font-semibold text-gray-700 dark:text-gray-300">{{ st._displayName }}</span>
                <span v-if="st.grade" class="text-[11px] text-blue-500 font-bold shrink-0">Grade {{ st.grade }}</span>
            </div>
            <div v-if="scheduledStudents.length === 0" class="py-8 text-center text-xs text-gray-400 dark:text-gray-500 font-semibold">
                No students scheduled
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
.is-lab {
    border-color: #10b981 !important;
    background-color: #ecfdf5 !important;
}

.my-app-dark .is-lab {
    border-color: #059669 !important;
    background-color: #064e3b !important;
}

.highlight-primary {
    transition: none !important;
    outline: 3px solid #3b82f6 !important;
    border-color: #3b82f6 !important;
    background-color: #eff6ff !important;
    z-index: 20 !important;
    box-shadow: 0 4px 12px -4px rgba(59, 130, 246, 0.35) !important;
}

.my-app-dark .highlight-primary {
    background-color: #1e3a8a !important;
}

.highlight-lab {
    transition: none !important;
    outline: 3px solid #10b981 !important;
    border-color: #10b981 !important;
    background-color: #ecfdf5 !important;
    z-index: 20 !important;
    box-shadow: 0 4px 12px -4px rgba(16, 185, 129, 0.35) !important;
}

.my-app-dark .highlight-lab {
    background-color: #064e3b !important;
    box-shadow: 0 4px 14px -4px rgba(16, 185, 129, 0.28) !important;
}

.highlight-subsection {
    transition: none !important;
    outline: 3px solid #6366f1 !important;
    border-color: #6366f1 !important;
    background-color: #eef2ff !important;
    z-index: 20 !important;
    box-shadow: 0 4px 12px -4px rgba(99, 102, 241, 0.35) !important;
}

.my-app-dark .highlight-subsection {
    background-color: #312e81 !important;
}

.jump-pulse-hover {
    outline: 3px solid #3b82f6 !important;
    border-color: #3b82f6 !important;
    background-color: #eff6ff !important;
    box-shadow: 0 4px 12px -4px rgba(59, 130, 246, 0.35) !important;
    transition: background-color 380ms ease, border-color 380ms ease, box-shadow 380ms ease, outline-color 380ms ease !important;
}

.my-app-dark .jump-pulse-hover {
    background-color: #1e3a8a !important;
}

/* Scrollbar refinement */
.scrollbar-thin::-webkit-scrollbar {
    width: 3px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
}
.my-app-dark .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #1e293b;
}
</style>
