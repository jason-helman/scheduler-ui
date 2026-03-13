<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import { CopyButton } from '../common'
import { store } from '../../store'
import { api } from '../../services/api'

const FALLBACK_STRATEGY_DESCRIPTORS = [
    {
        id: 'greedy',
        metadata: { kind: 'construction', supportsExactScoring: true, mutatesSharedRuntime: true },
        requiredRuntimeKeys: [],
        isDefaultStage: true,
        defaultStage: { id: 'greedy' }
    },
    {
        id: 'beam',
        metadata: { kind: 'construction', supportsExactScoring: false, mutatesSharedRuntime: false },
        requiredRuntimeKeys: [],
        isDefaultStage: false
    },
    {
        id: 'lns',
        metadata: { kind: 'optimization', supportsExactScoring: false, mutatesSharedRuntime: false },
        requiredRuntimeKeys: [],
        isDefaultStage: false
    },
    {
        id: 'multistart',
        metadata: { kind: 'construction', supportsExactScoring: false, mutatesSharedRuntime: false },
        requiredRuntimeKeys: [],
        isDefaultStage: false
    },
    {
        id: 'tabu',
        metadata: { kind: 'optimization', supportsExactScoring: true, mutatesSharedRuntime: true },
        requiredRuntimeKeys: [],
        isDefaultStage: true,
        defaultStage: { id: 'tabu' }
    }
]

const DEFAULT_RUN_SETTINGS = {
    diagnosticsMode: 'trace',
    maxInARow: 0,
    maxInclusionStudents: 10,
    maxInclusionPercentage: 50,
    manualSectionClassroomFill: 'off',
    separateInclusionCodes: false,
    weightDemandCoverage: 1000,
    weightTeacherBalance: 100,
    weightSingletonConflict: 50,
    weightSameCourseConflict: 200,
    weightPeriodDensity: 150,
    weightTeacherPatternBalance: 40,
    teacherPatternBalanceScale: 10,
    weightTightChainConflict: 400,
    weightInclusionChainConflict: 1200,
    strategyStages: ['greedy', 'tabu'],
    beamWidth: 4,
    beamBranchLimitPerSection: 3,
    beamMaxStatesEvaluated: 2000,
    beamScoreMode: 'approximate',
    multistartRuns: 5,
    multistartCandidatePoolSize: 2,
    tabuMaxIterations: 100,
    tabuMaxTabuSize: 30,
    tabuNeighborhoodSampleLimit: 25,
    lnsIterations: 40,
    lnsDestroySize: 6,
    lnsDestroyMode: 'hybrid_conflict',
    lnsRepairMode: 'greedy',
    lnsScoreMode: 'approximate',
    randomSeed: null
}

const diagnosticsModeOptions = [
    { label: 'Trace', value: 'trace' },
    { label: 'Summary', value: 'summary' }
]

const beamScoreModeOptions = [
    { label: 'Approximate', value: 'approximate' },
    { label: 'Hybrid', value: 'hybrid' }
]

const lnsDestroyModeOptions = [
    { label: 'Hybrid Conflict', value: 'hybrid_conflict' },
    { label: 'Conflict Cluster', value: 'conflict_cluster' },
    { label: 'Random', value: 'random' }
]

const lnsRepairModeOptions = [
    { label: 'Greedy', value: 'greedy' }
]

const startCase = (value) => String(value || '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')

const normalizeStrategyDescriptor = (descriptor) => ({
    ...descriptor,
    id: String(descriptor?.id || ''),
    metadata: descriptor?.metadata || {},
    requiredRuntimeKeys: Array.isArray(descriptor?.requiredRuntimeKeys) ? descriptor.requiredRuntimeKeys : [],
    isDefaultStage: Boolean(descriptor?.isDefaultStage),
    defaultStage: descriptor?.defaultStage || null
})

const getStrategyDescriptors = (dataset) => {
    const descriptors = Array.isArray(dataset?.strategyDescriptors) && dataset.strategyDescriptors.length > 0
        ? dataset.strategyDescriptors
        : FALLBACK_STRATEGY_DESCRIPTORS

    return descriptors
        .map(normalizeStrategyDescriptor)
        .filter((descriptor) => descriptor.id)
}

