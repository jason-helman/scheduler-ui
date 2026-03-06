<script setup>
import { computed, ref, shallowRef, watch } from 'vue'
import { store } from '../store'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Badge from 'primevue/badge'
import Card from 'primevue/card'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { CopyButton } from './common'

const selectedSection = ref(null)
const activeDiagnosticsTab = ref('0')
const activeSectionListTab = ref('0')
const activeSectionDiagnosticTab = ref('0')
const DECISION_CODES = new Set([
    'DECISION_SUMMARY',
    'CANDIDATE_REJECTED_FILTER',
    'CANDIDATE_SELECTED',
    'SECTION_FINAL_PLACEMENT'
])

const isActionableSeverity = (severity) => ['fatal', 'skip', 'blocking', 'preserved_conflict'].includes(severity)
const isValidationIssueSeverity = (severity) => ['fatal', 'skip', 'blocking'].includes(severity)

const sectionPlacementDiagnostics = computed(() => store.diagnostics?.sectionPlacement || [])
const validationDiagnostics = computed(() => store.diagnostics?.validation || [])
const studentPlacementDiagnostics = computed(() => store.diagnostics?.studentPlacement || [])

const sectionDiagnosticsIndex = computed(() => {
    const bySectionId = new Map()
    const countsBySectionId = new Map()

    sectionPlacementDiagnostics.value.forEach((d) => {
        if (d.entityType !== 'section') return
        const key = String(d.entityId)

        if (!bySectionId.has(key)) bySectionId.set(key, [])
        bySectionId.get(key).push(d)

        if (!countsBySectionId.has(key)) {
            countsBySectionId.set(key, { actionable: 0, trace: 0 })
        }
        const counts = countsBySectionId.get(key)
        if (isActionableSeverity(d.severity)) counts.actionable += 1
        if (d.severity === 'non_blocking' || DECISION_CODES.has(d.code)) counts.trace += 1
    })

    return { bySectionId, countsBySectionId }
})

const sectionRows = computed(() => {
    if (!store.localDataset) return []
    return (store.localDataset.sections || [])
        .map(s => {
            const counts = sectionDiagnosticsIndex.value.countsBySectionId.get(String(s.sectionId)) || {
                actionable: 0,
                trace: 0
            }
            const isPlaced = !!(s.coursePeriodIds && s.coursePeriodIds.length > 0)
            return {
                ...s,
                isPlaced,
                diagnosticCount: counts.actionable,
                traceCount: counts.trace
            };
        })
        .sort((a, b) => {
            if (a.isPlaced !== b.isPlaced) return a.isPlaced ? 1 : -1
            const diagDelta = (b.traceCount + b.diagnosticCount) - (a.traceCount + a.diagnosticCount)
            if (diagDelta !== 0) return diagDelta
            return String(a.course_name || '').localeCompare(String(b.course_name || ''))
        })
})

const unplacedSectionRows = computed(() => sectionRows.value.filter(s => !s.isPlaced))
const placedSectionRows = computed(() => sectionRows.value.filter(s => s.isPlaced))

const currentSectionDiagnostics = computed(() => {
    if (!selectedSection.value || !store.diagnostics) return []
    return sectionDiagnosticsIndex.value.bySectionId.get(String(selectedSection.value.sectionId)) || []
})

const currentSectionFailures = computed(() =>
    currentSectionDiagnostics.value.filter(d => isActionableSeverity(d.severity))
)

const currentSectionDecisionDiagnostics = computed(() =>
    currentSectionDiagnostics.value.filter(d => d.severity === 'non_blocking' || DECISION_CODES.has(d.code))
)
const actionableTabLabel = computed(() => (selectedSection.value?.isPlaced ? 'Alerts' : 'Failures'))
const noActionableText = computed(() =>
    selectedSection.value?.isPlaced
        ? 'No alerts for this section.'
        : 'No actionable failures for this section.'
)

