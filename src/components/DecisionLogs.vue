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
import SectionDecisionLogsPanel from './diagnostics/SectionDecisionLogsPanel.vue'
import DecisionLogTable from './diagnostics/DecisionLogTable.vue'

const selectedSection = ref(null)
const activeDecisionTab = ref('0')
const activeSectionListTab = ref('0')
const sectionScrollRequestKey = ref(0)
const suppressScrollRequestFromLocalSelection = ref(false)

const {
    sectionRows,
    unplacedSectionRows,
    placedSectionRows,
    invalidSectionRows,
    sectionDecisionIndex,
    allDecisionLogs,
    hasAnyDecisionLogs,
    resolveIdName,
    getDecisionScope,
} = useDerivedSchedulerData()

const currentSectionDecisionLogs = computed(() => {
    if (!selectedSection.value || !store.localDataset?.observability) return []
    return sectionDecisionIndex.value.bySectionId.get(String(selectedSection.value.sectionId)) || []
})

const idsEqual = (a, b) => String(a) === String(b)

watch([() => store.selectedSectionId, sectionRows, () => store.diagnosticsExternalScrollKey], ([newId, sections, externalScrollKey], oldState) => {
    const prevExternalScrollKey = oldState?.[2]
    const isExternalScrollRequest = prevExternalScrollKey != null && externalScrollKey !== prevExternalScrollKey
    if (newId == null || sections.length === 0) return

    const found = sections.find((section) => idsEqual(section.sectionId, newId))
    if (!found) return

    activeSectionListTab.value = found.isInvalid ? '2' : (found.isPlaced ? '1' : '0')

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
}, { immediate: true })

watch(selectedSection, (newSection) => {
    if (newSection && !idsEqual(store.selectedSectionId, newSection.sectionId)) {
        suppressScrollRequestFromLocalSelection.value = true
        store.selectedSectionId = newSection.sectionId
    }
    if (newSection) {
        activeSectionListTab.value = newSection.isInvalid ? '2' : (newSection.isPlaced ? '1' : '0')
    }
})
</script>

<template>
    <div class="h-full min-h-0 flex flex-col gap-6">
        <div class="flex items-center justify-between">
            <h2 class="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Decision Logs</h2>
            <div v-if="store.selectedVersion" class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                {{ store.selectedVersion.schedule_name }}
            </div>
        </div>

        <div v-if="!store.localDataset" class="flex-1 min-h-0 py-20 text-center bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <i class="pi pi-sitemap text-5xl text-gray-200 dark:text-gray-700 mb-4"></i>
            <p class="text-gray-400 dark:text-gray-500 font-medium">Load a schedule version to view decision logs.</p>
        </div>

        <div v-else class="flex-1 min-h-0 flex flex-col animate-in fade-in duration-500 overflow-hidden">
            <Card v-if="!hasAnyDecisionLogs" class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800 mb-6 shrink-0">
                <template #content>
                    <div class="p-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                        There are currently no decision logs to show.
                    </div>
                </template>
            </Card>

            <div class="min-h-0 flex-1 overflow-hidden">
                <Tabs v-model:value="activeDecisionTab" class="h-full min-h-0 flex flex-col">
                    <TabList>
                        <Tab value="0">
                            Sections
                            <Badge class="ml-2" :value="sectionRows.length" severity="secondary" />
                        </Tab>
                        <Tab value="1">
                            All Decisions
                            <Badge class="ml-2" :value="allDecisionLogs.length" severity="info" />
                        </Tab>
                    </TabList>
                    <TabPanels class="min-h-0 flex-1 overflow-hidden">
                        <TabPanel value="0" class="h-full min-h-0 overflow-hidden !p-0">
                            <SectionDecisionLogsPanel
                                :section-rows="sectionRows"
                                :unplaced-section-rows="unplacedSectionRows"
                                :placed-section-rows="placedSectionRows"
                                :invalid-section-rows="invalidSectionRows"
                                :selected-section="selectedSection"
                                :has-decision-logs="Boolean(store.localDataset?.observability)"
                                :current-section-decision-logs="currentSectionDecisionLogs"
                                :show-ids="store.showIds"
                                :resolve-id-name="resolveIdName"
                                :active-section-list-tab="activeSectionListTab"
                                :scroll-to-section-id="selectedSection?.sectionId ?? null"
                                :scroll-request-key="sectionScrollRequestKey"
                                @update:selectedSection="selectedSection = $event"
                                @update:activeSectionListTab="activeSectionListTab = $event"
                            />
                        </TabPanel>

                        <TabPanel value="1" class="h-full min-h-0 overflow-hidden !p-0">
                            <DecisionLogTable
                                :decision-logs="allDecisionLogs"
                                :show-ids="store.showIds"
                                :resolve-id-name="resolveIdName"
                                :get-decision-scope="getDecisionScope"
                            />
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </div>
        </div>
    </div>
</template>