const getDefaultStrategyStages = (descriptors) => {
    const stageIds = descriptors
        .filter((descriptor) => descriptor.isDefaultStage)
        .map((descriptor) => descriptor.id)

    return stageIds.length > 0 ? stageIds : [...DEFAULT_RUN_SETTINGS.strategyStages]
}

const cloneStage = (stage) => JSON.parse(JSON.stringify(stage))

const formatStrategyLabel = (descriptor) => {
    const base = startCase(descriptor.id)
    const kind = descriptor?.metadata?.kind ? ` (${startCase(descriptor.metadata.kind)})` : ''
    return `${base}${kind}`
}

const formatStageSummary = (stageId) => {
    const descriptor = descriptorById.value.get(stageId)
    return descriptor ? formatStrategyLabel(descriptor) : startCase(stageId)
}

const manualClassroomFillOptions = [
    { label: 'Off', value: 'off' },
    { label: 'When Missing', value: 'when-missing' }
]

const numericSettingFields = [
    ['maxInARow', 'Max In A Row'],
    ['maxInclusionStudents', 'Max Inclusion Students'],
    ['maxInclusionPercentage', 'Max Inclusion Percentage'],
    ['weightDemandCoverage', 'Demand Coverage Weight'],
    ['weightTeacherBalance', 'Teacher Balance Weight'],
    ['weightSingletonConflict', 'Singleton Conflict Weight'],
    ['weightSameCourseConflict', 'Same Course Conflict Weight'],
    ['weightPeriodDensity', 'Period Density Weight'],
    ['weightTeacherPatternBalance', 'Teacher Pattern Balance Weight'],
    ['teacherPatternBalanceScale', 'Teacher Pattern Balance Scale'],
    ['weightTightChainConflict', 'Tight Chain Conflict Weight'],
    ['weightInclusionChainConflict', 'Inclusion Chain Conflict Weight']
]

const createRunSettings = (dataset) => {
    const settings = dataset?.settings || {}
    const descriptors = getStrategyDescriptors(dataset)

    return {
        diagnosticsMode: DEFAULT_RUN_SETTINGS.diagnosticsMode,
        maxInARow: settings.maxInARow ?? DEFAULT_RUN_SETTINGS.maxInARow,
        maxInclusionStudents: settings.maxInclusionStudents ?? DEFAULT_RUN_SETTINGS.maxInclusionStudents,
        maxInclusionPercentage: settings.maxInclusionPercentage ?? DEFAULT_RUN_SETTINGS.maxInclusionPercentage,
        manualSectionClassroomFill: settings.manualSectionClassroomFill ?? DEFAULT_RUN_SETTINGS.manualSectionClassroomFill,
        separateInclusionCodes: settings.separateInclusionCodes ?? DEFAULT_RUN_SETTINGS.separateInclusionCodes,
        weightDemandCoverage: DEFAULT_RUN_SETTINGS.weightDemandCoverage,
        weightTeacherBalance: DEFAULT_RUN_SETTINGS.weightTeacherBalance,
        weightSingletonConflict: DEFAULT_RUN_SETTINGS.weightSingletonConflict,
        weightSameCourseConflict: DEFAULT_RUN_SETTINGS.weightSameCourseConflict,
        weightPeriodDensity: DEFAULT_RUN_SETTINGS.weightPeriodDensity,
        weightTeacherPatternBalance: DEFAULT_RUN_SETTINGS.weightTeacherPatternBalance,
        teacherPatternBalanceScale: DEFAULT_RUN_SETTINGS.teacherPatternBalanceScale,
        weightTightChainConflict: DEFAULT_RUN_SETTINGS.weightTightChainConflict,
        weightInclusionChainConflict: DEFAULT_RUN_SETTINGS.weightInclusionChainConflict,
        strategyStages: [...getDefaultStrategyStages(descriptors)],
        beamWidth: DEFAULT_RUN_SETTINGS.beamWidth,
        beamBranchLimitPerSection: DEFAULT_RUN_SETTINGS.beamBranchLimitPerSection,
        beamMaxStatesEvaluated: DEFAULT_RUN_SETTINGS.beamMaxStatesEvaluated,
        beamScoreMode: DEFAULT_RUN_SETTINGS.beamScoreMode,
        multistartRuns: DEFAULT_RUN_SETTINGS.multistartRuns,
        multistartCandidatePoolSize: DEFAULT_RUN_SETTINGS.multistartCandidatePoolSize,
        tabuMaxIterations: DEFAULT_RUN_SETTINGS.tabuMaxIterations,
        tabuMaxTabuSize: DEFAULT_RUN_SETTINGS.tabuMaxTabuSize,
        tabuNeighborhoodSampleLimit: DEFAULT_RUN_SETTINGS.tabuNeighborhoodSampleLimit,
        lnsIterations: DEFAULT_RUN_SETTINGS.lnsIterations,
        lnsDestroySize: DEFAULT_RUN_SETTINGS.lnsDestroySize,
        lnsDestroyMode: DEFAULT_RUN_SETTINGS.lnsDestroyMode,
        lnsRepairMode: DEFAULT_RUN_SETTINGS.lnsRepairMode,
        lnsScoreMode: DEFAULT_RUN_SETTINGS.lnsScoreMode,
        randomSeed: DEFAULT_RUN_SETTINGS.randomSeed
    }
}

