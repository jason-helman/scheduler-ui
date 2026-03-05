<script setup>
import { ref, computed } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Badge from 'primevue/badge'
import CopyButton from './CopyButton.vue'
import ScheduleSelector from './ScheduleSelector.vue'
import UnplacedSectionsDialog from './UnplacedSectionsDialog.vue'
import ScheduleCell from './ScheduleCell.vue'
import { store } from '../store'

const showUnplacedDialog = ref(false)
const selectedTeacherIdForUnplaced = ref(null)
const hoveredSection = ref(null)

const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':')
    const hours = parseInt(h)
    const suffix = hours >= 12 ? 'pm' : 'am'
    const displayHours = ((hours + 11) % 12 + 1).toString().padStart(2, '0')
    return `${displayHours}:${m}${suffix}`
}

// Periods derived from local dataset
const periods = computed(() => {
    if (!store.localDataset || !store.localDataset.scheduleStructure) return []
    const periodMap = {}
    store.localDataset.scheduleStructure.forEach(ss => {
        if (!periodMap[ss.coursePeriodId]) {
            periodMap[ss.coursePeriodId] = {
                coursePeriodId: ss.coursePeriodId,
                name: ss.name || `P${ss.coursePeriodId}`,
                startTime: ss.startTime,
                endTime: ss.endTime
            }
        }
    })
    return Object.values(periodMap).sort((a, b) => a.coursePeriodId - b.coursePeriodId)
})

// Transform raw sections from local dataset into the teacher-grouped view with intelligent layers
const scheduleData = computed(() => {
    if (!store.localDataset) return []
    
    const teacherMap = {}

    // Initialize teacher map from teachers list if available to include those without sections and capture restrictions
    if (store.localDataset.teachers) {
        store.localDataset.teachers.forEach(t => {
            teacherMap[t.teacherId] = {
                teacherName: t.name,
                teacherId: t.teacherId,
                unplacedSections: [],
                periodRawSections: {},
                restrictedCoursePeriods: t.restrictedCoursePeriods || []
            }
        })
    }

    if (store.localDataset.sections) {
        store.localDataset.sections.forEach(s => {
            if (!teacherMap[s.teacherId]) {
                teacherMap[s.teacherId] = {
                    teacherName: s.teacher_name,
                    teacherId: s.teacherId,
                    unplacedSections: [],
                    periodRawSections: {},
                    restrictedCoursePeriods: []
                }
            }
            
            const qArray = s.quarters ? s.quarters.split(',').map(n => parseInt(n)) : [1, 2, 3, 4]
            const sectionData = {
                ...s,
                startQ: qArray.length ? Math.min(...qArray) : 1,
                endQ: qArray.length ? Math.max(...qArray) : 4,
                quarterCount: qArray.length
            }
            
            if (!s.coursePeriodIds || s.coursePeriodIds.length === 0) {
                teacherMap[s.teacherId].unplacedSections.push(sectionData)
            } else if (Array.isArray(s.coursePeriodIds)) {
                s.coursePeriodIds.forEach(pid => {
                    if (!teacherMap[s.teacherId].periodRawSections[pid]) {
                        teacherMap[s.teacherId].periodRawSections[pid] = []
                    }
                    teacherMap[s.teacherId].periodRawSections[pid].push(sectionData)
                })
            }
        })
    }

    const result = Object.values(teacherMap).map(teacher => {
        const periodLayers = {}
        
        // Add restrictions to raw sections for layer processing
        teacher.restrictedCoursePeriods.forEach(pid => {
            if (!teacher.periodRawSections[pid]) {
                teacher.periodRawSections[pid] = []
            }
            teacher.periodRawSections[pid].push({
                sectionId: `restriction-${teacher.teacherId}-${pid}`,
                isRestriction: true,
                startQ: 1,
                endQ: 4,
                quarterCount: 4,
                course_name: 'RESTRICTED'
            })
        })

        Object.entries(teacher.periodRawSections).forEach(([pid, sections]) => {
            const sorted = [...sections].sort((a, b) => {
                // Restrictions always go last in the processing order to ensure they end up in the final layer
                if (a.isRestriction !== b.isRestriction) {
                    return a.isRestriction ? 1 : -1
                }
                return (b.quarterCount - a.quarterCount) || (a.startQ - b.startQ)
            })
            const layers = []
            sorted.forEach(s => {
                let placed = false
                for (let layer of layers) {
                    const hasOverlap = layer.some(ls => !(s.endQ < ls.startQ || ls.endQ < s.startQ))
                    if (!hasOverlap) {
                        layer.push(s)
                        placed = true
                        break
                    }
                }
                if (!placed) layers.push([s])
            })
            periodLayers[`period_${pid}`] = layers.map(l => l.sort((a, b) => a.startQ - b.startQ))
        })
        return {
            ...teacher,
            periodLayers
        }
    })

    return result.sort((a, b) => a.teacherName.localeCompare(b.teacherName))
})

