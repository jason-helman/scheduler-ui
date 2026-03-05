<script setup>
import { computed, ref, watch } from 'vue'
import { store } from '../store'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Badge from 'primevue/badge'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { CopyButton } from './common'

const selectedUnplacedSection = ref(null)
const activeDiagnosticsTab = ref('0')
const activeSectionDiagnosticTab = ref('0')
const DECISION_CODES = new Set([
    'DECISION_SUMMARY',
    'CANDIDATE_REJECTED_FILTER',
    'CANDIDATE_SELECTED',
    'SECTION_FINAL_PLACEMENT'
])

const isActionableSeverity = (severity) => ['fatal', 'skip', 'blocking', 'preserved_conflict'].includes(severity)

const flattenDiagnostics = () => {
    if (!store.diagnostics) return []
    return [
        ...(store.diagnostics.validation || []).map(d => ({ ...d, scope: 'validation' })),
        ...(store.diagnostics.sectionPlacement || []).map(d => ({ ...d, scope: 'sectionPlacement' })),
        ...(store.diagnostics.studentPlacement || []).map(d => ({ ...d, scope: 'studentPlacement' }))
    ]
}

const unplacedSections = computed(() => {
    if (!store.localDataset) return []
    return (store.localDataset.sections || [])
        .filter(s => !s.coursePeriodIds || s.coursePeriodIds.length === 0)
        .map(s => {
            const sectionDiagnostics = (store.diagnostics?.sectionPlacement || []).filter(
                d => d.entityId === s.sectionId &&
                    d.entityType === 'section' &&
                    isActionableSeverity(d.severity)
            )
            return {
                ...s,
                diagnosticCount: sectionDiagnostics.length
            };
        })
})

const currentSectionDiagnostics = computed(() => {
    if (!selectedUnplacedSection.value || !store.diagnostics) return []
    return (store.diagnostics.sectionPlacement || [])
        .filter(d => d.entityId === selectedUnplacedSection.value.sectionId && d.entityType === 'section')
})

const currentSectionFailures = computed(() =>
    currentSectionDiagnostics.value.filter(d => isActionableSeverity(d.severity))
)

const currentSectionDecisionDiagnostics = computed(() =>
    currentSectionDiagnostics.value.filter(d => d.severity === 'non_blocking' || DECISION_CODES.has(d.code))
)

const allDiagnostics = computed(() => flattenDiagnostics())

const systemAndDecisionDiagnostics = computed(() =>
    allDiagnostics.value.filter(d => d.entityType === 'system' || DECISION_CODES.has(d.code))
)

// Sync selected section from store if it changes (external navigation)
watch([() => store.selectedSectionId, unplacedSections], ([newId, sections]) => {
    if (newId && sections.length > 0) {
        const found = sections.find(s => s.sectionId === newId)
        if (found && selectedUnplacedSection.value?.sectionId !== newId) {
            selectedUnplacedSection.value = found
        }
    }
}, { immediate: true })

// Also sync internal selection back to store to keep them in sync
watch(selectedUnplacedSection, (newSection) => {
    if (newSection && store.selectedSectionId !== newSection.sectionId) {
        store.selectedSectionId = newSection.sectionId
    }
    activeSectionDiagnosticTab.value = '0'
})
</script>

