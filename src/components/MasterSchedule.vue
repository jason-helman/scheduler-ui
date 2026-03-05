<script setup>
import { ref, computed, shallowRef, onBeforeUnmount, onMounted, nextTick, watch } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Badge from 'primevue/badge'
import BadgeChip from './BadgeChip.vue'
import CopyButton from './CopyButton.vue'
import ScheduleSelector from './ScheduleSelector.vue'
import UnplacedSectionsDialog from './UnplacedSectionsDialog.vue'
import ScheduleCell from './ScheduleCell.vue'
import { store } from '../store'
import { transformScheduleData, transformPeriods } from '../utils/scheduleTransformer'

const showUnplacedDialog = ref(false)
const selectedTeacherIdForUnplaced = ref(null)
const hoveredSection = shallowRef(null)
const hoveredSectionKey = ref(null)
const highlightedTeacherId = ref(null)
const tableRef = ref(null)
const tableHostRef = ref(null)
const tableScrollHeight = ref('65vh')
let hoverRafId = null
let nextHoveredSection = null
let clearHighlightTimeoutId = null
let tableHeightRafId = null

const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':')
    const hours = parseInt(h)
    const suffix = hours >= 12 ? 'pm' : 'am'
    const displayHours = ((hours + 11) % 12 + 1).toString().padStart(2, '0')
    return `${displayHours}:${m}${suffix}`
}

// Periods derived from local dataset
const periods = computed(() => transformPeriods(store.localDataset?.scheduleStructure))

// Transform raw sections from local dataset into the teacher-grouped view with intelligent layers
const scheduleData = computed(() => transformScheduleData(store.localDataset))
const rowItemSize = computed(() => (store.isCompressed ? 264 : 354))
const virtualScrollerOptions = computed(() => ({
    itemSize: rowItemSize.value,
    numToleratedItems: 16,
    delay: 30,
    showLoader: false
}))

const updateTableScrollHeight = () => {
    if (!tableHostRef.value) return
    const top = tableHostRef.value.getBoundingClientRect().top
    const viewportHeight = window.innerHeight
    const bottomGap = 40
    const available = Math.floor(viewportHeight - top - bottomGap)
    const minHeight = store.isCompressed ? 260 : 320
    tableScrollHeight.value = `${Math.max(minHeight, available)}px`
}

const scheduleTableHeightUpdate = () => {
    if (tableHeightRafId != null) cancelAnimationFrame(tableHeightRafId)
    tableHeightRafId = requestAnimationFrame(() => {
        tableHeightRafId = null
        updateTableScrollHeight()
    })
}

const openUnplacedSections = (teacher) => {
    if (teacher.unplacedSections && teacher.unplacedSections.length > 0) {
        selectedTeacherIdForUnplaced.value = teacher.teacherId
        showUnplacedDialog.value = true
    }
}

const getHoverKey = (section) => {
    if (!section) return null
    return `${section.sectionId ?? ''}:${section.spanId ?? ''}:${section.parentSectionId ?? ''}`
}

const applyHoveredSection = () => {
    hoverRafId = null
    const key = getHoverKey(nextHoveredSection)
    if (key === hoveredSectionKey.value) return
    hoveredSection.value = nextHoveredSection
    hoveredSectionKey.value = key
}

const scheduleHoveredSectionUpdate = (section) => {
    nextHoveredSection = section
    if (hoverRafId != null) return
    hoverRafId = requestAnimationFrame(applyHoveredSection)
}

const setHoveredSection = (section) => {
    scheduleHoveredSectionUpdate(section)
}

const clearHoveredSection = () => {
    scheduleHoveredSectionUpdate(null)
}