const allDiagnostics = computed(() => {
    if (!store.diagnostics) return []
    return [
        ...validationDiagnostics.value,
        ...sectionPlacementDiagnostics.value,
        ...studentPlacementDiagnostics.value
    ]
})

const systemAndDecisionDiagnostics = computed(() =>
    allDiagnostics.value.filter(d => d.entityType === 'system' || DECISION_CODES.has(d.code))
)
const validationIssueCount = computed(() =>
    validationDiagnostics.value.filter((d) => isValidationIssueSeverity(d.severity)).length
)

const diagnosticScopeIndex = shallowRef(new WeakMap())

watch([validationDiagnostics, sectionPlacementDiagnostics, studentPlacementDiagnostics], ([validation, sectionPlacement, studentPlacement]) => {
    const scopeIndex = new WeakMap()
    validation.forEach((d) => scopeIndex.set(d, 'validation'))
    sectionPlacement.forEach((d) => scopeIndex.set(d, 'sectionPlacement'))
    studentPlacement.forEach((d) => scopeIndex.set(d, 'studentPlacement'))
    diagnosticScopeIndex.value = scopeIndex
}, { immediate: true })

const getDiagnosticScope = (diagnostic) => diagnosticScopeIndex.value.get(diagnostic) || '-'

const systemMetrics = computed(() => {
    const metrics = {}
    const systemRows = sectionPlacementDiagnostics.value.filter(
        d => d.entityType === 'system' && d.metrics
    )
    systemRows.forEach((row) => {
        Object.entries(row.metrics || {}).forEach(([k, v]) => {
            metrics[k] = v
        })
    })
    return metrics
})

const createEmptyReferenceIndex = () => ({
    index: new Map(),
    typed: {
        course: new Map(),
        teacher: new Map(),
        classroom: new Map(),
        student: new Map(),
        section: new Map(),
        period: new Map(),
        group: new Map(),
        lunch: new Map()
    }
})

const idReferenceIndex = shallowRef(createEmptyReferenceIndex())

const buildIdReferenceIndex = (dataset) => {
    const refIndex = createEmptyReferenceIndex()
    const { index, typed } = refIndex
    const add = (id, label, type) => {
        if (id == null || !label) return
        const key = String(id)
        if (!index.has(key)) index.set(key, [])
        const values = index.get(key)
        if (!values.includes(label)) values.push(label)
        if (type && typed[type]) {
            typed[type].set(key, label)
        }
    }

    if (!dataset) return refIndex

    ;(dataset.courses || []).forEach((c) => {
        add(c.courseId, `Course: ${c.course_name || c.name || c.courseId}`, 'course')
    })
    ;(dataset.teachers || []).forEach((t) => {
        add(t.teacherId, `Teacher: ${t.teacher_name || t.name || t.teacherId}`, 'teacher')
    })
    ;(dataset.classrooms || []).forEach((r) => {
        add(r.classroomId, `Room: ${r.room_name || r.classroom_name || r.name || r.classroomId}`, 'classroom')
    })
    ;(dataset.students || []).forEach((s) => {
        add(s.studentId, `Student: ${s.student_name || s.name || s.studentId}`, 'student')
    })
    ;(dataset.sections || []).forEach((s) => {
        const sectionTitle = s.course_name ? `Section: ${s.course_name}` : `Section: ${s.sectionId}`
        add(s.sectionId, sectionTitle, 'section')
    })
    ;(dataset.coursePeriods || []).forEach((p) => {
        const periodName = p.name || p.period_name || `P${p.coursePeriodId}`
        add(p.coursePeriodId, `Period: ${periodName}`, 'period')
    })
    ;(dataset.scheduleStructure || []).forEach((ss) => {
        const periodName = ss.name || ss.period_name || `P${ss.coursePeriodId}`
        const timeWindow = ss.startTime && ss.endTime ? ` (${ss.startTime}-${ss.endTime})` : ''
        add(ss.coursePeriodId, `Period: ${periodName}${timeWindow}`, 'period')
    })
    ;(dataset.requestGroups || []).forEach((g) => {
        add(g.groupId, `Group: ${g.groupId}`, 'group')
    })
    ;(dataset.lunches || []).forEach((l) => {
        add(l.lunchId, `Lunch: ${l.lunchId}`, 'lunch')
    })

    return refIndex
}

