<script setup>
import { computed, ref } from 'vue'
import { store } from '../../store'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ProgressBar from 'primevue/progressbar'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { CopyButton } from '../common'

const activeRoomReportTab = ref('0')

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
    <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 h-full min-h-0 flex flex-col">
        <Tabs v-model:value="activeRoomReportTab" class="h-full min-h-0 flex flex-col">
            <TabList>
                <Tab value="0">Utilization</Tab>
                <Tab value="1">
                    Missing Rooms
                    <span class="ml-2 text-xs font-black text-red-500">{{ sectionsWithoutRoom.length }}</span>
                </Tab>
            </TabList>
            <TabPanels class="min-h-0 flex-1 overflow-hidden">
                <TabPanel value="0" class="h-full min-h-0 overflow-hidden !p-0">
                    <div class="min-h-0 h-full">
                    <DataTable :value="roomUsage" stripedRows class="p-datatable-sm" scrollable scrollHeight="flex">
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
                    </div>
                </TabPanel>
                <TabPanel value="1" class="h-full min-h-0 overflow-hidden !p-0">
                    <div v-if="sectionsWithoutRoom.length === 0" class="p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        No placed sections are missing classrooms.
                    </div>
                    <div v-else class="min-h-0 h-full">
                    <DataTable :value="sectionsWithoutRoom" stripedRows class="p-datatable-sm" scrollable scrollHeight="flex">
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
                </TabPanel>
            </TabPanels>
        </Tabs>
    </div>
</template>
