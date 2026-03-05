<script setup>
import { computed, ref } from 'vue'
import { store } from '../store'
import Dialog from 'primevue/dialog'
import CopyButton from './CopyButton.vue'
import { getCourseByIdMap, getHighlightClass, getStudentByIdMap } from '../utils/scheduleHelpers'

const props = defineProps({
    section: Object,
    hoveredSection: Object,
    currentTeacherId: [Number, String]
})

const emit = defineEmits(['hover', 'leave', 'toggle-lock', 'jump-to-teacher'])
const showStudentsDialog = ref(false)

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

const isLunchSection = computed(() => {
    if (props.section.isLunchCourse != null) return !!props.section.isLunchCourse
    if (!store.localDataset) return false
    const course = getCourseByIdMap(store.localDataset).get(props.section.courseId)
    return !!course?.isLunchCourse
})

const isCoTaughtSection = computed(() => {
    if (props.section.isCoTaught != null) return !!props.section.isCoTaught
    if (props.section.is_co_taught != null) return !!props.section.is_co_taught
    if (props.section.coTeacherId || props.section.co_teacher_id) return true
    if (Array.isArray(props.section.coTeacherIds) && props.section.coTeacherIds.length > 0) return true
    if (Array.isArray(props.section.co_teacher_ids) && props.section.co_teacher_ids.length > 0) return true
    if (Array.isArray(props.section.teacherIds) && props.section.teacherIds.length > 1) return true
    if (Array.isArray(props.section.teacher_ids) && props.section.teacher_ids.length > 1) return true
    return false
})

const seatUtilization = computed(() => {
    if (!courseCapacity.value) return null
    return Math.round((enrolledCount.value / courseCapacity.value) * 100)
})

const hasCapacityRisk = computed(() => {
    if (!courseCapacity.value) return false
    return enrolledCount.value > courseCapacity.value
})

const quickFlags = computed(() => {
    const flags = []
    const hasMultiPeriodSpan = Array.isArray(props.section.coursePeriodIds) && props.section.coursePeriodIds.length > 1
    if (isCoTaughtSection.value) flags.push({ key: 'co', label: 'Co-Taught', tone: 'teal' })
    if (isLunchSection.value) flags.push({ key: 'lunch', label: 'Lunch', tone: 'orange' })
    if (props.section.isLab) flags.push({ key: 'lab', label: 'Lab', tone: 'emerald' })
    if (props.section.isInclusion) flags.push({ key: 'inclusion', label: 'Inclusion', tone: 'violet' })
    if (props.section.spanId || hasMultiPeriodSpan) flags.push({ key: 'span', label: 'Span', tone: 'sky' })
    if (props.section.parentSectionId) flags.push({ key: 'sub', label: 'Subsection', tone: 'indigo' })
    if (props.section.locked) flags.push({ key: 'locked', label: 'Locked', tone: 'amber' })
    return flags
})

const compactBadgeLabels = computed(() => {
    const badges = []
    if (props.section.quarters) badges.push({ key: 'q', label: `Q ${props.section.quarters}`, tone: 'slate' })
    if (props.section.days) badges.push({ key: 'd', label: `D ${props.section.days}`, tone: 'emerald' })
    quickFlags.value.forEach(flag => badges.push({ key: flag.key, label: flag.label, tone: flag.tone }))
    return badges
})

const compactBadgeCount = computed(() => compactBadgeLabels.value.length)
const sectionQuarterCount = computed(() => {
    const explicitCount = Number(props.section.quarterCount)
    if (Number.isFinite(explicitCount) && explicitCount > 0) return explicitCount
    if (!props.section.quarters) return 0
    return String(props.section.quarters)
        .split(',')
        .map(q => q.trim())
        .filter(Boolean).length
})
const useCompactBadgeOverlay = computed(() => store.isCompressed && sectionQuarterCount.value <= 1)

const teacherNameById = computed(() => {
    const map = new Map()
    const teachers = store.localDataset?.teachers
    if (!Array.isArray(teachers)) return map
    teachers.forEach(t => {
        if (t?.teacherId != null) map.set(String(t.teacherId), t.name || `Teacher ${t.teacherId}`)
    })
    return map
})

const coTeachers = computed(() => {
    const teacherIds = Array.from(
        new Set(
            [
                ...(Array.isArray(props.section.teacherIds) ? props.section.teacherIds : []),
                ...(Array.isArray(props.section.teacher_ids) ? props.section.teacher_ids : []),
                props.section.teacherId,
                props.section.teacher_id
            ].filter(id => id != null).map(id => String(id))
        )
    )

    if (teacherIds.length <= 1) return []

    const currentTeacherId = props.currentTeacherId != null ? String(props.currentTeacherId) : null
    return teacherIds
        .filter(id => id !== currentTeacherId)
        .map(id => ({
            teacherId: id,
            name: teacherNameById.value.get(id) || `Teacher ${id}`
        }))
})

const previewStudents = computed(() => scheduledStudents.value.slice(0, 2))
const hiddenPreviewCount = computed(() => Math.max(0, scheduledStudents.value.length - previewStudents.value.length))
</script>

