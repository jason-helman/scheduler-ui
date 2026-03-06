<script setup>
import { computed } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Badge from 'primevue/badge'

const props = defineProps({
    rows: {
        type: Array,
        required: true
    },
    summary: {
        type: Object,
        default: null
    },
    teacherBreakRows: {
        type: Array,
        default: () => []
    },
    teacherBreakSummary: {
        type: Object,
        default: null
    }
})

const overloadedCount = computed(() => props.rows.filter((row) => row.loadIndex > 1.15).length)
const underusedCount = computed(() => props.rows.filter((row) => row.loadIndex < 0.85).length)
const mostBreakHeavyPeriod = computed(() => {
    if (!props.teacherBreakRows.length) return null
    return [...props.teacherBreakRows].sort((a, b) => b.teacherBreakCount - a.teacherBreakCount)[0]
})
const tableRows = 25

const formatPercent = (value) => {
    const pct = Number(value || 0) * 100
    const rounded = Math.round(pct * 1000) / 1000
    if (pct > 0 && rounded === 0) return '<0.001%'
    return `${rounded.toFixed(3)}%`
}
const formatNumber = (value, digits = 2) => Number(value || 0).toFixed(digits)
const loadIndexClass = (value) => {
    if (value > 1.15) return 'text-red-600 dark:text-red-400 font-bold'
    if (value < 0.85) return 'text-amber-600 dark:text-amber-400 font-bold'
    return 'text-emerald-600 dark:text-emerald-400 font-semibold'
}
</script>

<template>
    <div class="h-full min-h-0 flex flex-col gap-4 overflow-hidden">
        <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 min-h-0 flex-1 flex flex-col overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4 px-2">
                <h3 class="text-xl font-black">Opportunity-Adjusted Period Load</h3>
                <div class="flex items-center gap-2">
                    <Badge :value="`Rows ${rows.length}`" severity="info" />
                    <Badge :value="`Over ${overloadedCount}`" :severity="overloadedCount > 0 ? 'danger' : 'secondary'" />
                    <Badge :value="`Under ${underusedCount}`" :severity="underusedCount > 0 ? 'warn' : 'secondary'" />
                </div>
            </div>

            <div v-if="summary" class="mb-4 px-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                Imbalance Score: <span class="font-black text-gray-900 dark:text-white">{{ formatNumber(summary.imbalanceScore, 4) }}</span>
                <span class="mx-2">|</span>
                Periods: <span class="font-black text-gray-900 dark:text-white">{{ summary.periodCount }}</span>
            </div>

            <div v-if="rows.length === 0" class="p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                No opportunity-adjusted period diagnostics were emitted.
            </div>
            <div v-else class="min-h-0 flex-1 overflow-hidden">
                <DataTable
                    :value="rows"
                    stripedRows
                    class="p-datatable-sm h-full"
                    scrollable
                    scrollHeight="flex"
                    tableStyle="min-width: 76rem"
                    paginator
                    :rows="tableRows"
                    :rowsPerPageOptions="[25, 50, 100]"
                    paginatorTemplate="RowsPerPageDropdown PrevPageLink PageLinks NextPageLink CurrentPageReport"
                    currentPageReportTemplate="{first}-{last} of {totalRecords}"
                >
                    <Column header="Time Window" style="width: 13rem">
                        <template #body="slotProps">
                            {{ slotProps.data.startTime }} - {{ slotProps.data.endTime }}
                        </template>
                    </Column>
                    <Column field="periodId" header="Period ID" sortable style="width: 9rem" />
                    <Column field="opportunityCount" header="Opportunity" sortable style="width: 8rem" />
                    <Column field="assignedCount" header="Assigned" sortable style="width: 8rem" />
                    <Column header="Opportunity %" sortable style="width: 10rem">
                        <template #body="slotProps">
                            {{ formatPercent(slotProps.data.opportunityShare) }}
                        </template>
                    </Column>
                    <Column header="Assigned %" sortable style="width: 10rem">
                        <template #body="slotProps">
                            {{ formatPercent(slotProps.data.assignedShare) }}
                        </template>
                    </Column>
                    <Column header="Delta %" sortable style="width: 9rem">
                        <template #body="slotProps">
                            {{ formatPercent(slotProps.data.deltaShare) }}
                        </template>
                    </Column>
                    <Column header="Target Assigned" sortable style="width: 10rem">
                        <template #body="slotProps">
                            {{ formatNumber(slotProps.data.targetAssigned, 2) }}
                        </template>
                    </Column>
                    <Column header="Load Index" sortable style="width: 9rem">
                        <template #body="slotProps">
                            <span :class="loadIndexClass(slotProps.data.loadIndex)">
                                {{ formatNumber(slotProps.data.loadIndex, 3) }}
                            </span>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 min-h-0 flex-1 flex flex-col overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4 px-2">
                <h3 class="text-xl font-black">Teacher Break Concentration</h3>
                <div class="flex items-center gap-2">
                    <Badge :value="`Rows ${teacherBreakRows.length}`" severity="info" />
                    <Badge v-if="mostBreakHeavyPeriod" :value="`Max ${mostBreakHeavyPeriod.teacherBreakCount}`" severity="contrast" />
                </div>
            </div>

            <div v-if="teacherBreakSummary" class="mb-4 px-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                Concentration Index: <span class="font-black text-gray-900 dark:text-white">{{ formatNumber(teacherBreakSummary.breakConcentrationIndex, 4) }}</span>
                <span class="mx-2">|</span>
                Total Breaks: <span class="font-black text-gray-900 dark:text-white">{{ teacherBreakSummary.totalTeacherBreaks }}</span>
            </div>

            <div v-if="teacherBreakRows.length === 0" class="p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                No teacher break diagnostics were emitted.
            </div>
            <div v-else class="min-h-0 flex-1 overflow-hidden">
                <DataTable
                    :value="teacherBreakRows"
                    stripedRows
                    class="p-datatable-sm h-full"
                    scrollable
                    scrollHeight="flex"
                    tableStyle="min-width: 62rem"
                    paginator
                    :rows="tableRows"
                    :rowsPerPageOptions="[25, 50, 100]"
                    paginatorTemplate="RowsPerPageDropdown PrevPageLink PageLinks NextPageLink CurrentPageReport"
                    currentPageReportTemplate="{first}-{last} of {totalRecords}"
                >
                    <Column header="Time Window" style="width: 13rem">
                        <template #body="slotProps">
                            {{ slotProps.data.startTime }} - {{ slotProps.data.endTime }}
                        </template>
                    </Column>
                    <Column field="periodId" header="Period ID" sortable style="width: 9rem" />
                    <Column field="teacherBreakCount" header="Break Count" sortable style="width: 9rem" />
                    <Column field="teacherWithBreakCount" header="Teachers" sortable style="width: 8rem" />
                    <Column header="Break Share %" sortable style="width: 10rem">
                        <template #body="slotProps">
                            {{ formatPercent(slotProps.data.teacherBreakShare) }}
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>
</template>