const showRunSettings = ref(false)
const runSettings = ref(createRunSettings(null))
const availableStrategyDescriptors = computed(() => getStrategyDescriptors(store.localDataset))
const descriptorById = computed(() => new Map(availableStrategyDescriptors.value.map((descriptor) => [descriptor.id, descriptor])))
const strategyStageOptions = computed(() =>
    availableStrategyDescriptors.value.map((descriptor) => ({
        label: formatStrategyLabel(descriptor),
        value: descriptor.id,
        kind: descriptor?.metadata?.kind || 'strategy',
        isDefaultStage: descriptor.isDefaultStage
    }))
)
const selectedStrategyStages = computed(() =>
    availableStrategyDescriptors.value
        .map((descriptor) => descriptor.id)
        .filter((stageId) => (runSettings.value.strategyStages || []).includes(stageId))
)
const selectedStageDescriptors = computed(() =>
    selectedStrategyStages.value
        .map((stageId) => descriptorById.value.get(stageId))
        .filter(Boolean)
)
const selectedConstructionStages = computed(() =>
    selectedStageDescriptors.value.filter((descriptor) => descriptor?.metadata?.kind === 'construction')
)
const pipelineCompatibilityMessage = computed(() => {
    if (selectedConstructionStages.value.length <= 1) return null
    return `Only one construction stage is allowed. Selected construction stages: ${selectedConstructionStages.value.map((descriptor) => startCase(descriptor.id)).join(', ')}.`
})
const hasPipelineCompatibilityError = computed(() => Boolean(pipelineCompatibilityMessage.value))
const hasBeamStage = computed(() => selectedStrategyStages.value.includes('beam'))
const hasMultistartStage = computed(() => selectedStrategyStages.value.includes('multistart'))
const hasTabuStage = computed(() => selectedStrategyStages.value.includes('tabu'))
const hasLnsStage = computed(() => selectedStrategyStages.value.includes('lns'))
const hasStrategyStagesSelected = computed(() => selectedStrategyStages.value.length > 0)

const resetRunSettings = (dataset = store.localDataset) => {
    runSettings.value = createRunSettings(dataset)
}

