<script setup>
import { store } from '../../store'
import { useDerivedSchedulerData } from '../../composables/useDerivedSchedulerData'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ProgressBar from 'primevue/progressbar'
import { CopyButton } from '../common'

const { periodLoad } = useDerivedSchedulerData()

const tableVirtualScrollerOptions = {
    itemSize: 40,
    numToleratedItems: 12,
    delay: 0,
    showLoader: false
}

const formatTime = (timeValue) => {
    if (!timeValue) return '-'
    return String(timeValue)
}
</script>

<template>
    <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 h-full min-h-0 flex flex-col">
        <h3 class="text-xl font-black mb-6 px-2">Period Load Analysis</h3>
        <div class="min-h-0 flex-1">
            <DataTable
                :value="periodLoad"
                stripedRows
                class="p-datatable-sm"
                sortField="startTime"
                :sortOrder="1"
                scrollable
                scrollHeight="flex"
                :virtualScrollerOptions="tableVirtualScrollerOptions"
            >
                <Column v-if="store.showIds" header="ID" style="width: 8%">
                    <template #body="slotProps">
                        <CopyButton :value="slotProps.data.periodId" label="Period ID" />
                    </template>
                </Column>
                <Column field="name" header="Period" sortable class="font-bold" style="width: 18%"></Column>
                <Column field="startTime" header="Time Window" sortable style="width: 16%">
                    <template #body="slotProps">
                        <span>{{ formatTime(slotProps.data.startTime) }} - {{ formatTime(slotProps.data.endTime) }}</span>
                    </template>
                </Column>
                <Column field="placedSections" header="Placed Sections" sortable style="width: 12%"></Column>
                <Column field="students" header="Students" sortable style="width: 10%"></Column>
                <Column field="teacherCount" header="Teachers" sortable style="width: 10%"></Column>
                <Column field="roomCount" header="Rooms" sortable style="width: 10%"></Column>
                <Column header="Relative Load" style="width: 16%">
                    <template #body="slotProps">
                        <div class="flex items-center gap-3">
                            <ProgressBar :value="slotProps.data.relativeLoadPct" :showValue="false" class="flex-1 !h-1.5" />
                            <span class="text-xs font-bold w-10 text-right">{{ slotProps.data.relativeLoadPct }}%</span>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
