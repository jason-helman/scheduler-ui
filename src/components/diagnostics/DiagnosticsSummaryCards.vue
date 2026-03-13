<script setup>
import Card from 'primevue/card'

const props = defineProps({
    systemMetrics: {
        type: Object,
        required: true
    }
})

const compactNumber = new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 2,
})

const fullNumber = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
})

const formatScoreCompact = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '-'
    return compactNumber.format(Number(value))
}

const formatScoreFull = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '-'
    return fullNumber.format(Number(value))
}

const resolveFinalGlobalScore = (metrics) => {
    if (metrics?.finalGlobalScore != null && !Number.isNaN(Number(metrics.finalGlobalScore))) {
        return Number(metrics.finalGlobalScore)
    }
    if (metrics?.initialGlobalScore != null && !Number.isNaN(Number(metrics.initialGlobalScore))) {
        return Number(metrics.initialGlobalScore)
    }
    return null
}

const STRATEGY_RUNTIME_CANDIDATES = [
    ['tabuSearchMs', 'Tabu Search Time'],
    ['lnsTotalMs', 'LNS Time'],
    ['beamTotalMs', 'Beam Search Time'],
    ['multistartTotalMs', 'Multistart Time'],
    ['greedyPlacementMs', 'Greedy Placement Time']
]

const resolvePrimaryStrategyRuntime = (metrics) => {
    const match = STRATEGY_RUNTIME_CANDIDATES.find(([key]) => metrics?.[key] != null && !Number.isNaN(Number(metrics[key])))
    return match ? Number(metrics[match[0]]) : null
}

const resolvePrimaryStrategyRuntimeLabel = (metrics) => {
    const match = STRATEGY_RUNTIME_CANDIDATES.find(([key]) => metrics?.[key] != null && !Number.isNaN(Number(metrics[key])))
    return match?.[1] || 'Primary Strategy Time'
}

const pad2 = (value) => String(value).padStart(2, '0')

const formatDuration = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '-'

    const totalMs = Math.max(0, Number(value))
    const totalSeconds = totalMs / 1000
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const secondsWithMs = seconds.toFixed(3).padStart(6, '0')

    if (hours > 0) return `${hours}:${pad2(minutes)}:${secondsWithMs}`
    if (minutes > 0) return `${minutes}:${secondsWithMs}`
    return `${seconds.toFixed(3)}s`
}

</script>

<template>
    <div class="shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
            <template #content>
                <div class="flex flex-col gap-1">
                    <span class="text-xs font-black uppercase tracking-widest text-gray-400">Total Runtime</span>
                    <div class="flex items-end gap-2">
                        <span class="text-4xl font-black text-blue-600 dark:text-blue-400">{{ formatDuration(systemMetrics.totalRunMs) }}</span>
                    </div>
                </div>
            </template>
        </Card>
        <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
            <template #content>
                <div class="flex flex-col gap-1">
                    <span class="text-xs font-black uppercase tracking-widest text-gray-400">{{ resolvePrimaryStrategyRuntimeLabel(systemMetrics) }}</span>
                    <div class="flex items-end gap-2">
                        <span class="text-4xl font-black text-purple-600 dark:text-purple-400">{{ formatDuration(resolvePrimaryStrategyRuntime(systemMetrics)) }}</span>
                    </div>
                </div>
            </template>
        </Card>
        <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
            <template #content>
                <div class="flex flex-col gap-1">
                    <span class="text-xs font-black uppercase tracking-widest text-gray-400">Final Global Score</span>
                    <div class="flex items-end gap-2">
                        <span
                            class="text-4xl font-black text-emerald-600 dark:text-emerald-400"
                            :title="resolveFinalGlobalScore(props.systemMetrics) != null
                                ? formatScoreFull(resolveFinalGlobalScore(props.systemMetrics))
                                : ''"
                        >
                            {{ formatScoreCompact(resolveFinalGlobalScore(systemMetrics)) }}
                        </span>
                        <span class="text-xs font-bold text-gray-400 mb-1">
                            <span
                                :title="props.systemMetrics.initialGlobalScore != null && props.systemMetrics.finalGlobalScore != null
                                    ? `${formatScoreFull(props.systemMetrics.initialGlobalScore)} -> ${formatScoreFull(props.systemMetrics.finalGlobalScore)}`
                                    : ''"
                            >
                                {{ props.systemMetrics.initialGlobalScore != null && props.systemMetrics.finalGlobalScore != null
                                    ? `${formatScoreCompact(props.systemMetrics.initialGlobalScore)} -> ${formatScoreCompact(props.systemMetrics.finalGlobalScore)}`
                                    : '' }}
                            </span>
                            <span
                                v-if="props.systemMetrics.initialGlobalScore != null && props.systemMetrics.finalGlobalScore != null"
                                class="block mt-0.5 text-[10px] font-semibold text-gray-400"
                            >
                                Initial -> Final
                            </span>
                            <span
                                v-else-if="resolveFinalGlobalScore(props.systemMetrics) != null"
                                class="block mt-0.5 text-[10px] font-semibold text-gray-400"
                            >
                                Final run score
                            </span>
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
</template>
