<script setup>
import { computed } from 'vue'
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
    currentSectionFailures: {
        type: Array,
        required: true
    },
    currentSectionDecisionDiagnostics: {
        type: Array,
        required: true
    },
    actionableTabLabel: {
        type: String,
        required: true
    },
    noActionableText: {
        type: String,
        required: true
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
    activeSectionDiagnosticTab: {
        type: String,
        required: true
    }
})

const emit = defineEmits([
    'update:selectedSection',
    'update:activeSectionListTab',
    'update:activeSectionDiagnosticTab'
])

const selectedSectionModel = computed({
    get: () => props.selectedSection,
    set: (value) => emit('update:selectedSection', value)
})

const activeSectionListTabModel = computed({
    get: () => props.activeSectionListTab,
    set: (value) => emit('update:activeSectionListTab', value)
})

const activeSectionDiagnosticTabModel = computed({
    get: () => props.activeSectionDiagnosticTab,
    set: (value) => emit('update:activeSectionDiagnosticTab', value)
})
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
                </TabList>
                <TabPanels class="min-h-0 flex-1 overflow-hidden">
                    <TabPanel value="0" class="h-full min-h-0 overflow-hidden !p-0">
                        <DataTable
                            v-model:selection="selectedSectionModel"
                            :value="unplacedSectionRows"
                            selectionMode="single"
                            stripedRows
                            class="p-datatable-sm"
                            dataKey="sectionId"
                            scrollable
                            scrollHeight="flex"
                        >
                            <Column field="course_name" header="Course" sortable class="font-bold text-sm"></Column>
                            <Column field="teacher_name" header="Teacher" sortable class="text-xs"></Column>
                            <Column field="diagnosticCount" header="Issues" sortable style="width: 3rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.diagnosticCount" :severity="slotProps.data.diagnosticCount > 0 ? 'danger' : 'secondary'"></Badge>
                                </template>
                            </Column>
                            <Column field="traceCount" header="Trace" sortable style="width: 3rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.traceCount" severity="info"></Badge>
                                </template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                    <TabPanel value="1" class="h-full min-h-0 overflow-hidden !p-0">
                        <DataTable
                            v-model:selection="selectedSectionModel"
                            :value="placedSectionRows"
                            selectionMode="single"
                            stripedRows
                            class="p-datatable-sm"
                            dataKey="sectionId"
                            scrollable
                            scrollHeight="flex"
                        >
                            <Column field="course_name" header="Course" sortable class="font-bold text-sm"></Column>
                            <Column field="teacher_name" header="Teacher" sortable class="text-xs"></Column>
                            <Column field="diagnosticCount" header="Alerts" sortable style="width: 4.5rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.diagnosticCount" :severity="slotProps.data.diagnosticCount > 0 ? 'warning' : 'secondary'"></Badge>
                                </template>
                            </Column>
                            <Column field="traceCount" header="Trace" sortable style="width: 3rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.traceCount" severity="info"></Badge>
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
                <p class="font-medium text-lg">Select a section to investigate diagnostics and trace decisions.</p>
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

                <div v-if="!hasDiagnostics" class="p-12 text-center bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <i class="pi pi-exclamation-triangle text-5xl text-amber-500 mb-4"></i>
                    <p class="text-amber-700 dark:text-amber-400 font-bold text-lg mb-2">No Placement Diagnostics Available</p>
                    <p class="text-amber-600/70 dark:text-amber-500/70 text-sm">The scheduler diagnostics are generated when you run the placement simulation.</p>
                </div>

                <div v-else-if="currentSectionDiagnostics.length === 0" class="p-12 text-center bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <i class="pi pi-check-circle text-5xl text-emerald-500 mb-4"></i>
                    <p class="text-emerald-700 dark:text-emerald-400 font-bold text-lg mb-2">No Diagnostics Recorded</p>
                    <p class="text-emerald-600/70 dark:text-emerald-500/70 text-sm">No diagnostics were attached to this section.</p>
                </div>

                <Tabs v-model:value="activeSectionDiagnosticTabModel" class="min-h-0 flex-1 flex flex-col">
                    <TabList>
                        <Tab value="0">
                            {{ actionableTabLabel }}
                            <Badge class="ml-2" :value="currentSectionFailures.length" :severity="currentSectionFailures.length > 0 ? 'danger' : 'secondary'" />
                        </Tab>
                        <Tab value="1">
                            Decision / Trace
                            <Badge class="ml-2" :value="currentSectionDecisionDiagnostics.length" severity="info" />
                        </Tab>
                    </TabList>
                    <TabPanels class="min-h-0 flex-1 overflow-hidden">
                        <TabPanel value="0" class="h-full min-h-0 overflow-hidden !p-0">
                            <div class="h-full min-h-0 space-y-4 overflow-y-auto pr-2">
                                <div class="flex items-center gap-2 px-2 text-red-500">
                                    <i class="pi pi-exclamation-circle font-black"></i>
                                    <span class="text-xs font-black uppercase tracking-widest">{{ actionableTabLabel }}</span>
                                </div>
                                <div v-if="currentSectionFailures.length === 0" class="p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                    {{ noActionableText }}
                                </div>
                                <div v-for="(diag, idx) in currentSectionFailures" :key="`fail-${idx}`" class="space-y-2 p-5 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/5 items-start transition-all hover:border-red-200 dark:hover:border-red-800">
                                    <div class="mt-1">
                                        <i class="pi pi-times-circle text-red-500 text-lg"></i>
                                    </div>
                                    <div class="text-sm font-bold text-red-700 dark:text-red-400 leading-relaxed">
                                        {{ diag.code }}: {{ diag.message }}
                                    </div>
                                    <div class="text-xs text-red-700/80 dark:text-red-400/80 font-semibold">
                                        Severity: {{ diag.severity }}
                                    </div>
                                    <div v-if="diag.targetEntityId != null" class="text-xs text-red-700/80 dark:text-red-400/80 space-y-0.5">
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold">Target:</span>
                                            <span>{{ resolveIdName(diag.targetEntityId) }}</span>
                                            <CopyButton
                                                v-if="showIds"
                                                :value="diag.targetEntityId"
                                                label="Target ID"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabPanel>
                        <TabPanel value="1" class="h-full min-h-0 overflow-hidden !p-0">
                            <div class="h-full min-h-0 space-y-4 overflow-y-auto pr-2">
                                <div class="flex items-center gap-2 px-2 text-blue-500">
                                    <i class="pi pi-chart-line font-black"></i>
                                    <span class="text-xs font-black uppercase tracking-widest">Decision / Trace Diagnostics</span>
                                </div>
                                <div v-if="currentSectionDecisionDiagnostics.length === 0" class="p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                                    No decision diagnostics for this section.
                                </div>
                                <div v-for="(diag, idx) in currentSectionDecisionDiagnostics" :key="`decision-${idx}`" class="space-y-2 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/5 items-start transition-all hover:border-blue-200 dark:hover:border-blue-800">
                                    <div class="text-sm font-bold text-blue-700 dark:text-blue-300 leading-relaxed">
                                        {{ diag.code }}: {{ diag.message }}
                                    </div>
                                    <div class="text-xs text-blue-700/80 dark:text-blue-300/80 font-semibold">
                                        Severity: {{ diag.severity }}
                                    </div>
                                    <div v-if="diag.metrics && Object.keys(diag.metrics).length > 0" class="text-xs text-blue-700/80 dark:text-blue-300/80">
                                        <div class="font-bold mb-1">Metrics</div>
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                            <div v-for="([k, v], metricIdx) in Object.entries(diag.metrics)" :key="`${idx}-${metricIdx}`">
                                                {{ k }}: {{ v }}
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="diag.conflictingIds?.length" class="text-xs text-blue-700/80 dark:text-blue-300/80">
                                        <div class="font-bold mb-1">References</div>
                                        <div class="space-y-2">
                                            <div
                                                v-for="(refId, refIdx) in diag.conflictingIds"
                                                :key="`${idx}-ref-${refIdx}`"
                                                class="rounded border border-blue-200/60 dark:border-blue-800/50 px-2 py-1"
                                            >
                                                <div class="flex items-center gap-2">
                                                    <span class="font-bold">Name:</span>
                                                    <span>{{ resolveIdName(refId, 'period') }}</span>
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
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </div>
        </div>
    </div>
</template>