<template>
    <div class="space-y-8">
        <div class="flex items-center justify-between mb-2">
            <h2 class="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Placement Diagnostics</h2>
            <div v-if="store.selectedVersion" class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                {{ store.selectedVersion.schedule_name }}
            </div>
        </div>

        <div v-if="!store.localDataset" class="py-20 text-center bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <i class="pi pi-search text-5xl text-gray-200 dark:text-gray-700 mb-4"></i>
            <p class="text-gray-400 dark:text-gray-500 font-medium">Load a schedule version to view diagnostics.</p>
        </div>

        <div v-else class="animate-in fade-in duration-500">
            <Tabs v-model:value="activeDiagnosticsTab">
                <TabList>
                    <Tab value="0">
                        Unplaced Sections
                        <Badge class="ml-2" :value="unplacedSections.length" severity="secondary" />
                    </Tab>
                    <Tab value="1">
                        System & Decision
                        <Badge class="ml-2" :value="systemAndDecisionDiagnostics.length" severity="info" />
                    </Tab>
                </TabList>
                <TabPanels>
                    <TabPanel value="0">
                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div class="lg:col-span-1 card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                                <div class="flex items-center justify-between mb-6 px-2">
                                    <h3 class="text-xl font-black">Unplaced Sections</h3>
                                    <Badge :value="unplacedSections.length" severity="secondary"></Badge>
                                </div>
                                <DataTable 
                                    v-model:selection="selectedUnplacedSection" 
                                    :value="unplacedSections" 
                                    selectionMode="single" 
                                    stripedRows 
                                    paginator 
                                    :rows="15" 
                                    class="p-datatable-sm"
                                    dataKey="sectionId"
                                    scrollable
                                    scrollHeight="calc(100vh - 350px)"
                                >
                                    <Column field="course_name" header="Course" sortable class="font-bold text-sm"></Column>
                                    <Column field="teacher_name" header="Teacher" sortable class="text-xs"></Column>
                                    <Column field="diagnosticCount" header="Issues" sortable style="width: 3rem">
                                        <template #body="slotProps">
                                            <Badge :value="slotProps.data.diagnosticCount" :severity="slotProps.data.diagnosticCount > 0 ? 'danger' : 'secondary'"></Badge>
                                        </template>
                                    </Column>
                                </DataTable>
                            </div>
                            
                            <div class="lg:col-span-2 card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                                <h3 class="text-xl font-black mb-6 px-2">Diagnostic Report</h3>
                                
                                <div v-if="!selectedUnplacedSection" class="flex flex-col items-center justify-center py-40 text-gray-400">
                                    <i class="pi pi-search text-6xl mb-4 opacity-20"></i>
                                    <p class="font-medium text-lg">Select an unplaced section to investigate conflicts.</p>
                                </div>
                                
                                <div v-else class="space-y-6">
                                    <div class="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                                        <div class="flex flex-col gap-1">
                                            <div class="flex items-center gap-3">
                                                <h4 class="text-2xl font-black text-gray-900 dark:text-white">{{ selectedUnplacedSection.course_name }}</h4>
                                                <div class="flex gap-2">
                                                    <Tag v-if="selectedUnplacedSection.isLab" severity="success" value="Lab" />
                                                    <Tag v-if="selectedUnplacedSection.isInclusion" severity="warning" value="Inclusion" />
                                                </div>
                                            </div>
                                            <p class="text-gray-500 font-bold flex items-center gap-2">
                                                <i class="pi pi-user text-xs"></i>
                                                {{ selectedUnplacedSection.teacher_name }}
                                            </p>
                                        </div>
                                        <div class="flex flex-col items-end gap-2">
                                            <CopyButton :value="selectedUnplacedSection.sectionId" label="Section ID" />
                                            <div class="text-[10px] font-black uppercase text-gray-400">Section ID</div>
                                        </div>
                                    </div>

                                    <div v-if="!store.diagnostics" class="p-12 text-center bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                                        <i class="pi pi-exclamation-triangle text-5xl text-amber-500 mb-4"></i>
                                        <p class="text-amber-700 dark:text-amber-400 font-bold text-lg mb-2">No Placement Diagnostics Available</p>
                                        <p class="text-amber-600/70 dark:text-amber-500/70 text-sm">The scheduler diagnostics are generated when you run the placement simulation.</p>
                                    </div>

                                    <div v-else-if="currentSectionDiagnostics.length === 0" class="p-12 text-center bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                        <i class="pi pi-check-circle text-5xl text-emerald-500 mb-4"></i>
                                        <p class="text-emerald-700 dark:text-emerald-400 font-bold text-lg mb-2">No Diagnostics Recorded</p>
                                        <p class="text-emerald-600/70 dark:text-emerald-500/70 text-sm">No diagnostics were attached to this section.</p>
                                    </div>

                                    <Tabs v-model:value="activeSectionDiagnosticTab">
                                        <TabList>
                                            <Tab value="0">
                                                Failures
                                                <Badge class="ml-2" :value="currentSectionFailures.length" :severity="currentSectionFailures.length > 0 ? 'danger' : 'secondary'" />
                                            </Tab>
                                            <Tab value="1">
                                                Decision / Trace
                                                <Badge class="ml-2" :value="currentSectionDecisionDiagnostics.length" severity="info" />
                                            </Tab>
                                        </TabList>
                                        <TabPanels>
                                            <TabPanel value="0">
                                                <div class="space-y-4 max-h-[520px] overflow-y-auto pr-2">
                                                    <div class="flex items-center gap-2 px-2 text-red-500">
                                                        <i class="pi pi-exclamation-circle font-black"></i>
                                                        <span class="text-xs font-black uppercase tracking-widest">Failures</span>
                                                    </div>
                                                    <div v-if="currentSectionFailures.length === 0" class="p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                                        No actionable failures for this section.
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
                                                        <div v-if="diag.targetEntityId != null" class="text-xs text-red-700/80 dark:text-red-400/80">
                                                            Target ID: {{ diag.targetEntityId }}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TabPanel>
                                            <TabPanel value="1">
                                                <div class="space-y-4 max-h-[520px] overflow-y-auto pr-2">
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
                                                            IDs: {{ diag.conflictingIds.join(', ') }}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TabPanel>
                                        </TabPanels>
                                    </Tabs>
                                </div>
                            </div>
                        </div>
                    </TabPanel>

                    <TabPanel value="1">
                        <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                            <div class="flex items-center justify-between mb-6 px-2">
                                <h3 class="text-xl font-black">System & Decision Diagnostics</h3>
                                <Badge :value="systemAndDecisionDiagnostics.length" severity="info" />
                            </div>
                            <DataTable
                                :value="systemAndDecisionDiagnostics"
                                stripedRows
                                paginator
                                :rows="10"
                                class="p-datatable-sm"
                                scrollable
                                scrollHeight="360px"
                            >
                                <Column field="scope" header="Scope" sortable style="width: 9rem" />
                                <Column field="entityType" header="Type" sortable style="width: 8rem" />
                                <Column field="entityId" header="Entity ID" sortable style="width: 8rem" />
                                <Column field="code" header="Code" sortable style="width: 14rem" />
                                <Column field="message" header="Message" />
                                <Column header="Metrics" style="width: 20rem">
                                    <template #body="slotProps">
                                        <div v-if="slotProps.data.metrics && Object.keys(slotProps.data.metrics).length > 0" class="text-xs text-gray-700 dark:text-gray-300">
                                            <div v-for="([k, v], idx) in Object.entries(slotProps.data.metrics)" :key="idx">{{ k }}: {{ v }}</div>
                                        </div>
                                        <span v-else class="text-xs text-gray-400">-</span>
                                    </template>
                                </Column>
                            </DataTable>
                        </div>
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </div>
    </div>
</template>