watch(() => store.localDataset, (dataset) => {
    idReferenceIndex.value = buildIdReferenceIndex(dataset)
}, { immediate: true })

const resolveIdName = (id, preferredType = null) => {
    if (id == null) return '-'
    const key = String(id)
    if (preferredType && idReferenceIndex.value.typed?.[preferredType]?.has(key)) {
        return idReferenceIndex.value.typed[preferredType].get(key)
    }
    const options = idReferenceIndex.value.index.get(key) || []
    if (options.length === 0) return 'Unknown'
    if (options.length === 1) return options[0]
    return `${options[0]} (+${options.length - 1} more)`
}

const idsEqual = (a, b) => String(a) === String(b)
const consumeTargetSectionTab = () => {
    const requestedTab = store.diagnosticsTargetSectionTab
    if (requestedTab === '0' || requestedTab === '1') {
        activeSectionDiagnosticTab.value = requestedTab
        store.diagnosticsTargetSectionTab = null
        return true
    }
    return false
}

// Sync selected section from store if it changes (external navigation)
watch([() => store.selectedSectionId, sectionRows], ([newId, sections]) => {
    if (newId != null && sections.length > 0) {
        const found = sections.find(s => idsEqual(s.sectionId, newId))
        if (found) {
            activeSectionListTab.value = found.isPlaced ? '1' : '0'
            consumeTargetSectionTab()
        }
        if (found && !idsEqual(selectedSection.value?.sectionId, newId)) {
            selectedSection.value = found
        }
    }
}, { immediate: true })

// Also sync internal selection back to store to keep them in sync
watch(selectedSection, (newSection, oldSection) => {
    if (newSection && !idsEqual(store.selectedSectionId, newSection.sectionId)) {
        store.selectedSectionId = newSection.sectionId
    }
    if (newSection) {
        activeSectionListTab.value = newSection.isPlaced ? '1' : '0'
    }
    const sectionChanged = !idsEqual(newSection?.sectionId, oldSection?.sectionId)
    if (sectionChanged) {
        if (!consumeTargetSectionTab()) {
            activeSectionDiagnosticTab.value = '0'
        }
    }
})
</script>

