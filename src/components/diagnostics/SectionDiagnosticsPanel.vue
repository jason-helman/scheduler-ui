<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Badge from 'primevue/badge'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { CopyButton } from '../common'

const props = defineProps({
    sectionRows: {
        type: Array,
        required: true
    },
    unplacedSectionRows: {
        type: Array,
        required: true
    },
    placedSectionRows: {
        type: Array,
        required: true
    },
    invalidSectionRows: {
        type: Array,
        required: true
    },
    selectedSection: {
        type: Object,
        default: null
    },
    hasDiagnostics: {
        type: Boolean,
        default: false
    },
    currentSectionDiagnostics: {
        type: Array,
        required: true
    },
    parentDiagnosticCount: {
        type: Number,
        default: 0
    },
    showIds: {
        type: Boolean,
        default: false
    },
    resolveIdName: {
        type: Function,
        required: true
    },
    activeSectionListTab: {
        type: String,
        required: true
    },
    scrollToSectionId: {
        type: [String, Number],
        default: null
    },
    scrollRequestKey: {
        type: Number,
        default: 0
    }
})

const emit = defineEmits([
    'update:selectedSection',
    'update:activeSectionListTab'
])

const selectedSectionModel = computed({
    get: () => props.selectedSection,
    set: (value) => emit('update:selectedSection', value)
})

const activeSectionListTabModel = computed({
    get: () => props.activeSectionListTab,
    set: (value) => emit('update:activeSectionListTab', value)
})

const sectionById = computed(() => {
    const map = new Map()
    ;(props.sectionRows || []).forEach((section) => map.set(String(section.sectionId), section))
    return map
})

const parentSection = computed(() => {
    const parentId = selectedSectionModel.value?.parentSectionId
    if (parentId == null) return null
    return sectionById.value.get(String(parentId)) || null
})

const isSubsectionTarget = (diagnostic) => {
    if (!diagnostic || diagnostic.targetEntityId == null || !selectedSectionModel.value) return false
    const target = sectionById.value.get(String(diagnostic.targetEntityId))
    if (!target) return false
    return String(target.parentSectionId ?? '') === String(selectedSectionModel.value.sectionId)
}

const targetLabel = (diagnostic) => (isSubsectionTarget(diagnostic) ? 'Caused by subsection' : 'Target')

const sectionTableVirtualScrollerOptions = {
    itemSize: 38,
    numToleratedItems: 12,
    delay: 0,
    showLoader: false
}

const unplacedTableRef = ref(null)
const placedTableRef = ref(null)
const invalidTableRef = ref(null)

const rowClass = (data) => 'diag-section-row diag-section-row--' + String(data.sectionId)

const scrollToTargetSection = async (explicitTargetId = null) => {
    const resolvedTargetId = explicitTargetId ?? props.scrollToSectionId
    if (resolvedTargetId == null) return

    const targetId = String(resolvedTargetId)

    for (let attempt = 0; attempt < 20; attempt += 1) {
        await nextTick()

        const tableRef =
            activeSectionListTabModel.value === '2'
                ? invalidTableRef.value
                : (activeSectionListTabModel.value === '1' ? placedTableRef.value : unplacedTableRef.value)

        if (!tableRef) {
            await new Promise((resolve) => setTimeout(resolve, 30))
            continue
        }

        const root = tableRef.$el || tableRef
        if (!root) {
            await new Promise((resolve) => setTimeout(resolve, 30))
            continue
        }

        const renderedRow = root.querySelector('.diag-section-row--' + targetId)
        if (renderedRow) {
            renderedRow.scrollIntoView({ block: 'center', inline: 'nearest' })
            return
        }

        const processedRows = tableRef.processedData || []
        const targetIndex = processedRows.findIndex((row) => String(row.sectionId) === targetId)

        if (targetIndex >= 0) {
            const virtualScroller = tableRef.getVirtualScrollerRef?.()
            if (virtualScroller?.scrollToIndex) {
                virtualScroller.scrollToIndex(targetIndex)
                virtualScroller.scrollInView?.(targetIndex, 'to-start')
            }

            const vsEl = root.querySelector('.p-virtualscroller, [data-pc-name="virtualscroller"]')
            if (vsEl) {
                vsEl.scrollTop = Math.max(0, targetIndex * sectionTableVirtualScrollerOptions.itemSize)
            }
        }

        await new Promise((resolve) => requestAnimationFrame(resolve))
    }
}

