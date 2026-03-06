<script setup>
import { computed, ref, shallowRef, watch } from 'vue'
import { store } from '../store'
import Badge from 'primevue/badge'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import DiagnosticsSummaryCards from './diagnostics/DiagnosticsSummaryCards.vue'
import SectionDiagnosticsPanel from './diagnostics/SectionDiagnosticsPanel.vue'
import SystemDecisionPanel from './diagnostics/SystemDecisionPanel.vue'
import ValidationPanel from './diagnostics/ValidationPanel.vue'

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
            }
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
            <DiagnosticsSummaryCards v-if="store.diagnostics" :system-metrics="systemMetrics" />

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
                            <SectionDiagnosticsPanel
                                :section-rows="sectionRows"
                                :unplaced-section-rows="unplacedSectionRows"
                                :placed-section-rows="placedSectionRows"
                                :selected-section="selectedSection"
                                :has-diagnostics="Boolean(store.diagnostics)"
                                :current-section-diagnostics="currentSectionDiagnostics"
                                :current-section-failures="currentSectionFailures"
                                :current-section-decision-diagnostics="currentSectionDecisionDiagnostics"
                                :actionable-tab-label="actionableTabLabel"
                                :no-actionable-text="noActionableText"
                                :show-ids="store.showIds"
                                :resolve-id-name="resolveIdName"
                                :active-section-list-tab="activeSectionListTab"
                                :active-section-diagnostic-tab="activeSectionDiagnosticTab"
                                @update:selectedSection="selectedSection = $event"
                                @update:activeSectionListTab="activeSectionListTab = $event"
                                @update:activeSectionDiagnosticTab="activeSectionDiagnosticTab = $event"
                            />
                        </TabPanel>

                        <TabPanel value="1" class="h-full min-h-0 overflow-hidden !p-0">
                            <SystemDecisionPanel
                                :diagnostics="systemAndDecisionDiagnostics"
                                :show-ids="store.showIds"
                                :resolve-id-name="resolveIdName"
                                :get-diagnostic-scope="getDiagnosticScope"
                            />
                        </TabPanel>

                        <TabPanel value="2" class="h-full min-h-0 overflow-hidden !p-0">
                            <ValidationPanel
                                :validation-diagnostics="validationDiagnostics"
                                :validation-issue-count="validationIssueCount"
                                :show-ids="store.showIds"
                                :resolve-id-name="resolveIdName"
                            />
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </div>
        </div>
    </div>
</template>