const jumpToTeacherRow = async (targetTeacherId) => {
    const teacherIdNum = Number(targetTeacherId)
    if (!Number.isFinite(teacherIdNum)) return

    const rowIndex = scheduleData.value.findIndex(t => Number(t.teacherId) === teacherIdNum)
    if (rowIndex === -1) return

    const tableEl = tableRef.value?.$el
    const virtualScrollerEl = tableEl?.querySelector('.p-virtualscroller')
    if (virtualScrollerEl) {
        const headerEl = tableEl?.querySelector('.p-datatable-thead')
        const headerHeight = headerEl?.getBoundingClientRect().height || 0
        const topPadding = store.isCompressed ? 12 : 8
        const targetTop = Math.max(0, (rowIndex * rowItemSize.value) - headerHeight - topPadding)
        if (typeof virtualScrollerEl.scrollTo === 'function') {
            virtualScrollerEl.scrollTo({ top: targetTop, behavior: 'smooth' })
        } else {
            virtualScrollerEl.scrollTop = targetTop
        }
    }

    highlightedTeacherId.value = teacherIdNum
    if (clearHighlightTimeoutId) clearTimeout(clearHighlightTimeoutId)
    clearHighlightTimeoutId = setTimeout(() => {
        highlightedTeacherId.value = null
        clearHighlightTimeoutId = null
    }, 1500)
}

onBeforeUnmount(() => {
    if (hoverRafId != null) cancelAnimationFrame(hoverRafId)
    if (tableHeightRafId != null) cancelAnimationFrame(tableHeightRafId)
    if (clearHighlightTimeoutId) clearTimeout(clearHighlightTimeoutId)
    window.removeEventListener('resize', scheduleTableHeightUpdate)
})

onMounted(() => {
    nextTick(() => updateTableScrollHeight())
    window.addEventListener('resize', scheduleTableHeightUpdate)
})

watch(
    () => [store.isCompressed, store.error, store.selectedVersion?.schedule_id ?? null, periods.value.length],
    () => nextTick(() => scheduleTableHeightUpdate())
)
</script>