<template>
    <div
         @mouseenter="emit('hover', section)"
         @mouseleave="emit('leave')"
         :style="{ 
            gridRow: `${section.startQ} / ${section.endQ + 1}`
         }"
         :class="[
            'border bg-white dark:bg-gray-900 shadow-sm transition-shadow duration-75 hover:shadow-md flex flex-col justify-between overflow-hidden z-10 w-full h-full min-h-0 group/segment relative hover:z-[200] cursor-default ring-inset hover:ring-2 hover:ring-blue-500/40',
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
                <span
                    v-for="badge in compactBadgeLabels"
                    :key="badge.key"
                    :class="[
                        'px-1.5 py-0.5 rounded-full text-[7px] leading-none font-black uppercase tracking-wider',
                        badge.tone === 'slate' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300' : '',
                        badge.tone === 'teal' ? 'bg-teal-100/80 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300' : '',
                        badge.tone === 'emerald' ? 'bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300' : '',
                        badge.tone === 'orange' ? 'bg-orange-100/80 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300' : '',
                        badge.tone === 'violet' ? 'bg-violet-100/70 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300' : '',
                        badge.tone === 'sky' ? 'bg-sky-100/70 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300' : '',
                        badge.tone === 'indigo' ? 'bg-indigo-100/70 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300' : '',
                        badge.tone === 'amber' ? 'bg-amber-100/70 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300' : ''
                    ]"
                >
                    {{ badge.label }}
                </span>
                <button
                    v-for="ct in coTeachers"
                    :key="'compact-co-' + ct.teacherId"
                    type="button"
                    @click.stop="emit('jump-to-teacher', ct.teacherId)"
                    class="px-1.5 py-0.5 rounded-full text-[7px] leading-none font-black bg-teal-100/80 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300 hover:bg-teal-200/80 dark:hover:bg-teal-900/50 hover:underline cursor-pointer"
                    v-tooltip.top="`Jump to ${ct.name}`"
                >
                    {{ ct.name }}
                </button>
            </div>
        </div>

        <div class="flex-1 min-h-0 text-center flex flex-col overflow-hidden">
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
            
            <div v-if="!store.isCompressed || !useCompactBadgeOverlay" class="space-y-1.5 mt-1 mb-1.5 shrink-0">
                    <div class="flex flex-wrap gap-1">
                        <span
                            v-if="section.quarters"
                            class="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300"
                        >
                            Q {{ section.quarters }}
                        </span>
                        <span
                            v-if="section.days"
                            class="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300"
                        >
                            D {{ section.days }}
                        </span>
                        <span
                            v-for="flag in quickFlags"
                            :key="flag.key"
                            :class="[
                                'px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider',
                                flag.tone === 'teal' ? 'bg-teal-100/80 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300' : '',
                                flag.tone === 'emerald' ? 'bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300' : '',
                                flag.tone === 'orange' ? 'bg-orange-100/80 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300' : '',
                                flag.tone === 'violet' ? 'bg-violet-100/70 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300' : '',
                                flag.tone === 'sky' ? 'bg-sky-100/70 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300' : '',
                                flag.tone === 'indigo' ? 'bg-indigo-100/70 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300' : '',
                                flag.tone === 'amber' ? 'bg-amber-100/70 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300' : ''
                            ]"
                        >
                            {{ flag.label }}
                        </span>
                    </div>

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
                    <span :class="['font-black uppercase tracking-wider text-teal-500 dark:text-teal-300', store.isCompressed ? 'text-[6px]' : 'text-[7px]']">With</span>
                    <button
                        v-for="ct in coTeachers"
                        :key="ct.teacherId"
                        type="button"
                        @click.stop="emit('jump-to-teacher', ct.teacherId)"
                        :class="[
                            'font-black px-1.5 py-0.5 rounded bg-teal-100/80 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300 hover:bg-teal-200/80 dark:hover:bg-teal-900/50 hover:underline transition-colors cursor-pointer',
                            store.isCompressed ? 'text-[6px]' : 'text-[7px]'
                        ]"
                        v-tooltip.top="`Jump to ${ct.name}`"
                    >
                        {{ ct.name }}
                    </button>
                    </div>
                    <div v-if="!store.isCompressed" class="space-y-0.5">
                        <div
                            v-for="st in previewStudents"
                            :key="st.studentId || st.student_id || st.id || st._displayName"
                            class="truncate text-[7px] font-semibold text-slate-500 dark:text-slate-300"
                        >
                            {{ st._displayName }}
                        </div>
                        <div v-if="hiddenPreviewCount > 0" class="text-[7px] font-black text-blue-500 dark:text-blue-300 uppercase tracking-wider">
                            +{{ hiddenPreviewCount }} more
                        </div>
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
    outline: 3px solid #6366f1 !important;
    border-color: #6366f1 !important;
    background-color: #eef2ff !important;
    z-index: 20 !important;
    box-shadow: 0 4px 12px -4px rgba(99, 102, 241, 0.35) !important;
}

.my-app-dark .highlight-subsection {
    background-color: #312e81 !important;
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
