<script setup>
import { computed } from 'vue'
import { store } from '../../store'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import CopyButton from '../CopyButton.vue'

const teacherLoad = computed(() => {
    if (!store.localDataset) return []
    
    const map = {}
    const sections = store.localDataset.sections || []
    sections.forEach(s => {
        if (!map[s.teacherId]) {
            map[s.teacherId] = {
                id: s.teacherId,
                name: s.teacher_name,
                total: 0,
                placed: 0,
                labs: 0,
                inclusion: 0,
                students: 0
            }
        }
        map[s.teacherId].total++
        if (s.coursePeriodIds && s.coursePeriodIds.length > 0) {
            map[s.teacherId].placed++
        }
        if (s.isLab) map[s.teacherId].labs++
        if (s.isInclusion) map[s.teacherId].inclusion++
        map[s.teacherId].students += Number(s.student_count || 0)
    })
    
    return Object.values(map).sort((a, b) => b.total - a.total)
})
</script>

<template>
    <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 mt-4">
        <h3 class="text-xl font-black mb-6 px-2">Teacher Load Analysis</h3>
        <DataTable :value="teacherLoad" stripedRows paginator :rows="10" class="p-datatable-sm">
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
</template>