<template>
  <div class="space-y-6">
    <!-- Selectors -->
    <ScheduleSelector />

    <Message v-if="store.error" severity="error" class="shadow-sm">{{ store.error }}</Message>

    <!-- Data Table Card -->
    <div :class="['card bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300 flex flex-col min-h-0', store.isCompressed ? 'p-3' : 'p-6']">
        <div :class="['flex items-center justify-between px-2', store.isCompressed ? 'mb-3' : 'mb-6']">
            <h2 :class="['font-black tracking-tight text-gray-900 dark:text-white transition-all', store.isCompressed ? 'text-xl' : 'text-3xl']">Master Schedule</h2>
            <div v-if="store.selectedVersion" class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                {{ store.selectedVersion.schedule_name }}
            </div>
        </div>
        <div ref="tableHostRef" class="min-h-0">
            <DataTable
                ref="tableRef"
                :value="scheduleData"
                :loading="store.loading"
                stripedRows
                scrollable
                :scrollHeight="tableScrollHeight"
                :virtualScrollerOptions="virtualScrollerOptions"
                :tableStyle="store.isCompressed ? 'min-width: 70rem; table-layout: fixed' : 'min-width: 80rem; table-layout: fixed'"
                :class="['p-datatable-sm master-table', { 'compressed-mode': store.isCompressed }]"
            >
            <template #empty>
                <div class="py-20 text-center">
                    <i class="pi pi-inbox text-5xl text-gray-200 dark:text-gray-700 mb-4"></i>
                    <p class="text-gray-400 dark:text-gray-500 font-medium">No data found for this version.</p>
                </div>
            </template>
            <Column field="teacherName" header="Teacher" frozen class="font-bold teacher-col" :style="{ width: store.isCompressed ? '120px' : '150px' }">
                <template #body="slotProps">
                    <div
                        :id="`teacher-row-${slotProps.data.teacherId}`"
                        :class="[
                            'flex flex-col gap-1 py-1 px-1.5 rounded transition-colors duration-150',
                            Number(highlightedTeacherId) === Number(slotProps.data.teacherId) ? 'bg-yellow-100/80 dark:bg-yellow-900/40' : ''
                        ]"
                    >
                        <div class="flex items-start justify-between gap-1">
                            <span class="truncate leading-tight text-[11px] text-gray-900 dark:text-gray-100" v-tooltip.top="slotProps.data.teacherName">
                                {{ slotProps.data.teacherName }}
                            </span>
                            <CopyButton v-if="store.showIds && slotProps.data.teacherId != null" :value="slotProps.data.teacherId" label="Teacher ID" />
                        </div>

                        <div class="flex flex-wrap items-center gap-1 text-[8px] font-black uppercase tracking-wider">
                            <BadgeChip :label="`${slotProps.data.summary?.sections ?? 0} Sec`" tone="slate" size="sm" shape="rounded" />
                            <BadgeChip :label="`${slotProps.data.summary?.students ?? 0} Stu`" tone="blue" size="sm" shape="rounded" />
                            <BadgeChip
                                :label="`${slotProps.data.summary?.placementPct ?? 100}% Placed`"
                                :tone="(slotProps.data.summary?.unplaced ?? 0) > 0 ? 'amber' : 'emerald'"
                                size="sm"
                                shape="rounded"
                            />
                        </div>

                        <div class="text-[8px] font-bold text-gray-500 dark:text-gray-400 leading-tight">
                            <span class="uppercase tracking-wider">Classrooms:</span>
                            <BadgeChip
                                class="ml-1"
                                :label="`${slotProps.data.summary?.classroomCount ?? slotProps.data.summary?.roomDiversity ?? 0}`"
                                tone="slate"
                                size="sm"
                                shape="rounded"
                                :tooltip="slotProps.data.summary?.classroomList || 'No classrooms'"
                            />
                        </div>

                        <div class="text-[8px] font-bold text-gray-500 dark:text-gray-400 leading-tight">
                            <span class="uppercase tracking-wider">Departments:</span>
                            <BadgeChip
                                class="ml-1"
                                :label="`${slotProps.data.summary?.departmentCount ?? 0}`"
                                tone="slate"
                                size="sm"
                                shape="rounded"
                                :tooltip="slotProps.data.summary?.departmentList || 'No departments'"
                            />
                        </div>

                        <div class="text-[8px] font-bold text-gray-500 dark:text-gray-400 leading-tight">
                            <span class="uppercase tracking-wider">Subjects:</span>
                            <BadgeChip
                                class="ml-1"
                                :label="`${slotProps.data.summary?.subjectCount ?? 0}`"
                                tone="slate"
                                size="sm"
                                shape="rounded"
                                :tooltip="slotProps.data.summary?.subjectList || 'No subjects'"
                            />
                        </div>

                        <div v-if="(slotProps.data.unplacedSections || []).length > 0" 
                             class="flex items-center gap-1.5 animate-pulse cursor-pointer hover:opacity-80 transition-opacity"
                             @click="openUnplacedSections(slotProps.data)">
                            <Badge :value="slotProps.data.unplacedSections.length" severity="danger" class="!text-[8px] !min-w-[1.2rem] !h-[1.2rem]"></Badge>
                            <span class="text-[9px] font-black text-red-500 uppercase tracking-tighter hover:underline">Unplaced</span>
                        </div>
                    </div>
                </template>
            </Column>
            <Column v-for="p in periods" :key="p.coursePeriodId" class="text-gray-900 dark:text-gray-100 align-top" :style="{ minWidth: store.isCompressed ? '160px' : '200px', width: 'auto' }">
                <template #header>
                    <div class="flex flex-col items-center w-full group/period">
                        <div class="flex items-center gap-2">
                            <span :class="['font-black', store.isCompressed ? 'text-[10px]' : 'text-[11px]']">{{ p.name }}</span>
                            <CopyButton v-if="store.showIds && p.coursePeriodId != null" :value="p.coursePeriodId" label="Period ID" />
                        </div>
                        <span v-if="p.startTime" :class="['font-bold opacity-60 tracking-normal normal-case mt-0.5', store.isCompressed ? 'text-[8px]' : 'text-[9px]']">
                            {{ formatTime(p.startTime) }} - {{ formatTime(p.endTime) }}
                        </span>
                    </div>
                </template>
                <template #body="slotProps">
                    <ScheduleCell 
                        :teacher="slotProps.data" 
                        :period-id="p.coursePeriodId" 
                        :hovered-section="hoveredSection"
                        @hover="setHoveredSection"
                        @leave="clearHoveredSection"
                        @toggle-lock="id => store.toggleLock(id)"
                        @jump-to-teacher="jumpToTeacherRow"
                    />
                </template>
            </Column>
            </DataTable>
        </div>
    </div>

    <!-- Unplaced Dialog -->
    <UnplacedSectionsDialog 
        v-model:visible="showUnplacedDialog" 
        :teacher-id="selectedTeacherIdForUnplaced" 
    />
  </div>
