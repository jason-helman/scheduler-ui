<script setup>
import { ref, computed, nextTick, onBeforeUnmount, onMounted, provide, watch } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Message from 'primevue/message'
import ScheduleSelector from './ScheduleSelector.vue'
import UnplacedSectionsDialog from './UnplacedSectionsDialog.vue'
import ScheduleCell from './ScheduleCell.vue'
import TeacherSummaryCell from './TeacherSummaryCell.vue'
import PeriodHeaderCell from './PeriodHeaderCell.vue'

import { store } from '../../store'
import { useMasterScheduleTableConfig } from '../../composables/useMasterScheduleTableConfig'
import { useSectionNavigation } from '../../composables/useSectionNavigation'
import { useViewportTableHeight } from '../../composables/useViewportTableHeight'
import { isRelatedSection } from '../../utils'

const showUnplacedDialog = ref(false)
const selectedTeacherIdForUnplaced = ref(null)
const tableRef = ref(null)
const tableHostRef = ref(null)
const isMasterGridScrolling = ref(false)
const masterBadgeFitEpoch = ref(0)
let gridScrollContainer = null
let gridScrollIdleTimer = null
let badgeFitRafId = null

provide('master-grid-scroll-state', isMasterGridScrolling)
provide('master-grid-badge-fit-epoch', masterBadgeFitEpoch)

const { periods, scheduleData, rowItemSize, virtualScrollerOptions } = useMasterScheduleTableConfig({
    localDataset: computed(() => store.localDataset),
    isCompressed: computed(() => store.isCompressed)
})

const openUnplacedSections = (teacher) => {
    if (teacher.unplacedSections && teacher.unplacedSections.length > 0) {
        selectedTeacherIdForUnplaced.value = teacher.teacherId
        showUnplacedDialog.value = true
    }
}

const { tableScrollHeight } = useViewportTableHeight({
    tableHostRef,
    isCompressed: computed(() => store.isCompressed),
    watchSource: () => [store.isCompressed, store.error, store.selectedVersion?.schedule_id ?? null, periods.value.length]
})

const {
    effectiveHoveredSection,
    jumpPulseSectionId,
    jumpPulseVisible,
    setHoveredSection,
    clearHoveredSection,
    jumpToTeacherRelatedSection,
    jumpToSection
} = useSectionNavigation({
    scheduleData,
    tableRef,
    rowItemSize,
    isCompressed: computed(() => store.isCompressed),
    isRelatedSection
})

const clearGridScrollIdleTimer = () => {
    if (gridScrollIdleTimer == null) return
    window.clearTimeout(gridScrollIdleTimer)
    gridScrollIdleTimer = null
}

const onGridScroll = () => {
    isMasterGridScrolling.value = true
    clearGridScrollIdleTimer()
    gridScrollIdleTimer = window.setTimeout(() => {
        isMasterGridScrolling.value = false
        gridScrollIdleTimer = null
    }, 120)
}

const bindGridScrollContainer = () => {
    const nextContainer = tableHostRef.value?.querySelector('.p-datatable-table-container') || null
    if (nextContainer === gridScrollContainer) return
    if (gridScrollContainer) {
        gridScrollContainer.removeEventListener('scroll', onGridScroll)
    }
    gridScrollContainer = nextContainer
    if (gridScrollContainer) {
        gridScrollContainer.addEventListener('scroll', onGridScroll, { passive: true })
    }
}

const requestBadgeFitRecompute = () => {
    if (badgeFitRafId != null) cancelAnimationFrame(badgeFitRafId)
    badgeFitRafId = requestAnimationFrame(() => {
        badgeFitRafId = null
        masterBadgeFitEpoch.value += 1
    })
}

onMounted(() => {
    nextTick(() => {
        bindGridScrollContainer()
        requestBadgeFitRecompute()
    })
    window.addEventListener('resize', requestBadgeFitRecompute)
})

watch(
    () => [store.selectedVersion?.schedule_id ?? null, periods.value.length, store.isCompressed],
    () => nextTick(() => {
        bindGridScrollContainer()
        requestBadgeFitRecompute()
    })
)

onBeforeUnmount(() => {
    if (gridScrollContainer) {
        gridScrollContainer.removeEventListener('scroll', onGridScroll)
        gridScrollContainer = null
    }
    clearGridScrollIdleTimer()
    if (badgeFitRafId != null) cancelAnimationFrame(badgeFitRafId)
    window.removeEventListener('resize', requestBadgeFitRecompute)
})
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
                    <TeacherSummaryCell :teacher="slotProps.data" :show-ids="store.showIds" @open-unplaced="openUnplacedSections" />
                </template>
            </Column>
            <Column v-for="p in periods" :key="p.coursePeriodId" class="text-gray-900 dark:text-gray-100 align-top" :style="{ minWidth: store.isCompressed ? '160px' : '200px', width: 'auto' }">
                <template #header>
                    <PeriodHeaderCell :period="p" :show-ids="store.showIds" :is-compressed="store.isCompressed" />
                </template>
                <template #body="slotProps">
                    <ScheduleCell 
                        :teacher="slotProps.data" 
                        :period-id="p.coursePeriodId" 
                        :row-index="slotProps.index ?? 0"
                        :hovered-section="effectiveHoveredSection"
                        :jump-pulse-section-id="jumpPulseSectionId"
                        :jump-pulse-visible="jumpPulseVisible"
                        @hover="setHoveredSection"
                        @leave="clearHoveredSection"
                        @toggle-lock="id => store.toggleLock(id)"
                        @jump-to-teacher="jumpToTeacherRelatedSection"
                        @jump-to-section="jumpToSection"
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

/* Stable fallback to prevent first-paint flashes during virtualized row recycle. */
:deep(.p-datatable-tbody > tr) {
    background-color: #ffffff !important;
}

:deep(.p-datatable-tbody > tr:nth-child(odd) > td) {
    background-color: #ffffff !important;
}

:deep(.p-datatable-tbody > tr:nth-child(even) > td) {
    background-color: #e2e8f0 !important;
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

.my-app-dark .master-table .p-datatable-tbody > tr {
    background-color: #111b2e !important;
}

.my-app-dark .master-table .p-datatable-tbody > tr:nth-child(odd) > td {
    background-color: #111b2e !important;
}

.my-app-dark .master-table .p-datatable-tbody > tr:nth-child(even) > td {
    background-color: #090f19 !important;
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
