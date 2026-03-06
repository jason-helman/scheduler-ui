<script setup>
import { useDerivedSchedulerData } from '../../composables/useDerivedSchedulerData'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const { studentStats, studentSeats } = useDerivedSchedulerData()
</script>

<template>
    <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 h-full min-h-0 flex flex-col">
        <h3 class="text-xl font-black mb-6 px-2">Student Demographics</h3>
        <div class="min-h-0 flex-1">
        <DataTable :value="studentStats" stripedRows class="p-datatable-sm" scrollable scrollHeight="flex">
            <Column field="grade" header="Grade Level" sortable class="font-bold"></Column>
            <Column field="total" header="Total Students" sortable></Column>
            <Column field="inclusion" header="Inclusion (IEP)" sortable>
                <template #body="slotProps">
                    <span class="text-indigo-500 font-bold">{{ slotProps.data.inclusion }}</span>
                    <span class="text-xs text-gray-400 ml-2">({{ Math.round((slotProps.data.inclusion / slotProps.data.total) * 100) }}%)</span>
                </template>
            </Column>
        </DataTable>
        </div>
        <div class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 shrink-0">
            <div class="flex items-center gap-3">
                <i class="pi pi-info-circle text-blue-500"></i>
                <span class="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Total seats currently scheduled across all sections: <strong>{{ studentSeats }}</strong>
                </span>
            </div>
        </div>
    </div>
</template>
