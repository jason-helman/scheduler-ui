<script setup>
import { store } from '../../store'
import { useDerivedSchedulerData } from '../../composables/useDerivedSchedulerData'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { CopyButton } from '../common'

const { teacherLoad } = useDerivedSchedulerData()

const tableVirtualScrollerOptions = {
    itemSize: 40,
    numToleratedItems: 12,
    delay: 0,
    showLoader: false
}
</script>

<template>
    <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 h-full min-h-0 flex flex-col">
        <h3 class="text-xl font-black mb-6 px-2">Teacher Load Analysis</h3>
        <div class="min-h-0 flex-1">
        <DataTable
            :value="teacherLoad"
            stripedRows
            class="p-datatable-sm"
            scrollable
            scrollHeight="flex"
            :virtualScrollerOptions="tableVirtualScrollerOptions"
        >
            <Column v-if="store.showIds" header="ID" style="width: 8%">
                <template #body="slotProps">
                    <CopyButton :value="slotProps.data.id" label="Teacher ID" />
                </template>
            </Column>
            <Column field="name" header="Teacher Name" sortable class="font-bold"></Column>
            <Column field="total" header="Total Assignments" sortable></Column>
            <Column field="labs" header="Labs" sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.labs > 0" class="text-emerald-500 font-bold">{{ slotProps.data.labs }}</span>
                    <span v-else class="text-gray-300 dark:text-gray-700">-</span>
                </template>
            </Column>
            <Column field="inclusion" header="Inc. Sections" sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.inclusion > 0" class="text-indigo-500 font-bold">{{ slotProps.data.inclusion }}</span>
                    <span v-else class="text-gray-300 dark:text-gray-700">-</span>
                </template>
            </Column>
            <Column field="students" header="Total Students" sortable></Column>
            <Column field="placed" header="Currently Placed" sortable></Column>
        </DataTable>
        </div>
    </div>
</template>
