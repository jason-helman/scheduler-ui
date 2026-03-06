<script setup>
import Card from 'primevue/card'

defineProps({
    systemMetrics: {
        type: Object,
        required: true
    }
})
</script>

<template>
    <div class="shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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
                            {{ systemMetrics.globalScoreBeforeTabu != null && systemMetrics.globalScoreAfterTabu != null ? `${systemMetrics.globalScoreBeforeTabu} -> ${systemMetrics.globalScoreAfterTabu}` : '' }}
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
