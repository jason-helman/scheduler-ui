<script setup>
import { computed } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Badge from 'primevue/badge'

const props = defineProps({
    rows: {
        type: Array,
        required: true
    }
})

const tableRows = 25

const pad2 = (value) => String(value).padStart(2, '0')

const formatDuration = (milliseconds) => {
    if (milliseconds == null || Number.isNaN(Number(milliseconds))) return '-'

    const totalMs = Math.max(0, Number(milliseconds))
    const totalSeconds = totalMs / 1000
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const secondsWithMs = seconds.toFixed(3).padStart(6, '0')

    if (hours > 0) return `${hours}:${pad2(minutes)}:${secondsWithMs}`
    if (minutes > 0) return `${minutes}:${secondsWithMs}`
    return `${seconds.toFixed(3)}s`
}

const formatMilliseconds = (milliseconds) => {
    if (milliseconds == null || Number.isNaN(Number(milliseconds))) return '-'
    return Number(milliseconds).toFixed(3)
}

const baselineTotalMs = computed(() => {
    const totalRunRow = (props.rows || []).find((row) => row.key === 'totalRunMs')
    if (totalRunRow && Number.isFinite(Number(totalRunRow.milliseconds))) {
        return Number(totalRunRow.milliseconds)
    }

    const sum = (props.rows || []).reduce((acc, row) => {
        const value = Number(row?.milliseconds)
        return Number.isFinite(value) ? acc + value : acc
    }, 0)
    return sum > 0 ? sum : 0
})

const formatRelativePercent = (row) => {
    if (row && row.shareOfTotal != null && Number.isFinite(Number(row.shareOfTotal))) {
        return `${(Number(row.shareOfTotal) * 100).toFixed(2)}%`
    }

    const value = Number(row?.milliseconds)
    if (!Number.isFinite(value) || baselineTotalMs.value <= 0) return '-'
    return `${((value / baselineTotalMs.value) * 100).toFixed(2)}%`
}
</script>

<template>
    <div class="h-full min-h-0 flex flex-col overflow-hidden">
        <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div class="flex items-center justify-between mb-6 px-2">
                <h3 class="text-xl font-black">Performance Timings</h3>
                <Badge :value="rows.length" severity="info" />
            </div>
            <div v-if="rows.length === 0" class="p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                No performance timings were emitted.
            </div>
            <div v-else class="min-h-0 flex-1 overflow-hidden">
                <DataTable
                    :value="rows"
                    stripedRows
                    class="p-datatable-sm h-full"
                    scrollable
                    scrollHeight="flex"
                    tableStyle="min-width: 52rem"
                    paginator
                    :rows="tableRows"
                    :rowsPerPageOptions="[25, 50, 100]"
                    paginatorTemplate="RowsPerPageDropdown PrevPageLink PageLinks NextPageLink CurrentPageReport"
                    currentPageReportTemplate="{first}-{last} of {totalRecords}"
                >
                    <Column field="label" header="Metric" sortable />
                    <Column header="Duration" sortable style="width: 14rem">
                        <template #body="slotProps">
                            <span class="font-semibold text-gray-900 dark:text-gray-100">{{ formatDuration(slotProps.data.milliseconds) }}</span>
                        </template>
                    </Column>
                    <Column header="Milliseconds" sortable style="width: 12rem">
                        <template #body="slotProps">
                            {{ formatMilliseconds(slotProps.data.milliseconds) }}
                        </template>
                    </Column>
                    <Column header="% of Total" sortable style="width: 10rem">
                        <template #body="slotProps">
                            {{ formatRelativePercent(slotProps.data) }}
                        </template>
                    </Column>
                    <Column field="key" header="Key" style="width: 16rem">
                        <template #body="slotProps">
                            <span class="text-xs text-gray-500 dark:text-gray-400">{{ slotProps.data.key }}</span>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>
</template>