<template>
    <div class="h-full min-h-0 flex flex-col gap-6">
        <div class="flex items-center justify-between">
            <h2 class="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Placement Diagnostics</h2>
            <div v-if="store.selectedVersion" class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                {{ store.selectedVersion.schedule_name }}
            </div>
        </div>

        <div v-if="!store.localDataset" class="flex-1 min-h-0 py-20 text-center bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <i class="pi pi-search text-5xl text-gray-200 dark:text-gray-700 mb-4"></i>
            <p class="text-gray-400 dark:text-gray-500 font-medium">Load a schedule version to view diagnostics.</p>
        </div>

        <div v-else class="flex-1 min-h-0 flex flex-col animate-in fade-in duration-500 overflow-hidden">
            <div v-if="store.diagnostics" class="shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
                    <template #content>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-black uppercase tracking-widest text-gray-400">Total Runtime</span>
                            <div class="flex items-end gap-2">
                                <span class="text-4xl font-black text-blue-600 dark:text-blue-400">{{ systemMetrics.totalRunMs ?? '-' }}</span>
                                <span class="text-xs font-bold text-gray-400 mb-1">ms</span>
                            </div>
                        </div>
                    </template>
                </Card>
                <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
                    <template #content>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-black uppercase tracking-widest text-gray-400">Tabu Search Time</span>
                            <div class="flex items-end gap-2">
                                <span class="text-4xl font-black text-purple-600 dark:text-purple-400">{{ systemMetrics.tabuSearchMs ?? '-' }}</span>
                                <span class="text-xs font-bold text-gray-400 mb-1">ms</span>
                            </div>
                        </div>
                    </template>
                </Card>
                <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
                    <template #content>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-black uppercase tracking-widest text-gray-400">Global Score Delta</span>
                            <div class="flex items-end gap-2">
                                <span
                                    class="text-4xl font-black"
                                    :class="(systemMetrics.globalScoreDelta || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
                                >
                                    {{ systemMetrics.globalScoreDelta ?? '-' }}
                                </span>
                                <span class="text-xs font-bold text-gray-400 mb-1">
                                    {{ systemMetrics.globalScoreBeforeTabu != null && systemMetrics.globalScoreAfterTabu != null ? `${systemMetrics.globalScoreBeforeTabu} → ${systemMetrics.globalScoreAfterTabu}` : '' }}
                                </span>
                            </div>
                        </div>
                    </template>
                </Card>
                <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
                    <template #content>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-black uppercase tracking-widest text-gray-400">Final Placement</span>
                            <div class="flex items-end gap-2">
                                <span class="text-4xl font-black text-gray-900 dark:text-white">{{ systemMetrics.finalPlacedCount ?? '-' }}</span>
                                <span class="text-xs font-bold text-gray-400 mb-1">
                                    {{ systemMetrics.totalSections != null ? `/ ${systemMetrics.totalSections}` : '' }}
                                </span>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>

            <div class="min-h-0 flex-1 overflow-hidden">
            <Tabs v-model:value="activeDiagnosticsTab" class="h-full min-h-0 flex flex-col">
                <TabList>
                    <Tab value="0">
                        Sections
                        <Badge class="ml-2" :value="sectionRows.length" severity="secondary" />
                    </Tab>
                    <Tab value="1">
                        System & Decision
                        <Badge class="ml-2" :value="systemAndDecisionDiagnostics.length" severity="info" />
                    </Tab>
                    <Tab value="2">
                        Validation
                        <Badge class="ml-2" :value="validationIssueCount" :severity="validationIssueCount > 0 ? 'danger' : 'secondary'" />
                    </Tab>
                </TabList>
                <TabPanels class="min-h-0 flex-1 overflow-hidden">
                    <TabPanel value="0" class="h-full min-h-0 overflow-hidden !p-0">
                        <div class="h-full min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div class="lg:col-span-1 card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col min-h-0">
                                <div class="flex items-center justify-between mb-6 px-2">
                                    <h3 class="text-xl font-black">Sections</h3>
                                    <Badge :value="sectionRows.length" severity="secondary"></Badge>
                                </div>
                                <Tabs v-model:value="activeSectionListTab" class="h-full min-h-0 flex flex-col">
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
                                                v-model:selection="selectedSection" 
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
                                                v-model:selection="selectedSection" 
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
                                
                                <div v-if="!selectedSection" class="flex-1 min-h-0 flex flex-col items-center justify-center py-10 text-gray-400">
                                    <i class="pi pi-search text-6xl mb-4 opacity-20"></i>
                                    <p class="font-medium text-lg">Select a section to investigate diagnostics and trace decisions.</p>
                                </div>
                                
                                <div v-else class="flex-1 min-h-0 flex flex-col gap-6">
                                    <div class="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                                        <div class="flex flex-col gap-1">
                                            <div class="flex items-center gap-3">
                                                <h4 class="text-2xl font-black text-gray-900 dark:text-white">{{ selectedSection.course_name }}</h4>
                                                <div class="flex gap-2">
                                                    <Tag :value="selectedSection.isPlaced ? 'Placed' : 'Unplaced'" :severity="selectedSection.isPlaced ? 'success' : 'warn'" />
                                                    <Tag v-if="selectedSection.isLab" severity="success" value="Lab" />
                                                    <Tag v-if="selectedSection.isInclusion" severity="warning" value="Inclusion" />
                                                </div>
                                            </div>
                                            <p class="text-gray-500 font-bold flex items-center gap-2">
                                                <i class="pi pi-user text-xs"></i>
                                                {{ selectedSection.teacher_name }}
                                            </p>
                                        </div>
                                        <div v-if="store.showIds" class="flex flex-col items-end gap-2">
                                            <CopyButton :value="selectedSection.sectionId" label="Section ID" />
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

                                    <Tabs v-model:value="activeSectionDiagnosticTab" class="min-h-0 flex-1 flex flex-col">
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
                                                                    v-if="store.showIds"
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
                                                                            v-if="store.showIds"
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
                    </TabPanel>

                    <TabPanel value="1" class="h-full min-h-0 overflow-hidden !p-0">
                        <div class="h-full min-h-0 space-y-6">
                            <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col min-h-0">
                            <div class="flex items-center justify-between mb-6 px-2">
                                <h3 class="text-xl font-black">System & Decision Diagnostics</h3>
                                <Badge :value="systemAndDecisionDiagnostics.length" severity="info" />
                            </div>
                            <DataTable
                                :value="systemAndDecisionDiagnostics"
                                stripedRows
                                class="p-datatable-sm"
                                scrollable
                                scrollHeight="flex"
                            >
                                <Column header="Scope" style="width: 9rem">
                                    <template #body="slotProps">
                                        {{ getDiagnosticScope(slotProps.data) }}
                                    </template>
                                </Column>
                                <Column field="entityType" header="Type" sortable style="width: 8rem" />
                                <Column field="entityId" header="Entity" sortable style="width: 16rem">
                                    <template #body="slotProps">
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs">{{ resolveIdName(slotProps.data.entityId) }}</span>
                                            <CopyButton
                                                v-if="store.showIds && slotProps.data.entityId != null"
                                                :value="slotProps.data.entityId"
                                                label="Entity ID"
                                            />
                                        </div>
                                    </template>
                                </Column>
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
                        </div>
                    </TabPanel>

                    <TabPanel value="2" class="h-full min-h-0 overflow-hidden !p-0">
                        <div class="h-full min-h-0 space-y-6">
                            <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col min-h-0">
                                <div class="flex items-center justify-between mb-6 px-2">
                                    <h3 class="text-xl font-black">Validation Diagnostics</h3>
                                    <Badge :value="validationDiagnostics.length" :severity="validationIssueCount > 0 ? 'danger' : 'secondary'" />
                                </div>
                                <div v-if="validationDiagnostics.length === 0" class="p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                    No validation diagnostics were reported.
                                </div>
                                <DataTable
                                    v-else
                                    :value="validationDiagnostics"
                                    stripedRows
                                    class="p-datatable-sm"
                                    scrollable
                                    scrollHeight="flex"
                                >
                                    <Column field="severity" header="Severity" sortable style="width: 8rem">
                                        <template #body="slotProps">
                                            <Tag
                                                :value="slotProps.data.severity"
                                                :severity="slotProps.data.severity === 'fatal' ? 'danger' : slotProps.data.severity === 'skip' ? 'warn' : 'secondary'"
                                            />
                                        </template>
                                    </Column>
                                    <Column field="code" header="Code" sortable style="width: 18rem" />
                                    <Column field="entityType" header="Type" sortable style="width: 8rem" />
                                    <Column field="entityId" header="Entity" sortable style="width: 16rem">
                                        <template #body="slotProps">
                                            <div class="flex items-center gap-2">
                                                <span class="text-xs">{{ resolveIdName(slotProps.data.entityId) }}</span>
                                                <CopyButton
                                                    v-if="store.showIds && slotProps.data.entityId != null"
                                                    :value="slotProps.data.entityId"
                                                    label="Entity ID"
                                                />
                                            </div>
                                        </template>
                                    </Column>
                                    <Column field="message" header="Message" />
                                </DataTable>
                            </div>
                        </div>
                    </TabPanel>
                </TabPanels>
            </Tabs>
            </div>
        </div>
    </div>
</template>
