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

const getScoreDeltaPercent = (before, after) => {
    if (before == null || after == null) return null
    const beforeNumber = Number(before)
    const afterNumber = Number(after)
    if (Number.isNaN(beforeNumber) || Number.isNaN(afterNumber)) return null
    const denominator = Math.max(1, Math.abs(beforeNumber))
    return ((afterNumber - beforeNumber) / denominator) * 100
}

const formatPercent = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '-'
    const n = Number(value)
    const prefix = n > 0 ? '+' : ''
    return `${prefix}${n.toFixed(2)}%`
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

const getDeltaStatus = (delta) => {
    const epsilon = 1e-9
    if (delta == null || Number.isNaN(Number(delta)) || Math.abs(Number(delta)) <= epsilon) {
        return { label: 'No Change', className: 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800' }
    }
    if (Number(delta) > 0) {
        return { label: 'Improved', className: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40' }
    }
    return { label: 'Declined', className: 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40' }
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
                    <span class="text-xs font-black uppercase tracking-widest text-gray-400">Tabu Search Time</span>
                    <div class="flex items-end gap-2">
                        <span class="text-4xl font-black text-purple-600 dark:text-purple-400">{{ formatDuration(systemMetrics.tabuSearchMs) }}</span>
                    </div>
                </div>
            </template>
        </Card>
        <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
            <template #content>
                <div class="flex flex-col gap-1">
                    <span class="text-xs font-black uppercase tracking-widest text-gray-400">Tabu Score Delta %</span>
                    <div class="flex items-end gap-2">
                        <span
                            class="text-[10px] font-black px-2 py-0.5 rounded-full mb-2"
                            :class="getDeltaStatus(systemMetrics.globalScoreDelta).className"
                        >
                            {{ getDeltaStatus(systemMetrics.globalScoreDelta).label }}
                        </span>
                        <span
                            class="text-4xl font-black"
                            :class="(systemMetrics.globalScoreDelta || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
                            :title="props.systemMetrics.globalScoreBeforeTabu != null && props.systemMetrics.globalScoreAfterTabu != null
                                ? formatPercent(getScoreDeltaPercent(props.systemMetrics.globalScoreBeforeTabu, props.systemMetrics.globalScoreAfterTabu))
                                : ''"
                        >
                            {{ formatPercent(getScoreDeltaPercent(systemMetrics.globalScoreBeforeTabu, systemMetrics.globalScoreAfterTabu)) }}
                        </span>
                        <span class="text-xs font-bold text-gray-400 mb-1">
                            <span
                                :title="props.systemMetrics.globalScoreBeforeTabu != null && props.systemMetrics.globalScoreAfterTabu != null
                                    ? `${formatScoreFull(props.systemMetrics.globalScoreBeforeTabu)} -> ${formatScoreFull(props.systemMetrics.globalScoreAfterTabu)}`
                                    : ''"
                            >
                                {{ props.systemMetrics.globalScoreBeforeTabu != null && props.systemMetrics.globalScoreAfterTabu != null
                                    ? `${formatScoreCompact(props.systemMetrics.globalScoreBeforeTabu)} -> ${formatScoreCompact(props.systemMetrics.globalScoreAfterTabu)}`
                                    : '' }}
                            </span>
                            <span
                                v-if="props.systemMetrics.globalScoreBeforeTabu != null && props.systemMetrics.globalScoreAfterTabu != null"
                                class="block mt-0.5 text-[10px] font-semibold text-gray-400"
                            >
                                Pre-Tabu -> Post-Tabu
                            </span>
                            <span
                                v-if="systemMetrics.globalScoreDelta != null"
                                class="block mt-0.5 text-[10px] font-semibold text-gray-400"
                                :title="formatScoreFull(systemMetrics.globalScoreDelta)"
                            >
                                Raw: {{ formatScoreCompact(systemMetrics.globalScoreDelta) }}
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
