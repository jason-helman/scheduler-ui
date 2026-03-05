<script setup>
import { computed } from 'vue'
import { store } from '../store'
import Card from 'primevue/card'
import ProgressBar from 'primevue/progressbar'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import CourseReport from './reports/CourseReport.vue'
import TeacherReport from './reports/TeacherReport.vue'
import RoomReport from './reports/RoomReport.vue'
import StudentReport from './reports/StudentReport.vue'

const stats = computed(() => {
    if (!store.localDataset) return null
    
    const sections = store.localDataset.sections || []
    const total = sections.length
    const placedSections = sections.filter(s => s.coursePeriodIds && s.coursePeriodIds.length > 0 && s.quartersDays && s.quartersDays.length > 0);
    const placed = placedSections.length
    const placedWithoutRoom = placedSections.filter(s => !s.classroomId).length
    const locked = sections.filter(s => s.locked).length
    const labs = sections.filter(s => s.isLab).length
    const inclusion = sections.filter(s => s.isInclusion).length
    
    const totalRequests = (store.localDataset.studentRequests || []).length
    const studentSeats = sections.reduce((sum, s) => sum + Number(s.student_count || 0), 0)
    
    return {
        total,
        placed,
        unplaced: total - placed,
        placedWithoutRoom,
        locked,
        labs,
        inclusion,
        studentSeats,
        totalRequests,
        placementRate: total > 0 ? Math.round((placed / total) * 100) : 0,
        fulfillmentRate: totalRequests > 0 ? Math.round((studentSeats / totalRequests) * 100) : 0
    }
})
</script>

<template>
    <div class="space-y-8">
        <div class="flex items-center justify-between mb-2">
            <h2 class="text-3xl font-black tracking-tight text-gray-900 dark:text-white">System Reports</h2>
            <div v-if="store.selectedVersion" class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                {{ store.selectedVersion.schedule_name }}
            </div>
        </div>

        <div v-if="!store.localDataset" class="py-20 text-center bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <i class="pi pi-chart-bar text-5xl text-gray-200 dark:text-gray-700 mb-4"></i>
            <p class="text-gray-400 dark:text-gray-500 font-medium">Load a schedule version to view reports.</p>
        </div>

        <div v-else class="space-y-8 animate-in fade-in duration-500">
            <!-- Summary Stats -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
                    <template #content>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-black uppercase tracking-widest text-gray-400">Section Placement</span>
                            <div class="flex items-end gap-3">
                                <span class="text-4xl font-black text-blue-600 dark:text-blue-400">{{ stats.placementRate }}%</span>
                                <span class="text-sm font-bold text-gray-400 mb-1">({{ stats.placed }} / {{ stats.total }})</span>
                            </div>
                            <ProgressBar :value="stats.placementRate" :showValue="false" class="!h-1.5 mt-2" />
                        </div>
                    </template>
                </Card>
                <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
                    <template #content>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-black uppercase tracking-widest text-gray-400">Placed w/o Room</span>
                            <div class="flex items-end gap-3">
                                <span class="text-4xl font-black text-red-600 dark:text-red-400">{{ stats.placedWithoutRoom }}</span>
                                <span class="text-xs font-bold text-gray-400 mb-1">Sections</span>
                            </div>
                            <ProgressBar :value="stats.placed > 0 ? Math.round((stats.placedWithoutRoom / stats.placed) * 100) : 0" :showValue="false" class="!h-1.5 mt-2" severity="danger" />
                        </div>
                    </template>
                </Card>
                <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
                    <template #content>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-black uppercase tracking-widest text-gray-400">Student Fulfillment</span>
                            <div class="flex items-end gap-3">
                                <span class="text-4xl font-black text-purple-600 dark:text-purple-400">{{ stats.fulfillmentRate }}%</span>
                                <span class="text-sm font-bold text-gray-400 mb-1">({{ stats.studentSeats }} / {{ stats.totalRequests }})</span>
                            </div>
                            <ProgressBar :value="stats.fulfillmentRate" :showValue="false" class="!h-1.5 mt-2" />
                        </div>
                    </template>
                </Card>
                <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
                    <template #content>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-black uppercase tracking-widest text-gray-400">Total Sections</span>
                            <div class="flex items-baseline gap-2">
                                <span class="text-4xl font-black text-gray-900 dark:text-white">{{ stats.total }}</span>
                                <span class="text-xs font-bold text-gray-400">({{ stats.inclusion }} Inc.)</span>
                            </div>
                        </div>
                    </template>
                </Card>
                <Card class="!shadow-sm !rounded-2xl border border-gray-100 dark:border-gray-800">
                    <template #content>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-black uppercase tracking-widest text-gray-400">Special Sections</span>
                            <div class="flex items-baseline gap-4">
                                <div class="flex flex-col">
                                    <span class="text-2xl font-black text-emerald-500">{{ stats.labs }}</span>
                                    <span class="text-[10px] font-bold text-gray-400 uppercase">Labs</span>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-2xl font-black text-amber-500">{{ stats.locked }}</span>
                                    <span class="text-[10px] font-bold text-gray-400 uppercase">Locked</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>

            <Tabs v-model:value="store.activeReportTab">
                <TabList>
                    <Tab value="0">Courses</Tab>
                    <Tab value="1">Teachers</Tab>
                    <Tab value="2">Classrooms</Tab>
                    <Tab value="3">Students</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel value="0">
                        <CourseReport />
                    </TabPanel>
                    <TabPanel value="1">
                        <TeacherReport />
                    </TabPanel>
                    <TabPanel value="2">
                        <RoomReport />
                    </TabPanel>
                    <TabPanel value="3">
                        <StudentReport />
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </div>
    </div>
</template>
