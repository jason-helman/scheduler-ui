<script setup>
import { computed } from 'vue'
import { store } from '../../store'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'
import { CopyButton } from '../common'

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
</script>

<template>
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
</template>
