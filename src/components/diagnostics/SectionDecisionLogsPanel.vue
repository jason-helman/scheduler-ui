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
    decisionLogOwner: {
        type: Object,
        default: null
    },
    hasDecisionLogs: {
        type: Boolean,
        default: false
    },
    currentSectionDecisionLogs: {
        type: Array,
        required: true
    },
    parentDecisionCount: {
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

const isInheritedDecisionView = computed(() =>
    Boolean(
        selectedSectionModel.value?.parentSectionId != null &&
        props.decisionLogOwner &&
        String(props.decisionLogOwner.sectionId) !== String(selectedSectionModel.value.sectionId),
    ),
)

const compareDecisionRecords = (left, right) => {
    const leftTime = Number(left?.timestampMs)
    const rightTime = Number(right?.timestampMs)
    const leftHasTime = Number.isFinite(leftTime)
    const rightHasTime = Number.isFinite(rightTime)

    if (leftHasTime && rightHasTime && leftTime !== rightTime) return leftTime - rightTime
    if (leftHasTime !== rightHasTime) return leftHasTime ? -1 : 1

    const leftStep = String(left?.execution?.step || '')
    const rightStep = String(right?.execution?.step || '')
    const stepDelta = leftStep.localeCompare(rightStep)
    if (stepDelta !== 0) return stepDelta

    return String(left?.code || '').localeCompare(String(right?.code || ''))
}

const humanizeToken = (value) => String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

const formatDecisionCode = (code) => {
    const value = String(code || '')
    if (!value) return 'Decision'

    const lastToken = value.split('.').pop()
    return humanizeToken(lastToken)
}

const primeSeverityForLevel = (level) => {
    const normalized = String(level || 'info').toLowerCase()
    if (normalized === 'error') return 'danger'
    if (normalized === 'warn' || normalized === 'warning') return 'warn'
    if (normalized === 'debug') return 'secondary'
    if (normalized === 'success') return 'success'
    return 'info'
}

const isTabuMoveSelected = (decision) => decision?.code === 'section.decision.strategy.tabu_move_selected'
const isTabuMoveRejected = (decision) => decision?.code === 'section.decision.strategy.tabu_move_rejected'
const isTabuFinalSummary = (decision) => decision?.code === 'section.decision.strategy.tabu_transition'

const resolveAffectedSections = (decision) => {
    const contextIds = Array.isArray(decision?.context?.affectedSectionIds)
        ? decision.context.affectedSectionIds
        : []
    const relatedIds = Array.isArray(decision?.related)
        ? decision.related
            .filter((ref) => String(ref?.entityType || '').toLowerCase() === 'section')
            .map((ref) => ref?.entityId)
        : []

    return Array.from(new Set([...contextIds, ...relatedIds].filter((id) => id != null)))
}

const formatAffectedSections = (decision) => {
    const labels = resolveAffectedSections(decision)
        .map((id) => props.resolveIdName(id, 'section'))
        .filter(Boolean)

    return labels.length > 0 ? labels.join(', ') : '-'
}

const resolvePlacementChanges = (decision) => Array.isArray(decision?.context?.placementChanges)
    ? decision.context.placementChanges
    : []

const resolveCanonicalSectionId = (sectionId) => {
    const section = sectionById.value.get(String(sectionId))
    if (!section?.parentSectionId) return sectionId
    return section.parentSectionId
}

const formatPlacementPeriods = (periodIds) => {
    if (!Array.isArray(periodIds) || periodIds.length === 0) return 'Unplaced'
    return periodIds.map((id) => props.resolveIdName(id, 'period')).join(', ')
}

const formatPlacementChanges = (decision) => {
    const formatted = new Map()

    resolvePlacementChanges(decision).forEach((change) => {
        const canonicalSectionId = resolveCanonicalSectionId(change?.sectionId)
        const fromLabel = formatPlacementPeriods(change?.fromCoursePeriodIds)
        const toLabel = formatPlacementPeriods(change?.toCoursePeriodIds)
        const dedupeKey = [
            String(canonicalSectionId ?? ''),
            JSON.stringify(change?.fromCoursePeriodIds || []),
            JSON.stringify(change?.toCoursePeriodIds || []),
        ].join('|')

        if (formatted.has(dedupeKey)) return

        const sectionLabel = props.resolveIdName(canonicalSectionId, 'section')
        formatted.set(dedupeKey, `${sectionLabel}: ${fromLabel} -> ${toLabel}`)
    })

    return Array.from(formatted.values())
}

const describeDecision = (decision) => {
    if (isTabuMoveSelected(decision)) {
        const move = decision?.context?.move || '-'
        const scoreDelta = decision?.metrics?.scoreDelta ?? '-'
        const bestAfter = decision?.metrics?.bestScoreAfter ?? '-'
        const usedAspiration = decision?.context?.usedAspiration === true
        const improvedBest = decision?.context?.improvedBestScore === true
        const placementSummary = formatPlacementChanges(decision)

        return {
            title: placementSummary.length > 0 ? `Selected tabu move: ${placementSummary.join('; ')}` : `Selected tabu move: ${move}`,
            summary: `${improvedBest ? 'Improved' : 'Changed'} score by ${scoreDelta}. Best score now ${bestAfter}.${usedAspiration ? ' Allowed via aspiration.' : ''}`,
        }
    }

    if (isTabuMoveRejected(decision)) {
        const move = decision?.context?.move || '-'
        const candidateScore = decision?.metrics?.candidateScore ?? '-'
        const placementSummary = formatPlacementChanges(decision)
        return {
            title: placementSummary.length > 0 ? `Rejected tabu move: ${placementSummary.join('; ')}` : `Rejected tabu move: ${move}`,
            summary: `Skipped because the move was tabu and candidate score ${candidateScore} did not beat the current global best.`,
        }
    }

    if (isTabuFinalSummary(decision)) {
        const iterations = decision?.metrics?.iterationsRun ?? '-'
        const changedSections = decision?.metrics?.changedSections ?? '-'
        return {
            title: 'Tabu search completed',
            summary: `Finished after ${iterations} iteration${Number(iterations) === 1 ? '' : 's'} and changed ${changedSections} section${Number(changedSections) === 1 ? '' : 's'}.`,
        }
    }

    return {
        title: `${formatDecisionCode(decision?.code)}: ${decision?.message || ''}`.trim(),
        summary: decision?.message || '',
    }
}

const describeChain = (chain) => {
    const record = chain?.lastRecord || chain?.firstRecord
    if (!record) {
        return {
            title: 'Decision Chain',
            summary: '',
        }
    }

    if (isTabuMoveSelected(record) || isTabuMoveRejected(record)) {
        const iteration = record?.execution?.iteration
        return {
            title: `Tabu Iteration ${iteration ?? '-'}`,
            summary: describeDecision(record).summary,
        }
    }

    if (isTabuFinalSummary(record)) {
        return {
            title: 'Tabu Finalization',
            summary: describeDecision(record).summary,
        }
    }

    return {
        title: `Chain ${chain.decisionId}`,
        summary: record?.message || '',
    }
}

const decisionChains = computed(() => {
    const chainsById = new Map()

    props.currentSectionDecisionLogs.forEach((decision) => {
        const decisionId = String(decision?.decisionId || 'unscoped-chain')
        const existing = chainsById.get(decisionId)

        if (existing) {
            existing.records.push(decision)
            return
        }

        chainsById.set(decisionId, {
            decisionId,
            records: [decision]
        })
    })

    return Array.from(chainsById.values())
        .map((chain) => {
            const records = [...chain.records].sort(compareDecisionRecords)
            const firstRecord = records[0] || null
            const lastRecord = records[records.length - 1] || null
            const adoptedFromDecisionIds = Array.from(
                new Set(
                    records.flatMap((record) => Array.isArray(record?.adoption?.adoptedFromDecisionIds)
                        ? record.adoption.adoptedFromDecisionIds
                        : [])
                )
            )

            return {
                decisionId: chain.decisionId,
                records,
                firstRecord,
                lastRecord,
                strategyType: firstRecord?.execution?.strategyType || lastRecord?.execution?.strategyType || null,
                category: lastRecord?.category || firstRecord?.category || null,
                retention: lastRecord?.retention || firstRecord?.retention || null,
                adoptedFromDecisionIds
            }
        })
        .sort((left, right) => compareDecisionRecords(left.firstRecord, right.firstRecord))
})

const sectionTableVirtualScrollerOptions = {
    itemSize: 38,
    numToleratedItems: 12,
    delay: 0,
    showLoader: false
}

const unplacedTableRef = ref(null)
const placedTableRef = ref(null)
const invalidTableRef = ref(null)
const collapsedDecisionChains = ref({})

const rowClass = (data) => 'decision-section-row decision-section-row--' + String(data.sectionId)

const isChainCollapsed = (decisionId) => Boolean(collapsedDecisionChains.value[decisionId])

const toggleChainCollapsed = (decisionId) => {
    collapsedDecisionChains.value = {
        ...collapsedDecisionChains.value,
        [decisionId]: !collapsedDecisionChains.value[decisionId]
    }
}

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

        const renderedRow = root.querySelector('.decision-section-row--' + targetId)
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

watch(decisionChains, (chains) => {
    const nextCollapsed = {}
    chains.forEach((chain) => {
        nextCollapsed[chain.decisionId] = collapsedDecisionChains.value[chain.decisionId] ?? false
    })
    collapsedDecisionChains.value = nextCollapsed
}, { immediate: true })
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
                            <Column field="decisionCount" header="Logs" sortable style="width: 5rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.decisionCount" severity="info"></Badge>
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
                            <Column field="decisionCount" header="Logs" sortable style="width: 5rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.decisionCount" severity="info"></Badge>
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
                            sortField="decisionCount"
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
                            <Column field="decisionCount" header="Logs" sortable style="width: 6rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.decisionCount" severity="info"></Badge>
                                </template>
                            </Column>
                            <Column field="invalidDiagnosticCount" header="Invalid" sortable style="width: 5rem">
                                <template #body="slotProps">
                                    <Badge :value="slotProps.data.invalidDiagnosticCount" :severity="slotProps.data.invalidDiagnosticCount > 0 ? 'danger' : 'secondary'"></Badge>
                                </template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </div>

        <div class="lg:col-span-2 card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col min-h-0">
            <h3 class="text-xl font-black mb-6 px-2">Section Decision Log</h3>

            <div v-if="!selectedSectionModel" class="flex-1 min-h-0 flex flex-col items-center justify-center py-10 text-gray-400">
                <i class="pi pi-sitemap text-6xl mb-4 opacity-20"></i>
                <p class="font-medium text-lg">Select a section to inspect decision logs.</p>
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
                            <span v-if="isInheritedDecisionView">
                                Showing the parent section's decision chain because subsection placement inherits the parent narrative.
                            </span>
                            <span v-else>
                                Parent section decision chains may contain the main placement narrative.
                            </span>
                        </div>
                        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-sky-700 dark:text-sky-200">
                            <span class="rounded-full bg-sky-100 dark:bg-sky-900/40 px-2.5 py-1">
                                Parent decisions: {{ parentDecisionCount }}
                            </span>
                            <span
                                v-if="isInheritedDecisionView && decisionLogOwner"
                                class="rounded-full bg-sky-100 dark:bg-sky-900/40 px-2.5 py-1"
                            >
                                Viewing records from: {{ decisionLogOwner.course_name || resolveIdName(decisionLogOwner.sectionId, 'section') }}
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

                <div v-if="!hasDecisionLogs" class="p-12 text-center bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <i class="pi pi-exclamation-triangle text-5xl text-amber-500 mb-4"></i>
                    <p class="text-amber-700 dark:text-amber-400 font-bold text-lg mb-2">No Decision Logs Available</p>
                    <p class="text-amber-600/70 dark:text-amber-500/70 text-sm">Decision logs are emitted in trace mode during placement.</p>
                </div>

                <div v-else-if="currentSectionDecisionLogs.length === 0" class="p-12 text-center bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <i class="pi pi-check-circle text-5xl text-emerald-500 mb-4"></i>
                    <p class="text-emerald-700 dark:text-emerald-400 font-bold text-lg mb-2">No Decision Logs Recorded</p>
                    <p class="text-emerald-600/70 dark:text-emerald-500/70 text-sm">This section has no decision logs in the current run.</p>
                </div>

                <div v-else class="h-full min-h-0 space-y-4 overflow-y-auto pr-2">
                    <div class="flex items-center gap-2 px-2 text-blue-500">
                        <i class="pi pi-sitemap font-black"></i>
                        <span class="text-xs font-black uppercase tracking-widest">Decision Chains</span>
                    </div>
                    <div
                        v-for="(chain, chainIdx) in decisionChains"
                        :key="chain.decisionId"
                        class="space-y-4 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/5 items-start transition-all hover:border-blue-200 dark:hover:border-blue-800"
                    >
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <div class="text-sm font-bold text-blue-700 dark:text-blue-300 leading-relaxed">
                                    {{ describeChain(chain).title }}
                                </div>
                                <div v-if="describeChain(chain).summary" class="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80 max-w-3xl">
                                    {{ describeChain(chain).summary }}
                                </div>
                                <div class="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80 font-semibold">
                                    <span v-if="chain.strategyType">Strategy: {{ chain.strategyType }}</span>
                                    <span v-else>Strategy: -</span>
                                    <span v-if="chain.category"> | Category: {{ chain.category }}</span>
                                    <span v-if="chain.retention"> | Retention: {{ chain.retention }}</span>
                                    <span> | Records: {{ chain.records.length }}</span>
                                </div>
                                <div class="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80 font-semibold">
                                    Decision ID: {{ chain.decisionId }}
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <Tag :value="chain.lastRecord?.severity || 'info'" :severity="primeSeverityForLevel(chain.lastRecord?.severity)" />
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-800 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-100/70 dark:hover:bg-blue-900/30"
                                    @click="toggleChainCollapsed(chain.decisionId)"
                                >
                                    <i :class="['pi text-[10px]', isChainCollapsed(chain.decisionId) ? 'pi-chevron-down' : 'pi-chevron-up']"></i>
                                    {{ isChainCollapsed(chain.decisionId) ? 'Expand' : 'Collapse' }}
                                </button>
                            </div>
                        </div>
                        <div v-if="chain.adoptedFromDecisionIds.length > 0" class="text-xs text-blue-700/80 dark:text-blue-300/80">
                            <div class="font-bold mb-1">Adopted From</div>
                            <div class="flex flex-wrap gap-2">
                                <Tag
                                    v-for="adoptedId in chain.adoptedFromDecisionIds"
                                    :key="adoptedId"
                                    :value="adoptedId"
                                    severity="secondary"
                                />
                            </div>
                        </div>
                        <div v-if="!isChainCollapsed(chain.decisionId)" class="space-y-3">
                            <div
                                v-for="(decision, idx) in chain.records"
                                :key="`${chain.decisionId}-${idx}`"
                                class="rounded-xl border border-blue-200/60 dark:border-blue-800/50 bg-white/60 dark:bg-gray-950/20 px-4 py-4"
                            >
                                <div class="flex items-start justify-between gap-4">
                                    <div>
                                        <div class="text-sm font-bold text-blue-700 dark:text-blue-300 leading-relaxed">
                                            {{ describeDecision(decision).title }}
                                        </div>
                                        <div v-if="describeDecision(decision).summary && describeDecision(decision).summary !== decision.message" class="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
                                            {{ describeDecision(decision).summary }}
                                        </div>
                                        <div class="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80 font-semibold">
                                            Level: {{ decision.severity }}
                                            <span v-if="decision.execution?.step"> | Step: {{ decision.execution.step }}</span>
                                            <span v-if="decision.execution?.iteration != null"> | Iteration: {{ decision.execution.iteration }}</span>
                                        </div>
                                    </div>
                                    <Tag :value="decision.severity" :severity="primeSeverityForLevel(decision.severity)" />
                                </div>
                                <div
                                    v-if="resolveAffectedSections(decision).length > 0"
                                    class="mt-3 text-xs text-blue-700/80 dark:text-blue-300/80"
                                >
                                    <div class="font-bold mb-1">Affected Sections</div>
                                    <div>{{ formatAffectedSections(decision) }}</div>
                                </div>
                                <div
                                    v-if="formatPlacementChanges(decision).length > 0"
                                    class="mt-3 text-xs text-blue-700/80 dark:text-blue-300/80"
                                >
                                    <div class="font-bold mb-1">Placement Changes</div>
                                    <div class="space-y-1">
                                        <div
                                            v-for="(change, changeIdx) in formatPlacementChanges(decision)"
                                            :key="`${chain.decisionId}-${idx}-change-${changeIdx}`"
                                        >
                                            {{ change }}
                                        </div>
                                    </div>
                                </div>
                                <div v-if="decision.metrics && Object.keys(decision.metrics).length > 0" class="mt-3 text-xs text-blue-700/80 dark:text-blue-300/80">
                                    <div class="font-bold mb-1">Metrics</div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                        <div v-for="([key, value], metricIdx) in Object.entries(decision.metrics)" :key="`${chain.decisionId}-${idx}-${metricIdx}`">
                                            {{ key }}: {{ value }}
                                        </div>
                                    </div>
                                </div>
                                <div v-if="decision.conflictingIds?.length" class="mt-3 text-xs text-blue-700/80 dark:text-blue-300/80">
                                    <div class="font-bold mb-1">References</div>
                                    <div class="space-y-2">
                                        <div
                                            v-for="(refId, refIdx) in decision.conflictingIds"
                                            :key="`${chain.decisionId}-${idx}-ref-${refIdx}`"
                                            class="rounded border border-blue-200/60 dark:border-blue-800/50 px-2 py-1"
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
                        <div v-else class="rounded-xl border border-blue-200/60 dark:border-blue-800/50 bg-white/40 dark:bg-gray-950/10 px-4 py-3 text-xs font-semibold text-blue-700/80 dark:text-blue-300/80">
                            {{ chain.records.length }} record{{ chain.records.length === 1 ? '' : 's' }} hidden.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