const buildStrategyStage = (stageId) => {
    const descriptor = descriptorById.value.get(stageId)

    if (stageId === 'beam') {
        return {
            id: 'beam',
            options: {
                beamWidth: runSettings.value.beamWidth,
                branchLimitPerSection: runSettings.value.beamBranchLimitPerSection,
                maxStatesEvaluated: runSettings.value.beamMaxStatesEvaluated,
                scoreMode: runSettings.value.beamScoreMode
            }
        }
    }

    if (stageId === 'multistart') {
        return {
            id: 'multistart',
            options: {
                runs: runSettings.value.multistartRuns,
                candidatePoolSize: runSettings.value.multistartCandidatePoolSize
            }
        }
    }

    if (stageId === 'tabu') {
        return {
            id: 'tabu',
            options: {
                maxIterations: runSettings.value.tabuMaxIterations,
                maxTabuSize: runSettings.value.tabuMaxTabuSize,
                neighborhoodSampleLimit: runSettings.value.tabuNeighborhoodSampleLimit
            }
        }
    }

    if (stageId === 'lns') {
        return {
            id: 'lns',
            options: {
                iterations: runSettings.value.lnsIterations,
                destroySize: runSettings.value.lnsDestroySize,
                destroyMode: runSettings.value.lnsDestroyMode,
                repairMode: runSettings.value.lnsRepairMode,
                scoreMode: runSettings.value.lnsScoreMode
            }
        }
    }

    return descriptor?.defaultStage ? cloneStage(descriptor.defaultStage) : { id: stageId }
}

const buildStrategyPipeline = () => {
    return selectedStrategyStages.value.map((stageId) => buildStrategyStage(stageId))
}

const buildDatasetForPlacement = (dataset) => ({
    ...dataset,
    observability: null,
    settings: {
        ...(dataset.settings || {}),
        maxInARow: runSettings.value.maxInARow,
        maxInclusionStudents: runSettings.value.maxInclusionStudents,
        maxInclusionPercentage: runSettings.value.maxInclusionPercentage,
        manualSectionClassroomFill: runSettings.value.manualSectionClassroomFill,
        separateInclusionCodes: runSettings.value.separateInclusionCodes
    }
})

const buildEngineOptions = () => ({
    engineSettings: {
        diagnosticsMode: runSettings.value.diagnosticsMode,
        weightDemandCoverage: runSettings.value.weightDemandCoverage,
        weightTeacherBalance: runSettings.value.weightTeacherBalance,
        weightSingletonConflict: runSettings.value.weightSingletonConflict,
        weightSameCourseConflict: runSettings.value.weightSameCourseConflict,
        weightPeriodDensity: runSettings.value.weightPeriodDensity,
        weightTeacherPatternBalance: runSettings.value.weightTeacherPatternBalance,
        teacherPatternBalanceScale: runSettings.value.teacherPatternBalanceScale,
        weightTightChainConflict: runSettings.value.weightTightChainConflict,
        weightInclusionChainConflict: runSettings.value.weightInclusionChainConflict
    },
    strategyPipeline: buildStrategyPipeline(),
    ...(Number.isInteger(runSettings.value.randomSeed) ? { randomSeed: runSettings.value.randomSeed } : {})
})

const selectedStrategySummary = computed(() =>
    selectedStrategyStages.value
        .map((stageId) => formatStageSummary(stageId))
        .join(' + ')
)

const actionMenu = ref(null)
const actionItems = ref([
    {
        label: 'Simulation',
        items: [
            {
                label: 'Run Section Placement',
                icon: 'pi pi-play',
                command: () => runPlacement()
            },
            {
                label: 'Clear Placements',
                icon: 'pi pi-eraser',
                command: () => clearPlacements()
            },
            {
                label: 'Clear Students',
                icon: 'pi pi-user-minus',
                command: () => clearStudents()
            },
            {
                label: 'Clear All Locks',
                icon: 'pi pi-lock-open',
                command: () => clearLocks()
            },
            {
                label: 'Reload from DB',
                icon: 'pi pi-refresh',
                command: () => fetchData()
            }
        ]
    }
])

const toggleMenu = (event) => {
    actionMenu.value.toggle(event)
}

const commitLocalDataset = (nextDataset) => {
    store.localDataset = nextDataset
    store.localDatasetRevision += 1
}

const clearLoadedScheduleState = () => {
    store.selectionEpoch += 1
    commitLocalDataset(null)
    store.selectedSectionId = null
    store.diagnosticsExternalScrollKey = 0
}