const selectSection = async (section) => {
    if (!section) return
    activeSectionListTabModel.value = section.isInvalid ? '2' : (section.isPlaced ? '1' : '0')
    selectedSectionModel.value = section
    await nextTick()
    scrollToTargetSection(section.sectionId)
    setTimeout(() => scrollToTargetSection(section.sectionId), 80)
}

watch(() => props.scrollRequestKey, (requestKey) => {
    if (!requestKey) return

    scrollToTargetSection()
    setTimeout(() => scrollToTargetSection(), 80)
    setTimeout(() => scrollToTargetSection(), 220)
}, { immediate: true, flush: 'post' })
</script>

<template>
    <div class="h-full min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-1 card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col min-h-0">
            <div class="flex items-center justify-between mb-6 px-2">
                <h3 class="text-xl font-black">Sections</h3>
                <Badge :value="sectionRows.length" severity="secondary"></Badge>
            </div>
            <Tabs v-model:value="activeSectionListTabModel" class="h-full min-h-0 flex flex-col">
                <TabList>
                    <Tab value="0">
                        Unplaced
                        <Badge class="ml-2" :value="unplacedSectionRows.length" severity="warn" />
                    </Tab>
                    <Tab value="1">
                        Placed
                        <Badge class="ml-2" :value="placedSectionRows.length" severity="success" />
                    </Tab>
                    <Tab value="2">
                        Invalid
                        <Badge class="ml-2" :value="invalidSectionRows.length" severity="danger" />
                    </Tab>
                </TabList>
                <TabPanels class="min-h-0 flex-1 overflow-hidden">
                    <TabPanel value="0" class="h-full min-h-0 overflow-hidden !p-0">
                        <DataTable
                            ref="unplacedTableRef"
                            v-model:selection="selectedSectionModel"
                            :value="unplacedSectionRows"
                            selectionMode="single"
                            stripedRows
                            class="p-datatable-sm"
                            sortField="course_name"
                            :sortOrder="1"
                            :rowClass="rowClass"
                            dataKey="sectionId"
                            scrollable
                            scrollHeight="flex"
                            :virtualScrollerOptions="sectionTableVirtualScrollerOptions"
                            tableStyle="min-width: 30rem; table-layout: fixed"
                        >
                            <Column field="course_name" header="Course" sortable class="font-bold text-sm" style="width: 44%"></Column>
                            <Column field="teacher_name" header="Teacher" sortable class="text-xs" style="width: 36%"></Column>
                            <Column field="diagnosticCount" header="Alerts" sortable style="width: 5rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.diagnosticCount" :severity="slotProps.data.diagnosticCount > 0 ? 'danger' : 'secondary'"></Badge>
                                </template>
                            </Column>
                            <Column field="diagnosticTotalCount" header="Total" sortable style="width: 5rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.diagnosticTotalCount" severity="info"></Badge>
                                </template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                    <TabPanel value="1" class="h-full min-h-0 overflow-hidden !p-0">
                        <DataTable
                            ref="placedTableRef"
                            v-model:selection="selectedSectionModel"
                            :value="placedSectionRows"
                            selectionMode="single"
                            stripedRows
                            class="p-datatable-sm"
                            sortField="course_name"
                            :sortOrder="1"
                            :rowClass="rowClass"
                            dataKey="sectionId"
                            scrollable
                            scrollHeight="flex"
                            :virtualScrollerOptions="sectionTableVirtualScrollerOptions"
                            tableStyle="min-width: 30rem; table-layout: fixed"
                        >
                            <Column field="course_name" header="Course" sortable class="font-bold text-sm" style="width: 44%"></Column>
                            <Column field="teacher_name" header="Teacher" sortable class="text-xs" style="width: 36%"></Column>
                            <Column field="diagnosticCount" header="Alerts" sortable style="width: 5rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.diagnosticCount" :severity="slotProps.data.diagnosticCount > 0 ? 'warning' : 'secondary'"></Badge>
                                </template>
                            </Column>
                            <Column field="diagnosticTotalCount" header="Total" sortable style="width: 5rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.diagnosticTotalCount" severity="info"></Badge>
                                </template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                    <TabPanel value="2" class="h-full min-h-0 overflow-hidden !p-0">
                        <DataTable
                            ref="invalidTableRef"
                            v-model:selection="selectedSectionModel"
                            :value="invalidSectionRows"
                            selectionMode="single"
                            stripedRows
                            class="p-datatable-sm"
                            sortField="invalidDiagnosticCount"
                            :sortOrder="-1"
                            :rowClass="rowClass"
                            dataKey="sectionId"
                            scrollable
                            scrollHeight="flex"
                            :virtualScrollerOptions="sectionTableVirtualScrollerOptions"
                            tableStyle="min-width: 30rem; table-layout: fixed"
                        >
                            <Column field="course_name" header="Course" sortable class="font-bold text-sm" style="width: 40%"></Column>
                            <Column field="teacher_name" header="Teacher" sortable class="text-xs" style="width: 34%"></Column>
                            <Column field="invalidDiagnosticCount" header="Invalid" sortable style="width: 6rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.invalidDiagnosticCount" severity="danger"></Badge>
                                </template>
                            </Column>
                            <Column field="diagnosticCount" header="Alerts" sortable style="width: 5rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.diagnosticCount" :severity="slotProps.data.diagnosticCount > 0 ? 'danger' : 'secondary'"></Badge>
                                </template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </div>

        <div class="lg:col-span-2 card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col min-h-0">
            <h3 class="text-xl font-black mb-6 px-2">Diagnostic Report</h3>

            <div v-if="!selectedSectionModel" class="flex-1 min-h-0 flex flex-col items-center justify-center py-10 text-gray-400">
                <i class="pi pi-search text-6xl mb-4 opacity-20"></i>
                <p class="font-medium text-lg">Select a section to inspect diagnostics.</p>
            </div>

            <div v-else class="flex-1 min-h-0 flex flex-col gap-6">
                <div class="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-3">
                            <h4 class="text-2xl font-black text-gray-900 dark:text-white">{{ selectedSectionModel.course_name }}</h4>
                            <div class="flex gap-2">
                                <Tag :value="selectedSectionModel.isPlaced ? 'Placed' : 'Unplaced'" :severity="selectedSectionModel.isPlaced ? 'success' : 'warn'" />
                                <Tag v-if="selectedSectionModel.isLab" severity="success" value="Lab" />
                                <Tag v-if="selectedSectionModel.isInclusion" severity="warning" value="Inclusion" />
                            </div>
                        </div>
                        <p class="text-gray-500 font-bold flex items-center gap-2">
                            <i class="pi pi-user text-xs"></i>
                            {{ selectedSectionModel.teacher_name }}
                        </p>
                    </div>
                    <div v-if="showIds" class="flex flex-col items-end gap-2">
                        <CopyButton :value="selectedSectionModel.sectionId" label="Section ID" />
                        <div class="text-[10px] font-black uppercase text-gray-400">Section ID</div>
                    </div>
                </div>

                <div v-if="parentSection" class="flex items-center justify-between gap-4 rounded-2xl border border-sky-100 dark:border-sky-900/30 bg-sky-50/60 dark:bg-sky-900/10 px-5 py-4">
                    <div class="min-w-0">
                        <div class="text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-300">Subsection Context</div>
                        <div class="mt-1 text-sm font-semibold text-sky-800 dark:text-sky-100">
                            This subsection belongs to {{ parentSection.course_name || resolveIdName(parentSection.sectionId, 'section') }}.
                        </div>
                        <div class="mt-1 text-xs text-sky-700/80 dark:text-sky-200/80">
                            Parent section diagnostics may explain shared placement behavior.
                        </div>
                        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-sky-700 dark:text-sky-200">
                            <span class="rounded-full bg-sky-100 dark:bg-sky-900/40 px-2.5 py-1">
                                Parent diagnostics: {{ parentDiagnosticCount }}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        class="shrink-0 rounded-full border border-sky-200 dark:border-sky-800 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-sky-700 dark:text-sky-200 transition-colors hover:bg-sky-100 dark:hover:bg-sky-900/30"
                        @click="selectSection(parentSection)"
                    >
                        View Parent
                    </button>
                </div>

                <div v-if="!hasDiagnostics" class="p-12 text-center bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <i class="pi pi-exclamation-triangle text-5xl text-amber-500 mb-4"></i>
                    <p class="text-amber-700 dark:text-amber-400 font-bold text-lg mb-2">No Diagnostics Available</p>
                    <p class="text-amber-600/70 dark:text-amber-500/70 text-sm">Diagnostics are generated when you run the placement simulation.</p>
                </div>

                <div v-else-if="currentSectionDiagnostics.length === 0" class="p-12 text-center bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <i class="pi pi-check-circle text-5xl text-emerald-500 mb-4"></i>
                    <p class="text-emerald-700 dark:text-emerald-400 font-bold text-lg mb-2">No Section Diagnostics Recorded</p>
                    <p class="text-emerald-600/70 dark:text-emerald-500/70 text-sm">This section has no diagnostics in the current run.</p>
                </div>

                <div v-else class="h-full min-h-0 space-y-4 overflow-y-auto pr-2">
                    <div class="flex items-center gap-2 px-2 text-amber-500">
                        <i class="pi pi-exclamation-circle font-black"></i>
                        <span class="text-xs font-black uppercase tracking-widest">Section Diagnostics</span>
                    </div>
                    <div
                        v-for="(diag, idx) in currentSectionDiagnostics"
                        :key="`diag-${idx}`"
                        :class="[
                            'space-y-2 p-5 rounded-2xl border items-start transition-all',
                            diag.severity === 'error'
                                ? 'border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/5 hover:border-red-200 dark:hover:border-red-800'
                                : (diag.severity === 'warn'
                                    ? 'border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/5 hover:border-amber-200 dark:hover:border-amber-800'
                                    : 'border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/5 hover:border-blue-200 dark:hover:border-blue-800')
                        ]"
                    >
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <div class="text-sm font-bold leading-relaxed" :class="diag.severity === 'error' ? 'text-red-700 dark:text-red-400' : (diag.severity === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300')">
                                    {{ diag.code }}: {{ diag.message }}
                                </div>
                                <div class="mt-1 text-xs font-semibold" :class="diag.severity === 'error' ? 'text-red-700/80 dark:text-red-400/80' : (diag.severity === 'warn' ? 'text-amber-700/80 dark:text-amber-300/80' : 'text-blue-700/80 dark:text-blue-300/80')">
                                    Level: {{ diag.severity }}
                                    <span v-if="diag.category"> | Category: {{ diag.category }}</span>
                                </div>
                            </div>
                            <Tag
                                :value="diag.severity"
                                :severity="diag.severity === 'error' ? 'danger' : (diag.severity === 'warn' ? 'warn' : 'info')"
                            />
                        </div>
                        <div v-if="diag.targetEntityId != null" class="text-xs space-y-0.5" :class="diag.severity === 'error' ? 'text-red-700/80 dark:text-red-400/80' : (diag.severity === 'warn' ? 'text-amber-700/80 dark:text-amber-300/80' : 'text-blue-700/80 dark:text-blue-300/80')">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-bold">{{ targetLabel(diag) }}:</span>
                                <span>{{ resolveIdName(diag.targetEntityId, 'section') }}</span>
                                <Tag v-if="isSubsectionTarget(diag)" severity="warn" value="Cause" />
                                <CopyButton
                                    v-if="showIds"
                                    :value="diag.targetEntityId"
                                    label="Target ID"
                                />
                            </div>
                        </div>
                        <div v-if="diag.metrics && Object.keys(diag.metrics).length > 0" class="text-xs" :class="diag.severity === 'error' ? 'text-red-700/80 dark:text-red-400/80' : (diag.severity === 'warn' ? 'text-amber-700/80 dark:text-amber-300/80' : 'text-blue-700/80 dark:text-blue-300/80')">
                            <div class="font-bold mb-1">Metrics</div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                <div v-for="([key, value], metricIdx) in Object.entries(diag.metrics)" :key="`${idx}-${metricIdx}`">
                                    {{ key }}: {{ value }}
                                </div>
                            </div>
                        </div>
                        <div v-if="diag.conflictingIds?.length" class="text-xs" :class="diag.severity === 'error' ? 'text-red-700/80 dark:text-red-400/80' : (diag.severity === 'warn' ? 'text-amber-700/80 dark:text-amber-300/80' : 'text-blue-700/80 dark:text-blue-300/80')">
                            <div class="font-bold mb-1">References</div>
                            <div class="space-y-2">
                                <div
                                    v-for="(refId, refIdx) in diag.conflictingIds"
                                    :key="`${idx}-ref-${refIdx}`"
                                    class="rounded border border-current/20 px-2 py-1"
                                >
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span>{{ resolveIdName(refId) }}</span>
                                        <CopyButton
                                            v-if="showIds"
                                            :value="refId"
                                            label="Reference ID"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