const openUnplacedSections = (teacher) => {
    if (teacher.unplacedSections && teacher.unplacedSections.length > 0) {
        selectedTeacherIdForUnplaced.value = teacher.teacherId
        showUnplacedDialog.value = true
    }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Selectors -->
    <ScheduleSelector />

    <Message v-if="store.error" severity="error" class="shadow-sm">{{ store.error }}</Message>

    <!-- Data Table Card -->
    <div class="card bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="flex items-center justify-between mb-6 px-2">
            <h2 class="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Master Schedule</h2>
            <div v-if="store.selectedVersion" class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                {{ store.selectedVersion.schedule_name }}
            </div>
        </div>
        
        <DataTable :value="scheduleData" :loading="store.loading" stripedRows scrollable scrollHeight="65vh" tableStyle="min-width: 80rem; table-layout: fixed" class="p-datatable-sm master-table">
            <template #empty>
                <div class="py-20 text-center">
                    <i class="pi pi-inbox text-5xl text-gray-200 dark:text-gray-700 mb-4"></i>
                    <p class="text-gray-400 dark:text-gray-500 font-medium">No data found for this version.</p>
                </div>
            </template>
            <Column field="teacherName" header="Teacher" frozen class="font-bold teacher-col" style="width: 150px">
                <template #body="slotProps">
                    <div class="flex flex-col gap-1 py-1">
                        <div class="flex items-start justify-between gap-1">
                            <span class="truncate leading-tight text-[11px] text-gray-900 dark:text-gray-100" v-tooltip.top="slotProps.data.teacherName">
                                {{ slotProps.data.teacherName }}
                            </span>
                            <CopyButton v-if="store.showIds && slotProps.data.teacherId != null" :value="slotProps.data.teacherId" label="Teacher ID" />
                        </div>
                        <div v-if="(slotProps.data.unplacedSections || []).length > 0" 
                             class="flex items-center gap-1.5 animate-pulse cursor-pointer hover:opacity-80 transition-opacity"
                             @click="openUnplacedSections(slotProps.data)">
                            <Badge :value="slotProps.data.unplacedSections.length" severity="danger" class="!text-[8px] !min-w-[1.2rem] !h-[1.2rem]"></Badge>
                            <span class="text-[9px] font-black text-red-500 uppercase tracking-tighter hover:underline">Unplaced</span>
                        </div>
                    </div>
                </template>
            </Column>
            <Column v-for="p in periods" :key="p.coursePeriodId" class="text-gray-900 dark:text-gray-100 align-top" style="min-width: 200px; width: auto">
                <template #header>
                    <div class="flex flex-col items-center w-full group/period">
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] font-black">{{ p.name }}</span>
                            <CopyButton v-if="store.showIds && p.coursePeriodId != null" :value="p.coursePeriodId" label="Period ID" />
                        </div>
                        <span v-if="p.startTime" class="text-[9px] font-bold opacity-60 tracking-normal normal-case mt-0.5">
                            {{ formatTime(p.startTime) }} - {{ formatTime(p.endTime) }}
                        </span>
                    </div>
                </template>
                <template #body="slotProps">
                    <ScheduleCell 
                        :teacher="slotProps.data" 
                        :period-id="p.coursePeriodId" 
                        :hovered-section="hoveredSection"
                        @hover="s => hoveredSection = s"
                        @leave="() => hoveredSection = null"
                        @toggle-lock="id => store.toggleLock(id)"
                    />
                </template>
            </Column>
        </DataTable>
    </div>

    <!-- Unplaced Dialog -->
    <UnplacedSectionsDialog 
        v-model:visible="showUnplacedDialog" 
        :teacher-id="selectedTeacherIdForUnplaced" 
    />
  </div>
</template>

<style scoped>
:deep(.p-datatable-thead) {
    position: sticky !important;
    top: 0 !important;
    z-index: 100 !important;
}

:deep(.p-datatable-thead > tr > th) {
    background-color: #f8fafc !important;
    color: #475569 !important;
    border-color: #e2e8f0 !important;
    font-size: 0.75rem !important;
    font-weight: 900 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
    border-bottom-width: 2px !important;
    border-right-width: 1px !important;
    padding: 0.75rem 0.5rem !important;
    text-align: center !important;
}

:deep(.p-datatable-thead > tr > th:last-child) {
    border-right-width: 0 !important;
}

:deep(.p-datatable-tbody > tr > td.p-frozen-column) {
    border-right: 3px solid #cbd5e1 !important;
    z-index: 20 !important;
}

:deep(.p-datatable-thead > tr > th.p-frozen-column) {
    background-color: #f8fafc !important;
    border-right: 3px solid #cbd5e1 !important;
    z-index: 110 !important;
    text-align: left !important;
    box-shadow: 4px 0 8px -4px rgba(0,0,0,0.1);
}

:deep(.p-datatable-tbody > tr > td) {
    padding: 0 !important;
}
</style>

<style>
.my-app-dark .master-table .p-datatable-thead > tr > th,
.my-app-dark .master-table .p-datatable-thead > tr > th.p-frozen-column {
    background-color: #0f172a !important;
    color: #94a3b8 !important;
    border-color: #1e293b !important;
}

.my-app-dark .master-table .p-datatable-thead > tr > th.p-frozen-column,
.my-app-dark .master-table .p-datatable-tbody > tr > td.p-frozen-column {
    border-right: 3px solid #334155 !important;
    box-shadow: 4px 0 12px -4px rgba(0,0,0,0.5);
}
</style>