const fetchData = async () => {
    if (!store.selectedSchool || !store.selectedVersion) return
    
    store.loading = true
    store.error = null
    const requestEpoch = store.selectionEpoch
    try {
        const dataset = await api.fetchFullDataset(
            store.selectedSchool.school_id,
            store.selectedVersion.schedule_version_id
        )
        if (requestEpoch !== store.selectionEpoch) return
        commitLocalDataset({ ...dataset, observability: null })
        resetRunSettings(dataset)
    } catch (e) {
        store.error = "Failed to fetch dataset: " + e.message
    } finally {
        if (requestEpoch === store.selectionEpoch) {
            store.loading = false
        }
    }
}

const runPlacement = async () => {
    if (!store.localDataset) return
    if (!hasStrategyStagesSelected.value) {
        store.error = 'Select at least one strategy stage before running placement.'
        return
    }
    if (hasPipelineCompatibilityError.value) {
        store.error = pipelineCompatibilityMessage.value
        return
    }
    
    store.loading = true
    store.error = null

    const contextVersionId = store.selectedVersion?.schedule_version_id ?? null
    const requestEpoch = store.selectionEpoch
    const requestDataset = store.localDataset
    const datasetForPlacement = buildDatasetForPlacement(requestDataset)
    const engineOptions = buildEngineOptions()

    // Clear diagnostics immediately for this version while a new run is in flight.
    commitLocalDataset(datasetForPlacement)

    try {
        const result = await api.runSectionPlacement(datasetForPlacement, engineOptions)
        if (requestEpoch !== store.selectionEpoch) return
        if ((store.selectedVersion?.schedule_version_id ?? null) !== contextVersionId) return
        if (!store.localDataset) return

        // Merge placement results into existing local dataset to preserve names and other metadata
        const placementMap = {}
        result.sections.forEach(ps => {
            placementMap[ps.section_id] = ps
        })
        
        const nextSections = store.localDataset.sections.map(s => {
            const ps = placementMap[s.sectionId]
            if (ps) {
                return {
                    ...s,
                    classroomId: ps.classroom_id,
                    room_name: ps.room_name || s.room_name,
                    coursePeriodIds: ps.course_period_ids || [],
                    quartersDays: ps.quarters_days,
                    quarters: ps.quarters || s.quarters,
                    days: ps.days || s.days,
                    student_count: ps.student_count ?? s.student_count,
                    scheduledStudentIds: ps.scheduled_student_ids || ps.scheduledStudentIds || s.scheduledStudentIds || []
                }
            }
            return s
        })

        const nextObservability = result?.observability || null

        // Atomically replace dataset snapshot so derived observability never sees
        // "new sections + old/null diagnostics" intermediate state.
        commitLocalDataset({
            ...store.localDataset,
            sections: nextSections,
            observability: nextObservability
        })
    } catch (e) {
        store.error = "Failed to run placement: " + e.message
    } finally {
        if (requestEpoch === store.selectionEpoch) {
            store.loading = false
        }
    }
}

const clearStudents = () => {
    store.localDataset.sections.forEach(s => {
        s.student_count = 0
        s.scheduledStudentIds = []
    })
}

const clearLocks = () => {
    store.localDataset.sections.forEach(s => {
        s.locked = 0
    })
}

const clearPlacements = () => {
    const nextSections = store.localDataset.sections.map(s => {
        if (!s.locked) {
            return {
                ...s,
                classroomId: undefined,
                room_name: 'N/A',
                days: '',
                coursePeriodIds: [],
                quartersDays: undefined,
                quarters: ""
            }
        }
        return s
    })
    commitLocalDataset({
        ...store.localDataset,
        sections: nextSections,
        observability: null
    })
}

const fetchSchools = async () => {
    try {
        store.schools = await api.fetchSchools()
    } catch (e) {
        store.error = "Failed to fetch schools: " + e.message
    }
}

const fetchVersions = async () => {
    if (!store.selectedSchool) return
    store.selectedVersion = null
    try {
        store.versions = await api.fetchVersions(store.selectedSchool.school_id)
    } catch (e) {
        store.error = "Failed to fetch versions: " + e.message
    }
}

