<script setup>
import { ref, onMounted, watch } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { CopyButton } from '../common'
import { store } from '../../store'
import { api } from '../../services/api'

const actionMenu = ref(null)
const actionItems = ref([
    {
        label: 'Simulation',
        items: [
            {
                label: 'Run Section Placement',
                icon: 'pi pi-play',
                command: () => runPlacement()
            },
            {
                label: 'Clear Placements',
                icon: 'pi pi-eraser',
                command: () => clearPlacements()
            },
            {
                label: 'Clear Students',
                icon: 'pi pi-user-minus',
                command: () => clearStudents()
            },
            {
                label: 'Clear All Locks',
                icon: 'pi pi-lock-open',
                command: () => clearLocks()
            },
            {
                label: 'Reload from DB',
                icon: 'pi pi-refresh',
                command: () => fetchData()
            }
        ]
    }
])

const toggleMenu = (event) => {
    actionMenu.value.toggle(event)
}

const fetchData = async () => {
    if (!store.selectedSchool || !store.selectedVersion) return
    
    store.loading = true
    store.error = null
    store.diagnostics = null
    try {
        store.localDataset = await api.fetchFullDataset(
            store.selectedSchool.school_id, 
            store.selectedVersion.schedule_version_id
        )
    } catch (e) {
        store.error = "Failed to fetch dataset: " + e.message
    } finally {
        store.loading = false
    }
}

const runPlacement = async () => {
    if (!store.localDataset) return
    
    store.loading = true
    store.error = null
    try {
        const result = await api.runSectionPlacement(store.localDataset)
        
        // Merge placement results into existing local dataset to preserve names and other metadata
        const placementMap = {}
        result.sections.forEach(ps => {
            placementMap[ps.section_id] = ps
        })
        
        store.localDataset.sections = store.localDataset.sections.map(s => {
            const ps = placementMap[s.sectionId]
            if (ps) {
                return {
                    ...s,
                    classroomId: ps.classroom_id,
                    room_name: ps.room_name || s.room_name,
                    coursePeriodIds: ps.course_period_ids || [],
                    quartersDays: ps.quarters_days,
                    quarters: ps.quarters || s.quarters,
                    days: ps.days || s.days,
                    student_count: ps.student_count ?? s.student_count,
                    scheduledStudentIds: ps.scheduled_student_ids || ps.scheduledStudentIds || s.scheduledStudentIds || []
                }
            }
            return s
        })
        store.diagnostics = result.diagnostics
    } catch (e) {
        store.error = "Failed to run placement: " + e.message
    } finally {
        store.loading = false
    }
}

const clearStudents = () => {
    store.localDataset.sections.forEach(s => {
        s.student_count = 0
        s.scheduledStudentIds = []
    })
}

const clearLocks = () => {
    store.localDataset.sections.forEach(s => {
        s.locked = 0
    })
}

const clearPlacements = () => {
    store.localDataset.sections.forEach(s => {
        if (!s.locked) {
            s.classroomId = undefined;
            s.room_name = 'N/A';
            s.days = '';
            s.coursePeriodIds = []
            s.quartersDays = undefined
            s.quarters = ""
        }
    })
    store.diagnostics = null
}

const fetchSchools = async () => {
    try {
        store.schools = await api.fetchSchools()
    } catch (e) {
        store.error = "Failed to fetch schools: " + e.message
    }
}

const fetchVersions = async () => {
    if (!store.selectedSchool) return
    try {
        store.versions = await api.fetchVersions(store.selectedSchool.school_id)
        store.selectedVersion = null
    } catch (e) {
        store.error = "Failed to fetch versions: " + e.message
    }
}

onMounted(() => {
    if (store.schools.length === 0) fetchSchools()
})

watch(() => store.selectedSchool, () => {
    fetchVersions()
})
</script>

<template>
    <div class="card bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-6 items-end justify-between">
        <div class="flex flex-wrap gap-6 items-end">
            <div class="flex flex-col gap-2">
                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">School</label>
                <Select v-model="store.selectedSchool" :options="store.schools" optionLabel="name" placeholder="Select a School" class="w-72" :disabled="store.loading">
                    <template #value="slotProps">
                        <div v-if="slotProps.value" class="flex items-center justify-between w-full pr-4">
                            <span>{{ slotProps.value.name }}</span>
                            <CopyButton v-if="store.showIds && slotProps.value.school_id != null" :value="slotProps.value.school_id" label="School ID" />
                        </div>
                        <span v-else>{{ slotProps.placeholder }}</span>
                    </template>
                    <template #option="slotProps">
                        <div class="flex items-center justify-between w-full">
                            <span>{{ slotProps.option.name }}</span>
                            <CopyButton v-if="store.showIds && slotProps.option.school_id != null" :value="slotProps.option.school_id" label="School ID" />
                        </div>
                    </template>
                </Select>
            </div>
            <div class="flex flex-col gap-2">
                <label class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Schedule Version</label>
                <Select v-model="store.selectedVersion" :options="store.versions" optionLabel="schedule_name" placeholder="Select a Version" :disabled="!store.selectedSchool || store.loading" :class="store.showIds ? 'w-[32rem]' : 'w-72'">
                    <template #value="slotProps">
                        <div v-if="slotProps.value" class="flex items-center justify-between w-full pr-4">
                            <span>{{ slotProps.value.schedule_name }}</span>
                            <span v-if="store.showIds" class="flex items-center gap-2">
                                <CopyButton v-if="slotProps.value.data_version_id != null" :value="slotProps.value.data_version_id" label="Data ID" class="!bg-amber-500/10 !text-amber-500 !border-amber-500/20" />
                                <CopyButton v-if="slotProps.value.schedule_version_id != null" :value="slotProps.value.schedule_version_id" label="Version ID" />
                            </span>
                        </div>
                        <span v-else>{{ slotProps.placeholder }}</span>
                    </template>
                    <template #option="slotProps">
                        <div class="flex items-center justify-between w-full">
                            <span>{{ slotProps.option.schedule_name }}</span>
                            <span v-if="store.showIds" class="flex items-center gap-2">
                                <CopyButton v-if="slotProps.value.data_version_id != null" :value="slotProps.value.data_version_id" label="Data ID" class="!bg-amber-500/10 !text-amber-500 !border-amber-500/20" />
                                <CopyButton v-if="slotProps.value.schedule_version_id != null" :value="slotProps.value.schedule_version_id" label="Version ID" />
                            </span>
                        </div>
                    </template>
                </Select>
            </div>
            <Button label="Load Schedule" icon="pi pi-refresh" :loading="store.loading" :disabled="!store.selectedVersion || store.loading" @click="fetchData" class="px-6" />
        </div>
        
        <div class="flex items-end">
            <Button type="button" icon="pi pi-bolt" label="Actions" @click="toggleMenu" aria-haspopup="true" aria-controls="overlay_menu" severity="secondary" outlined :disabled="!store.localDataset" />
            <Menu ref="actionMenu" id="overlay_menu" :model="actionItems" :popup="true" />
        </div>
    </div>
</template>
