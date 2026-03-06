<script setup>
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Badge from 'primevue/badge'
import { CopyButton } from '../common'

defineProps({
    validationDiagnostics: {
        type: Array,
        required: true
    },
    validationIssueCount: {
        type: Number,
        required: true
    },
    showIds: {
        type: Boolean,
        default: false
    },
    resolveIdName: {
        type: Function,
        required: true
    }
})
</script>

<template>
    <div class="h-full min-h-0 space-y-6">
        <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col min-h-0">
            <div class="flex items-center justify-between mb-6 px-2">
                <h3 class="text-xl font-black">Validation Diagnostics</h3>
                <Badge :value="validationDiagnostics.length" :severity="validationIssueCount > 0 ? 'danger' : 'secondary'" />
            </div>
            <div v-if="validationDiagnostics.length === 0" class="p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                No validation diagnostics were reported.
            </div>
            <DataTable
                v-else
                :value="validationDiagnostics"
                stripedRows
                class="p-datatable-sm"
                scrollable
                scrollHeight="flex"
            >
                <Column field="severity" header="Severity" sortable style="width: 8rem">
                    <template #body="slotProps">
                        <Tag
                            :value="slotProps.data.severity"
                            :severity="slotProps.data.severity === 'fatal' ? 'danger' : slotProps.data.severity === 'skip' ? 'warn' : 'secondary'"
                        />
                    </template>
                </Column>
                <Column field="code" header="Code" sortable style="width: 18rem" />
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
                <Column field="message" header="Message" />
            </DataTable>
        </div>
    </div>
</template>
