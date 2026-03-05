<script setup>
import { computed } from 'vue'
import { store } from '../../store'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const stats = computed(() => {
    if (!store.localDataset) return null
    
    const sections = store.localDataset.sections || []
    const studentSeats = sections.reduce((sum, s) => sum + Number(s.student_count || 0), 0)
    
    return {
        studentSeats
    }
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
</template>
