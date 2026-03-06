<script setup>
import { store } from '../../store'
import { useDerivedSchedulerData } from '../../composables/useDerivedSchedulerData'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'
import { CopyButton } from '../common'

const { courseStats } = useDerivedSchedulerData()
</script>

<template>
    <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 h-full min-h-0 flex flex-col">
        <h3 class="text-xl font-black mb-6 px-2">Course Placement Status</h3>
        <div class="min-h-0 flex-1">
        <DataTable :value="courseStats" stripedRows class="p-datatable-sm" sortField="name" :sortOrder="1" scrollable scrollHeight="flex">
            <Column v-if="store.showIds" header="ID" style="width: 8%">
                <template #body="slotProps">
                    <CopyButton :value="slotProps.data.courseId" label="Course ID" />
                </template>
            </Column>
            <Column field="code" header="Code" sortable class="font-mono text-xs" style="width: 10%"></Column>
            <Column field="name" header="Course Name" sortable class="font-bold" style="width: 25%"></Column>
            <Column field="type" header="Type" sortable style="width: 10%">
                <template #body="slotProps">
                    <Tag :severity="slotProps.data.type === 'Inclusion' ? 'info' : 'secondary'" :value="slotProps.data.type" />
                </template>
            </Column>
            <Column field="placed" header="Placed Sections" sortable>
                <template #body="slotProps">
                    <span :class="slotProps.data.placed === slotProps.data.total ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'">
                        {{ slotProps.data.placed }} / {{ slotProps.data.total }}
                    </span>
                </template>
            </Column>
            <Column field="students" header="Students" sortable></Column>
            <Column field="avgSize" header="Avg. Size" sortable></Column>
            <Column header="Status" style="width: 15%">
                <template #body="slotProps">
                    <div class="flex items-center gap-3">
                        <ProgressBar :value="slotProps.data.total > 0 ? Math.round((slotProps.data.placed / slotProps.data.total) * 100) : 0" :showValue="false" class="flex-1 !h-1.5" />
                        <span class="text-xs font-bold w-10 text-right">{{ slotProps.data.total > 0 ? Math.round((slotProps.data.placed / slotProps.data.total) * 100) : 0 }}%</span>
                    </div>
                </template>
            </Column>
        </DataTable>
        </div>
    </div>
</template>
