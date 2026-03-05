<script setup>
import { computed } from 'vue'
import { store } from '../../store'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ProgressBar from 'primevue/progressbar'
import { CopyButton } from '../common'

const roomUsage = computed(() => {
    if (!store.localDataset) return []
    
    const map = {}
    const sections = store.localDataset.sections || []
    sections.forEach(s => {
        if (s.classroomId && s.coursePeriodIds) {
            if (!map[s.classroomId]) {
                map[s.classroomId] = {
                    id: s.classroomId,
                    name: s.room_name || `Room ${s.classroomId}`,
                    assignedPeriods: 0
                }
            }
            const dayCount = (s.days || '').split(',').filter(Boolean).length || 1
            map[s.classroomId].assignedPeriods += (s.coursePeriodIds.length * dayCount)
        }
    })
    
    return Object.values(map).sort((a, b) => b.assignedPeriods - a.assignedPeriods)
})

const sectionsWithoutRoom = computed(() => {
    if (!store.localDataset) return []
    
    const periodMap = {}
    if (store.localDataset.coursePeriods) {
        store.localDataset.coursePeriods.forEach(cp => {
            periodMap[cp.coursePeriodId] = cp.name
        })
    }

    return (store.localDataset.sections || [])
        .filter(s => s.coursePeriodIds && s.coursePeriodIds.length > 0 && !s.classroomId)
        .map(s => ({
            ...s,
            periodNames: (s.coursePeriodIds || []).map(pid => periodMap[pid] || `P${pid}`).join(', ')
        }))
})
</script>

<template>
    <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 mt-4">
        <h3 class="text-xl font-black mb-6 px-2">Classroom Utilization</h3>
        <DataTable :value="roomUsage" stripedRows paginator :rows="10" class="p-datatable-sm">
            <Column v-if="store.showIds" header="ID" style="width: 8%">
                <template #body="slotProps">
                    <CopyButton :value="slotProps.data.id" label="Room ID" />
                </template>
            </Column>
            <Column field="name" header="Room Name" sortable class="font-bold"></Column>
            <Column field="assignedPeriods" header="Slots Occupied (Period-Days)" sortable></Column>
            <Column header="Relative Usage">
                <template #body="slotProps">
                    <ProgressBar :value="Math.min(100, Math.round((slotProps.data.assignedPeriods / 40) * 100))" :showValue="false" class="!h-1" />
                </template>
            </Column>
        </DataTable>

        <div v-if="sectionsWithoutRoom.length > 0" class="mt-12">
            <h3 class="text-xl font-black mb-6 px-2 text-red-500">Placed Sections Missing Classrooms</h3>
            <DataTable :value="sectionsWithoutRoom" stripedRows class="p-datatable-sm">
                <Column v-if="store.showIds" header="ID" style="width: 8%">
                    <template #body="slotProps">
                        <CopyButton :value="slotProps.data.sectionId" label="Section ID" />
                    </template>
                </Column>
                <Column field="courseCode" header="Code" class="font-mono text-xs" style="width: 10%"></Column>
                <Column field="course_name" header="Course Name" class="font-bold" style="width: 25%"></Column>
                <Column field="teacher_name" header="Teacher" style="width: 20%"></Column>
                <Column field="periodNames" header="Periods" style="width: 15%"></Column>
                <Column field="quarters" header="Quarters" style="width: 10%"></Column>
                <Column field="days" header="Days" style="width: 10%"></Column>
            </DataTable>
        </div>
    </div>
</template>
