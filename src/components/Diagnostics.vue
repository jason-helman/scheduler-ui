<script setup>
import { computed, ref, watch } from 'vue'
import { store } from '../store'
import { useDerivedSchedulerData } from '../composables/useDerivedSchedulerData'
import Badge from 'primevue/badge'
import Card from 'primevue/card'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import DiagnosticsSummaryCards from './diagnostics/DiagnosticsSummaryCards.vue'
import SectionDiagnosticsPanel from './diagnostics/SectionDiagnosticsPanel.vue'
import SystemDecisionPanel from './diagnostics/SystemDecisionPanel.vue'
import PeriodOpportunityPanel from './diagnostics/PeriodOpportunityPanel.vue'
import ValidationPanel from './diagnostics/ValidationPanel.vue'

const selectedSection = ref(null)
const activeDiagnosticsTab = ref('0')
const activeSectionListTab = ref('0')
const activeSectionDiagnosticTab = ref('0')
const sectionScrollRequestKey = ref(0)
const suppressScrollRequestFromLocalSelection = ref(false)

const {
    validationDiagnostics,
    sectionDiagnosticsIndex,
    sectionRows,
    unplacedSectionRows,
    placedSectionRows,
    invalidSectionRows,
    systemAndDecisionDiagnostics,
    validationIssueCount,
    hasAnyDiagnostics,
    systemMetrics,
    periodOpportunitySummary,
    periodOpportunityRows,
    teacherBreakSummary,
    teacherBreakRows,
    resolveIdName,
    getDiagnosticScope,
    isActionableSeverity,
    decisionCodes
} = useDerivedSchedulerData()

const currentSectionDiagnostics = computed(() => {
    if (!selectedSection.value || !store.localDataset?.diagnostics) return []
    return sectionDiagnosticsIndex.value.bySectionId.get(String(selectedSection.value.sectionId)) || []
})

const currentSectionFailures = computed(() =>
    currentSectionDiagnostics.value.filter((d) => isActionableSeverity(d.severity))
)

const currentSectionDecisionDiagnostics = computed(() => {
    const decisionDiagnostics = currentSectionDiagnostics.value.filter(
        (d) => d.severity === 'non_blocking' || decisionCodes.has(d.code)
    )
    if (decisionDiagnostics.length > 0) return decisionDiagnostics
    return currentSectionDiagnostics.value
})

const actionableTabLabel = computed(() => (selectedSection.value?.isPlaced ? 'Alerts' : 'Failures'))
const noActionableText = computed(() =>
    selectedSection.value?.isPlaced
        ? 'No alerts for this section.'
        : 'No actionable failures for this section.'
)

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

watch([() => store.selectedSectionId, sectionRows, () => store.diagnosticsExternalScrollKey], ([newId, sections, externalScrollKey], oldState) => {
    const prevExternalScrollKey = oldState?.[2]
    const isExternalScrollRequest = prevExternalScrollKey != null && externalScrollKey !== prevExternalScrollKey
    if (newId != null && sections.length > 0) {
        const found = sections.find((s) => idsEqual(s.sectionId, newId))
        if (found) {
            activeSectionListTab.value = found.isInvalid ? '2' : (found.isPlaced ? '1' : '0')
            consumeTargetSectionTab()
        }
        if (found) {
            const isLocalSelectionEcho = suppressScrollRequestFromLocalSelection.value && idsEqual(selectedSection.value?.sectionId, newId) && !isExternalScrollRequest

            if (!idsEqual(selectedSection.value?.sectionId, newId)) {
                selectedSection.value = found
            }

            if (suppressScrollRequestFromLocalSelection.value && idsEqual(selectedSection.value?.sectionId, newId)) {
                suppressScrollRequestFromLocalSelection.value = false
            }

            if (!isLocalSelectionEcho || isExternalScrollRequest) {
                sectionScrollRequestKey.value += 1
            }
        }
    }
}, { immediate: true })

watch(selectedSection, (newSection, oldSection) => {
    if (newSection && !idsEqual(store.selectedSectionId, newSection.sectionId)) {
        suppressScrollRequestFromLocalSelection.value = true
        store.selectedSectionId = newSection.sectionId
    }
    if (newSection) {
        activeSectionListTab.value = newSection.isInvalid ? '2' : (newSection.isPlaced ? '1' : '0')
    }
    const sectionChanged = !idsEqual(newSection?.sectionId, oldSection?.sectionId)
    if (sectionChanged) {
        consumeTargetSectionTab()
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
            <DiagnosticsSummaryCards v-if="hasAnyDiagnostics" :system-metrics="systemMetrics" />
            <Card v-else class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800 mb-6 shrink-0">
                <template #content>
                    <div class="p-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                        There are currently no diagnostics to show.
                    </div>
                </template>
            </Card>

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
                            Period Opportunity
                            <Badge class="ml-2" :value="periodOpportunityRows.length" severity="info" />
                        </Tab>
                        <Tab value="3">
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
                                :invalid-section-rows="invalidSectionRows"
                                :selected-section="selectedSection"
                                :has-diagnostics="Boolean(store.localDataset?.diagnostics)"
                                :current-section-diagnostics="currentSectionDiagnostics"
                                :current-section-failures="currentSectionFailures"
                                :current-section-decision-diagnostics="currentSectionDecisionDiagnostics"
                                :actionable-tab-label="actionableTabLabel"
                                :no-actionable-text="noActionableText"
                                :show-ids="store.showIds"
                                :resolve-id-name="resolveIdName"
                                :active-section-list-tab="activeSectionListTab"
                                :active-section-diagnostic-tab="activeSectionDiagnosticTab"
                                :scroll-to-section-id="selectedSection?.sectionId ?? null"
                                :scroll-request-key="sectionScrollRequestKey"
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
                            <PeriodOpportunityPanel
                                :rows="periodOpportunityRows"
                                :summary="periodOpportunitySummary"
                                :teacher-break-rows="teacherBreakRows"
                                :teacher-break-summary="teacherBreakSummary"
                            />
                        </TabPanel>

                        <TabPanel value="3" class="h-full min-h-0 overflow-hidden !p-0">
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
