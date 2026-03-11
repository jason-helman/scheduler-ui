<script setup>
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Badge from 'primevue/badge'
import { CopyButton } from '../common'

defineProps({
    diagnostics: {
        type: Array,
        required: true
    },
    showIds: {
        type: Boolean,
        default: false
    },
    resolveIdName: {
        type: Function,
        required: true
    },
    getDiagnosticScope: {
        type: Function,
        required: true
    }
})

const tableRows = 100
</script>

<template>
    <div class="h-full min-h-0 flex flex-col overflow-hidden">
        <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div class="flex items-center justify-between mb-6 px-2">
                <h3 class="text-xl font-black">System Diagnostics</h3>
                <Badge :value="diagnostics.length" severity="info" />
            </div>
            <div v-if="diagnostics.length === 0" class="p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                There are currently no system diagnostics.
            </div>
            <div v-else class="min-h-0 flex-1 overflow-hidden">
                <DataTable
                    :value="diagnostics"
                    stripedRows
                    class="p-datatable-sm h-full"
                    scrollable
                    scrollHeight="flex"
                    tableStyle="min-width: 72rem"
                    paginator
                    :rows="tableRows"
                    :rowsPerPageOptions="[50, 100, 250]"
                    paginatorTemplate="RowsPerPageDropdown PrevPageLink PageLinks NextPageLink CurrentPageReport"
                    currentPageReportTemplate="{first}-{last} of {totalRecords}"
                >
                    <Column header="Scope" style="width: 9rem">
                        <template #body="slotProps">
                            {{ getDiagnosticScope(slotProps.data) }}
                        </template>
                    </Column>
                    <Column field="severity" header="Level" sortable style="width: 8rem" />
                    <Column field="category" header="Category" sortable style="width: 10rem" />
                    <Column field="entityType" header="Type" sortable style="width: 8rem" />
                    <Column field="entityId" header="Entity" sortable style="width: 16rem">
                        <template #body="slotProps">
                            <div class="flex items-center gap-2">
                                <span class="text-xs">{{ resolveIdName(slotProps.data.entityId) }}</span>
                                <CopyButton
                                    v-if="showIds && slotProps.data.entityId != null"
                                    :value="slotProps.data.entityId"
                                    label="Entity ID"
                                />
                            </div>
                        </template>
                    </Column>
                    <Column field="code" header="Code" sortable style="width: 14rem" />
                    <Column field="message" header="Message">
                        <template #body="slotProps">
                            <span class="whitespace-normal break-words">{{ slotProps.data.message }}</span>
                        </template>
                    </Column>
                    <Column header="Metrics" style="width: 20rem">
                        <template #body="slotProps">
                            <div v-if="slotProps.data.metrics && Object.keys(slotProps.data.metrics).length > 0" class="text-xs text-gray-700 dark:text-gray-300">
                                <div v-for="([k, v], idx) in Object.entries(slotProps.data.metrics)" :key="idx">{{ k }}: {{ v }}</div>
                            </div>
                            <span v-else class="text-xs text-gray-400">-</span>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>
</template>