onMounted(() => {
    if (store.schools.length === 0) fetchSchools()
})

watch(
    () => store.selectedSchool?.school_id ?? null,
    (newSchoolId, oldSchoolId) => {
        if (newSchoolId === oldSchoolId) return
        clearLoadedScheduleState()
        fetchVersions()
    },
    { flush: 'sync' }
)

watch(
    () => store.selectedVersion?.schedule_version_id ?? null,
    (newVersionId, oldVersionId) => {
        if (newVersionId === oldVersionId) return
        clearLoadedScheduleState()
    },
    { flush: 'sync' }
)
</script>

<template>
    <div class="card bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
        <div class="flex flex-wrap gap-6 items-end justify-between">
            <div class="flex flex-wrap gap-6 items-end">
                <div class="flex flex-col gap-2">
                    <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">School</label>
                    <Select v-model="store.selectedSchool" :options="store.schools" optionLabel="name" placeholder="Select a School" class="w-72" :disabled="store.loading">
                        <template #value="slotProps">
                            <div v-if="slotProps.value" class="flex items-center justify-between w-full pr-4">
                                <span>{{ slotProps.value.name }}</span>
                                <CopyButton v-if="store.showIds && slotProps.value.school_id != null" :value="slotProps.value.school_id" label="School ID" />
                            </div>
                            <span v-else>{{ slotProps.placeholder }}</span>
                        </template>
                        <template #option="slotProps">
                            <div class="flex items-center justify-between w-full">
                                <span>{{ slotProps.option.name }}</span>
                                <CopyButton v-if="store.showIds && slotProps.option.school_id != null" :value="slotProps.option.school_id" label="School ID" />
                            </div>
                        </template>
                    </Select>
                </div>
                <div class="flex flex-col gap-2">
                    <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Schedule Version</label>
                    <Select v-model="store.selectedVersion" :options="store.versions" optionLabel="schedule_name" placeholder="Select a Version" :disabled="!store.selectedSchool || store.loading" :class="store.showIds ? 'w-[32rem]' : 'w-72'">
                        <template #value="slotProps">
                            <div v-if="slotProps.value" class="flex items-center justify-between w-full pr-4">
                                <span>{{ slotProps.value.schedule_name }}</span>
                                <span v-if="store.showIds" class="flex items-center gap-2">
                                    <CopyButton v-if="slotProps.value.data_version_id != null" :value="slotProps.value.data_version_id" label="Data ID" class="!bg-amber-500/10 !text-amber-500 !border-amber-500/20" />
                                    <CopyButton v-if="slotProps.value.schedule_version_id != null" :value="slotProps.value.schedule_version_id" label="Version ID" />
                                </span>
                            </div>
                            <span v-else>{{ slotProps.placeholder }}</span>
                        </template>
                        <template #option="slotProps">
                            <div class="flex items-center justify-between w-full">
                                <span>{{ slotProps.option.schedule_name }}</span>
                                <span v-if="store.showIds" class="flex items-center gap-2">
                                    <CopyButton v-if="slotProps.value.data_version_id != null" :value="slotProps.value.data_version_id" label="Data ID" class="!bg-amber-500/10 !text-amber-500 !border-amber-500/20" />
                                    <CopyButton v-if="slotProps.value.schedule_version_id != null" :value="slotProps.value.schedule_version_id" label="Version ID" />
                                </span>
                            </div>
                        </template>
                    </Select>
                </div>
                <Button label="Load Schedule" icon="pi pi-refresh" :loading="store.loading" :disabled="!store.selectedVersion || store.loading" @click="fetchData" class="px-6" />
            </div>

            <div class="flex items-end gap-3">
                <Button
                    type="button"
                    :icon="showRunSettings ? 'pi pi-sliders-h' : 'pi pi-cog'"
                    :label="showRunSettings ? 'Hide Run Settings' : 'Run Settings'"
                    severity="contrast"
                    outlined
                    :disabled="!store.localDataset"
                    @click="showRunSettings = !showRunSettings"
                />
                <Button type="button" icon="pi pi-bolt" label="Actions" @click="toggleMenu" aria-haspopup="true" aria-controls="overlay_menu" severity="secondary" outlined :disabled="!store.localDataset" />
                <Menu ref="actionMenu" id="overlay_menu" :model="actionItems" :popup="true" />
            </div>
        </div>

        <div v-if="showRunSettings && store.localDataset" class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/20 p-5 space-y-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div class="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Placement Run Settings</div>
                    <div class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Configure dataset settings, strategy pipeline, and stage options before running section placement.
                    </div>
                </div>
                <Button
                    type="button"
                    icon="pi pi-refresh"
                    label="Reset to Dataset"
                    severity="secondary"
                    text
                    @click="resetRunSettings()"
                />
            </div>

            <div class="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
                <div class="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 p-4">
                    <div class="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Scheduler Settings</div>
                    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div class="flex flex-col gap-2">
                            <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Diagnostics Mode</label>
                            <Select v-model="runSettings.diagnosticsMode" :options="diagnosticsModeOptions" optionLabel="label" optionValue="value" />
                        </div>
                        <div class="flex flex-col gap-2">
                            <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Classroom Fill</label>
                            <Select v-model="runSettings.manualSectionClassroomFill" :options="manualClassroomFillOptions" optionLabel="label" optionValue="value" />
                        </div>
                        <div class="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3 md:col-span-2 xl:col-span-1">
                            <div>
                                <div class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Separate Inclusion Codes</div>
                                <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">Use inclusion-specific pathing when enabled.</div>
                            </div>
                            <ToggleSwitch v-model="runSettings.separateInclusionCodes" />
                        </div>

                        <div
                            v-for="[field, label] in numericSettingFields"
                            :key="field"
                            class="flex flex-col gap-2"
                        >
                            <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{{ label }}</label>
                            <InputNumber v-model="runSettings[field]" fluid :use-grouping="false" />
                        </div>
                    </div>
                </div>

                <div class="space-y-4 rounded-2xl border border-sky-200 dark:border-sky-900/40 bg-sky-50/70 dark:bg-sky-950/10 p-4">
                    <div class="text-[11px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-300">Run Strategy</div>
                    <div class="grid gap-4">
                        <div class="flex flex-col gap-2">
                            <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Strategy Pipeline</label>
                            <MultiSelect
                                v-model="runSettings.strategyStages"
                                :options="strategyStageOptions"
                                optionLabel="label"
                                optionValue="value"
                                display="chip"
                                placeholder="Select strategy stages"
                                :max-selected-labels="2"
                            />
                            <span v-if="pipelineCompatibilityMessage" class="text-xs text-red-600 dark:text-red-300">{{ pipelineCompatibilityMessage }}</span>
                            <span v-else class="text-xs text-gray-500 dark:text-gray-400">Available stages come from the current scheduler-library descriptor surface.</span>
                        </div>
                        <div class="flex flex-col gap-2">
                            <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Random Seed</label>
                            <InputNumber v-model="runSettings.randomSeed" fluid :use-grouping="false" placeholder="Auto-generate each run" />
                            <span class="text-xs text-gray-500 dark:text-gray-400">Leave blank to let the engine generate a fresh seed.</span>
                        </div>
                    </div>

                    <div v-if="hasBeamStage" class="space-y-4 rounded-xl border border-cyan-200 dark:border-cyan-900/40 bg-white/70 dark:bg-slate-900/50 p-4">
                        <div class="text-[11px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-300">Beam Options</div>
                        <div class="grid gap-4">
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Beam Width</label>
                                <InputNumber v-model="runSettings.beamWidth" fluid :use-grouping="false" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Branch Limit Per Section</label>
                                <InputNumber v-model="runSettings.beamBranchLimitPerSection" fluid :use-grouping="false" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Max States Evaluated</label>
                                <InputNumber v-model="runSettings.beamMaxStatesEvaluated" fluid :use-grouping="false" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Score Mode</label>
                                <Select v-model="runSettings.beamScoreMode" :options="beamScoreModeOptions" optionLabel="label" optionValue="value" />
                            </div>
                        </div>
                    </div>

                    <div v-if="hasMultistartStage" class="space-y-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-white/70 dark:bg-slate-900/50 p-4">
                        <div class="text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300">Multistart Options</div>
                        <div class="grid gap-4">
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Runs</label>
                                <InputNumber v-model="runSettings.multistartRuns" fluid :use-grouping="false" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Candidate Pool Size</label>
                                <InputNumber v-model="runSettings.multistartCandidatePoolSize" fluid :use-grouping="false" />
                            </div>
                        </div>
                    </div>

                    <div v-if="hasTabuStage" class="space-y-4 rounded-xl border border-violet-200 dark:border-violet-900/40 bg-white/70 dark:bg-slate-900/50 p-4">
                        <div class="text-[11px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-300">Tabu Options</div>
                        <div class="grid gap-4">
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Max Iterations</label>
                                <InputNumber v-model="runSettings.tabuMaxIterations" fluid :use-grouping="false" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Max Tabu Size</label>
                                <InputNumber v-model="runSettings.tabuMaxTabuSize" fluid :use-grouping="false" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Neighborhood Sample Limit</label>
                                <InputNumber v-model="runSettings.tabuNeighborhoodSampleLimit" fluid :use-grouping="false" />
                            </div>
                        </div>
                    </div>

                    <div v-if="hasLnsStage" class="space-y-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-white/70 dark:bg-slate-900/50 p-4">
                        <div class="text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">LNS Options</div>
                        <div class="grid gap-4">
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Iterations</label>
                                <InputNumber v-model="runSettings.lnsIterations" fluid :use-grouping="false" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Destroy Size</label>
                                <InputNumber v-model="runSettings.lnsDestroySize" fluid :use-grouping="false" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Destroy Mode</label>
                                <Select v-model="runSettings.lnsDestroyMode" :options="lnsDestroyModeOptions" optionLabel="label" optionValue="value" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Repair Mode</label>
                                <Select v-model="runSettings.lnsRepairMode" :options="lnsRepairModeOptions" optionLabel="label" optionValue="value" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Score Mode</label>
                                <Select v-model="runSettings.lnsScoreMode" :options="beamScoreModeOptions" optionLabel="label" optionValue="value" />
                            </div>
                        </div>
                    </div>

                    <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-4 text-sm text-slate-600 dark:text-slate-300">
                        <div class="font-black uppercase tracking-widest text-[11px] text-slate-500 dark:text-slate-400">Run Preview</div>
                        <div class="mt-2">Pipeline: {{ selectedStrategySummary || 'No stages selected' }}</div>
                        <div class="mt-1">Diagnostics: {{ runSettings.diagnosticsMode }}</div>
                        <div v-if="hasBeamStage" class="mt-1">
                            Beam: width {{ runSettings.beamWidth }}, branch limit {{ runSettings.beamBranchLimitPerSection }}, max states {{ runSettings.beamMaxStatesEvaluated }}, {{ runSettings.beamScoreMode }} scoring
                        </div>
                        <div v-if="hasMultistartStage" class="mt-1">
                            Multistart: {{ runSettings.multistartRuns }} runs, candidate pool {{ runSettings.multistartCandidatePoolSize }}
                        </div>
                        <div v-if="hasTabuStage" class="mt-1">
                            Tabu: {{ runSettings.tabuMaxIterations }} iterations, tabu size {{ runSettings.tabuMaxTabuSize }}, sample limit {{ runSettings.tabuNeighborhoodSampleLimit }}
                        </div>
                        <div v-if="hasLnsStage" class="mt-1">
                            LNS: {{ runSettings.lnsIterations }} iterations, destroy size {{ runSettings.lnsDestroySize }}, {{ runSettings.lnsDestroyMode }} destroy / {{ runSettings.lnsRepairMode }} repair / {{ runSettings.lnsScoreMode }} scoring
                        </div>
                        <div class="mt-1">
                            Seed: {{ runSettings.randomSeed == null ? 'auto-generated' : runSettings.randomSeed }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