</template>

<style scoped>
:deep(.p-datatable-thead) {
    position: sticky !important;
    top: 0 !important;
    z-index: 100 !important;
}

:deep(.p-datatable-thead > tr > th) {
    background-color: #f8fafc !important;
    color: #475569 !important;
    border-color: #e2e8f0 !important;
    font-size: 0.75rem !important;
    font-weight: 900 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
    border-bottom-width: 2px !important;
    border-right-width: 1px !important;
    padding: 0.75rem 0.5rem !important;
    text-align: center !important;
}

.compressed-mode :deep(.p-datatable-thead > tr > th) {
    padding: 0.4rem 0.25rem !important;
    font-size: 0.65rem !important;
}

:deep(.p-datatable-thead > tr > th:last-child) {
    border-right-width: 0 !important;
}

:deep(.p-datatable-tbody > tr > td.p-frozen-column) {
    border-right: 3px solid #cbd5e1 !important;
    z-index: 20 !important;
}

:deep(.p-datatable-thead > tr > th.p-frozen-column) {
    background-color: #f8fafc !important;
    border-right: 3px solid #cbd5e1 !important;
    z-index: 110 !important;
    text-align: left !important;
    box-shadow: 4px 0 8px -4px rgba(0,0,0,0.1);
}

:deep(.p-datatable-tbody > tr > td) {
    padding: 0 !important;
}

:deep(.p-virtualscroller-content),
:deep(.p-virtualscroller-spacer) {
    background-color: #ffffff !important;
}
</style>

<style>
.my-app-dark .master-table .p-datatable-thead > tr > th,
.my-app-dark .master-table .p-datatable-thead > tr > th.p-frozen-column {
    background-color: #0f172a !important;
    color: #94a3b8 !important;
    border-color: #1e293b !important;
}

.my-app-dark .master-table .p-datatable-thead > tr > th.p-frozen-column,
.my-app-dark .master-table .p-datatable-tbody > tr > td.p-frozen-column {
    border-right: 3px solid #334155 !important;
    box-shadow: 4px 0 12px -4px rgba(0,0,0,0.5);
}

.my-app-dark .master-table .p-virtualscroller-content,
.my-app-dark .master-table .p-virtualscroller-spacer {
    background-color: #0f172a !important;
}

/* Master Schedule custom scrollbars */
.master-table .p-datatable-table-container {
    scrollbar-width: thin;
    scrollbar-color: #94a3b8 #f1f5f9;
}

.master-table .p-datatable-table-container::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

.master-table .p-datatable-table-container::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 999px;
}

.master-table .p-datatable-table-container::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #94a3b8, #64748b);
    border-radius: 999px;
    border: 2px solid #f1f5f9;
}

.master-table .p-datatable-table-container::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #64748b, #475569);
}

.my-app-dark .master-table .p-datatable-table-container {
    scrollbar-color: #475569 #0f172a;
}

.my-app-dark .master-table .p-datatable-table-container::-webkit-scrollbar-track {
    background: #0f172a;
}

.my-app-dark .master-table .p-datatable-table-container::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #475569, #334155);
    border: 2px solid #0f172a;
}

.my-app-dark .master-table .p-datatable-table-container::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #64748b, #475569);
}
</style>
