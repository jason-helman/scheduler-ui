<script setup>
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'

import { useSectionBadges } from '../../composables/useSectionBadges'
import { store } from '../../store'
import { CopyButton } from '../common'
import { SectionCardHeader, SectionCardBadges, SectionCardFooter, SectionStudentsDialog } from './section-card'
import { getCourseByIdMap, getHighlightClass, getStudentByIdMap } from '../../utils'

const props = defineProps({
    section: Object,
    hoveredSection: Object,
    currentTeacherId: [Number, String],
    jumpPulseSectionId: [Number, String],
    jumpPulseVisible: Boolean
})

const emit = defineEmits([
    'hover',
    'leave',
    'toggle-lock',
    'jump-to-teacher',
    'jump-to-section',
    'open-diagnostics'
])
const showStudentsDialog = ref(false)
const bodyEl = ref(null)
const badgeRowsToShow = ref(1)
const measuredBadgeRows = ref(null)
let badgeFitToken = 0
const isMasterGridScrolling = inject('master-grid-scroll-state', null)
const masterBadgeFitEpoch = inject('master-grid-badge-fit-epoch', null)

const scheduledStudentIds = computed(() => props.section.scheduledStudentIds || props.section.scheduled_student_ids || [])

const scheduledStudents = computed(() => {
    if (!showStudentsDialog.value || scheduledStudentIds.value.length === 0) return []
    if (!store.localDataset || !Array.isArray(store.localDataset.students)) return []

    const studentById = getStudentByIdMap(store.localDataset)

    return scheduledStudentIds.value
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

const enrolledCount = computed(() => Number(props.section.student_count ?? scheduledStudentIds.value.length ?? 0))

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
const diagnosticsCount = computed(() => {
    if (!store.diagnostics?.sectionPlacement) return 0
    return store.diagnostics.sectionPlacement.filter(
        d => d.entityType === 'section' && String(d.entityId) === String(props.section.sectionId)
    ).length
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
    if (isMasterGridScrolling?.value) return

    const token = ++badgeFitToken

    if (store.isCompressed || useCompactBadgeOverlay.value || inlineBadges.value.length === 0) {
        measuredBadgeRows.value = null
        badgeRowsToShow.value = 1
        return
    }

    if (!bodyEl.value) return

    // Cap fit passes to avoid expensive multi-tick measurement on virtualized mounts.
    const maxRows = Math.min(3, Math.max(1, inlineBadges.value.length))
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

if (isMasterGridScrolling) {
    watch(
        () => isMasterGridScrolling.value,
        isScrolling => {
            if (isScrolling) return
            recomputeBadgeRows()
        }
    )
}

if (masterBadgeFitEpoch) {
    watch(
        () => masterBadgeFitEpoch.value,
        () => {
            recomputeBadgeRows()
        }
    )
}

</script>

<template>
    <div
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
            section.parentSectionId ? 'is-subsection' : '',
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

        <div ref="bodyEl" class="flex-1 min-h-0 text-center flex flex-col overflow-hidden">
            <SectionCardHeader
                :section="section"
                :is-compressed="store.isCompressed"
                :use-compact-badge-overlay="useCompactBadgeOverlay"
                :compact-badge-count="compactBadgeCount"
                @toggle-lock="id => emit('toggle-lock', id)"
            />

            <SectionCardBadges
                :is-compressed="store.isCompressed"
                :compact-badge-labels="compactBadgeLabels"
                :compact-badge-count="compactBadgeCount"
                :use-compact-badge-overlay="useCompactBadgeOverlay"
                :inline-badges="inlineBadges"
                :co-teachers="coTeachers"
                :co-teacher-badge-items="coTeacherBadgeItems"
                :main-section-badge-items="mainSectionBadgeItems"
                :effective-inline-badge-rows="effectiveInlineBadgeRows"
                :enrolled-count="enrolledCount"
                :course-capacity="courseCapacity"
                :seat-utilization="seatUtilization"
                :has-capacity-risk="hasCapacityRisk"
                @jump-to-teacher="payload => emit('jump-to-teacher', payload)"
                @jump-to-section="payload => emit('jump-to-section', payload)"
            />
        </div>

        <SectionCardFooter
            :section="section"
            :is-compressed="store.isCompressed"
            :show-diagnostics-action="!!store.diagnostics"
            :diagnostics-count="diagnosticsCount"
            @view-students="showStudentsDialog = true"
            @open-diagnostics="emit('open-diagnostics', section.sectionId)"
        />
    </div>

    <SectionStudentsDialog
        v-model:visible="showStudentsDialog"
        :section="section"
        :scheduled-students="scheduledStudents"
    />
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

.is-subsection {
    border-color: #6366f1 !important;
    background-color: #eef2ff !important;
}

.my-app-dark .is-subsection {
    border-color: #4f46e5 !important;
    background-color: #312e81 !important;
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
