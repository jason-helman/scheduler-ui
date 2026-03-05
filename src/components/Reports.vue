<script setup>
import { computed, ref, watch } from 'vue'
import { store } from '../store'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ProgressBar from 'primevue/progressbar'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import Badge from 'primevue/badge'
import CopyButton from './CopyButton.vue'

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

const courseStats = computed(() => {
    if (!store.localDataset) return []
    
    const map = {}
    
    // 1. Initialize map from ALL courses
    const courses = store.localDataset.courses || []
    courses.forEach(c => {
        map[c.courseId] = {
            id: c.courseId,
            name: c.name,
            code: c.courseCode,
            inc: { type: 'Inclusion', total: 0, placed: 0, students: 0, studentsInPlaced: 0 },
            gen: { type: 'Gen-Ed', total: 0, placed: 0, students: 0, studentsInPlaced: 0 }
        }
    })
    
    // 2. Process sections
    const sections = store.localDataset.sections || []
    sections.forEach(s => {
        if (!map[s.courseId]) return
        
        const isPlaced = s.coursePeriodIds && s.coursePeriodIds.length > 0
        const target = s.isInclusion ? map[s.courseId].inc : map[s.courseId].gen
        
        target.total++
        if (isPlaced) {
            target.placed++
            target.studentsInPlaced += Number(s.student_count || 0)
        }
    })

    // 3. Process requests for student counts
    const requests = store.localDataset.studentRequests || []
    requests.forEach(req => {
        if (map[req.courseId]) {
            const target = req.isInclusion ? map[req.courseId].inc : map[req.courseId].gen
            target.students++
        }
    })
    
    // 4. Flatten map into rows
    const rows = []
    Object.values(map).forEach(c => {
        if (c.inc.total > 0 || c.inc.students > 0) {
            rows.push({
                courseId: c.id,
                name: c.name,
                code: c.code,
                ...c.inc,
                avgSize: c.inc.placed > 0 ? (c.inc.studentsInPlaced / c.inc.placed).toFixed(1) : 0
            })
        }
        if (c.gen.total > 0 || c.gen.students > 0) {
            rows.push({
                courseId: c.id,
                name: c.name,
                code: c.code,
                ...c.gen,
                avgSize: c.gen.placed > 0 ? (c.gen.studentsInPlaced / c.gen.placed).toFixed(1) : 0
            })
        }
    })
    
    return rows.sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type))
})

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

const studentStats = computed(() => {
    if (!store.localDataset) return []
    
    const gradeMap = {}
    const students = store.localDataset.students || []
    students.forEach(st => {
        if (!gradeMap[st.grade]) gradeMap[st.grade] = { grade: st.grade, total: 0, inclusion: 0 }
        gradeMap[st.grade].total++
        if (st.inclusion) gradeMap[st.grade].inclusion++
    })
    
    return Object.values(gradeMap).sort((a, b) => a.grade.localeCompare(b.grade))
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
                        <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 mt-4">
                            <h3 class="text-xl font-black mb-6 px-2">Course Placement Status</h3>
                            <DataTable :value="courseStats" stripedRows paginator :rows="10" class="p-datatable-sm" sortField="name" :sortOrder="1">
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
                    </TabPanel>
                    <TabPanel value="1">
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
                    </TabPanel>
                    <TabPanel value="2">
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
                    </TabPanel>
                    <TabPanel value="3">
                        <div class="card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 mt-4">
                            <h3 class="text-xl font-black mb-6 px-2">Student Demographics</h3>
                            <DataTable :value="studentStats" stripedRows class="p-datatable-sm">
                                <Column field="grade" header="Grade Level" sortable class="font-bold"></Column>
                                <Column field="total" header="Total Students" sortable></Column>
                                <Column field="inclusion" header="Inclusion (IEP)" sortable>
                                    <template #body="slotProps">
                                        <span class="text-indigo-500 font-bold">{{ slotProps.data.inclusion }}</span>
                                        <span class="text-xs text-gray-400 ml-2">({{ Math.round((slotProps.data.inclusion / slotProps.data.total) * 100) }}%)</span>
                                    </template>
                                </Column>
                            </DataTable>
                            <div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                <div class="flex items-center gap-3">
                                    <i class="pi pi-info-circle text-blue-500"></i>
                                    <span class="text-sm font-medium text-blue-700 dark:text-blue-300">
                                        Total seats currently scheduled across all sections: <strong>{{ stats.studentSeats }}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </div>
    </div>
</template>
