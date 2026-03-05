<script setup>
import { ref, onMounted, watch, computed, reactive } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Dialog from 'primevue/dialog'
import Badge from 'primevue/badge'
import Menu from 'primevue/menu'
import CopyButton from './CopyButton.vue'
import { store } from '../store'

const showUnplacedDialog = ref(false)
const selectedTeacherIdForUnplaced = ref(null)

const hoveredSection = ref(null)

// For navigating overlapping layers within a cell
const cellState = reactive({})
const getLayerIndex = (teacherId, periodId) => cellState[`${teacherId}_${periodId}`] || 0
const nextLayer = (teacherId, periodId, total) => {
    const key = `${teacherId}_${periodId}`
    cellState[key] = ((cellState[key] || 0) + 1) % total
}
const prevLayer = (teacherId, periodId, total) => {
    const key = `${teacherId}_${periodId}`
    cellState[key] = ((cellState[key] || 0) - 1 + total) % total
}

const getHighlightClass = (section) => {
    if (!hoveredSection.value) return ''
    const target = hoveredSection.value
    
    // Primary: Same identity (multi-course segment) or same span
    if (section.sectionId === target.sectionId || (target.spanId && section.spanId === target.spanId)) {
        return 'highlight-primary'
    }
    
    // Lab relationship: If target is a lab and current is related, or vice versa
    const isRelated = section.sectionId === target.sectionId || (target.spanId && section.spanId === target.spanId)
    if (isRelated && (section.isLab || target.isLab)) {
        return 'highlight-lab'
    }

    // Subsection: Parent, child, or sibling relationship
    const isSubsectionRel = 
        section.parentSectionId === target.sectionId || 
        target.parentSectionId === section.sectionId ||
        (target.parentSectionId && section.parentSectionId === target.parentSectionId)
        
    if (isSubsectionRel) {
        return 'highlight-subsection'
    }
    
    return ''
}

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

const selectedTeacherForUnplaced = computed(() => {
    if (!selectedTeacherIdForUnplaced.value) return null
    return scheduleData.value.find(t => t.teacherId === selectedTeacherIdForUnplaced.value)
})

const toggleLock = (sectionId) => {
    const section = store.localDataset.sections.find(s => s.sectionId === sectionId)
    if (section) {
        section.locked = section.locked ? 0 : 1
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

const fetchData = async () => {
    if (!store.selectedSchool || !store.selectedVersion) return
    
    store.loading = true
    store.error = null
    store.diagnostics = null
    try {
        const res = await fetch(`/api/full-dataset?schoolId=${store.selectedSchool.school_id}&svId=${store.selectedVersion.schedule_version_id}`)
        store.localDataset = await res.json()
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
        const res = await fetch('/api/place-sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataset: store.localDataset })
        })
        const result = await res.json()
        if (result.error) {
            store.error = result.error
        } else {
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
                        days: ps.days || s.days
                    }
                }
                return s
            })
            store.diagnostics = result.diagnostics
        }
    } catch (e) {
        store.error = "Failed to run placement: " + e.message
    } finally {
        store.loading = false
    }
}

const fetchSchools = async () => {
    try {
        const res = await fetch('/api/schools')
        store.schools = await res.json()
    } catch (e) {
        store.error = "Failed to fetch schools: " + e.message
    }
}

const fetchVersions = async () => {
    if (!store.selectedSchool) return
    try {
        const res = await fetch(`/api/versions?schoolId=${store.selectedSchool.school_id}`)
        store.versions = await res.json()
        store.selectedVersion = null
    } catch (e) {
        store.error = "Failed to fetch versions: " + e.message
    }
}

const openUnplacedSections = (teacher) => {
    if (teacher.unplacedSections && teacher.unplacedSections.length > 0) {
        selectedTeacherIdForUnplaced.value = teacher.teacherId
        showUnplacedDialog.value = true
    }
}

const goToDiagnostics = (section) => {
    store.selectedSectionId = section.sectionId
    store.currentView = 'Diagnostics'
    showUnplacedDialog.value = false
}

const getDiagnosticCount = (sectionId) => {
    if (!store.diagnostics?.sectionPlacement) return 0
    return store.diagnostics.sectionPlacement.filter(d => d.entityId === sectionId && d.entityType === 'section').length
}

onMounted(() => {
    if (store.schools.length === 0) fetchSchools()
})

watch(() => store.selectedSchool, () => {
    fetchVersions()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Selectors Card -->
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
                        <div v-if="slotProps.data.unplacedSections.length > 0" 
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
                    <div class="grid grid-rows-4 gap-1.5 min-h-[350px] relative p-3 items-stretch group/cell">
                        <!-- Quarter Separator Lines -->
                        <div v-for="q in 4" :key="'qline-' + q" class="absolute left-0 right-0 border-b border-gray-50 dark:border-gray-800/50 pointer-events-none" :style="{ top: ((q-1) * 25) + '%', height: '25%' }"></div>

                        <template v-if="(slotProps.data.periodLayers?.['period_' + p.coursePeriodId] || []).length > 0">
                            <!-- Layer Navigation Indicators -->
                            <div v-if="slotProps.data.periodLayers['period_' + p.coursePeriodId].length > 1" 
                                 class="absolute top-1 left-1/2 -translate-x-1/2 flex gap-1.5 z-[60]">
                                <div v-for="(_, dotIdx) in slotProps.data.periodLayers['period_' + p.coursePeriodId]" :key="'dot-' + dotIdx"
                                     :class="['w-1.5 h-1.5 rounded-full border border-white/20', dotIdx === getLayerIndex(slotProps.data.teacherId, p.coursePeriodId) ? 'bg-blue-500 shadow-sm' : 'bg-gray-200 dark:bg-gray-700']"></div>
                            </div>

                            <!-- Navigation Controls - Neatly pinned within the cell area -->
                            <div v-if="slotProps.data.periodLayers['period_' + p.coursePeriodId].length > 1" 
                                 class="absolute inset-x-1 top-1/2 -translate-y-1/2 flex items-center justify-between z-[70] pointer-events-none opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                <Button icon="pi pi-chevron-left" rounded severity="secondary" size="small" 
                                        class="!w-7 !h-7 !p-0 shadow-lg border border-gray-200 dark:border-gray-700 pointer-events-auto !bg-white/90 dark:!bg-gray-800/90"
                                        @click.stop="prevLayer(slotProps.data.teacherId, p.coursePeriodId, slotProps.data.periodLayers['period_' + p.coursePeriodId].length)" />
                                <Button icon="pi pi-chevron-right" rounded severity="secondary" size="small" 
                                        class="!w-7 !h-7 !p-0 shadow-lg border border-gray-200 dark:border-gray-700 pointer-events-auto !bg-white/90 dark:!bg-gray-800/90"
                                        @click.stop="nextLayer(slotProps.data.teacherId, p.coursePeriodId, slotProps.data.periodLayers['period_' + p.coursePeriodId].length)" />
                            </div>

                            <!-- Layer Rendering -->
                            <template v-for="(layerSections, lIdx) in slotProps.data.periodLayers['period_' + p.coursePeriodId]" :key="'layer-' + lIdx">
                                <template v-if="lIdx === getLayerIndex(slotProps.data.teacherId, p.coursePeriodId)">
                                    <template v-for="section in layerSections" :key="section.sectionId">
                                        <!-- Restriction Card -->
                                        <div v-if="section.isRestriction"
                                             :style="{ gridRow: '1 / 5' }"
                                             class="p-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-center opacity-60 z-10 w-full is-restriction">
                                            <div class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex flex-col items-center gap-1 text-center">
                                                <i class="pi pi-ban text-xs"></i>
                                                <span>Restricted</span>
                                            </div>
                                        </div>

                                        <!-- Regular Section Card -->
                                        <div v-else
                                             @mouseenter="hoveredSection = section"
                                             @mouseleave="hoveredSection = null"
                                             :style="{ 
                                                gridRow: `${section.startQ} / ${section.endQ + 1}`
                                             }"
                                             class="p-2.5 rounded-xl border bg-white dark:bg-gray-900 shadow-sm transition-all duration-200 hover:shadow-2xl hover:shadow-blue-500/30 flex flex-col justify-between overflow-hidden hover:overflow-visible z-10 w-full group/segment relative hover:z-[200] cursor-default ring-inset hover:ring-2 hover:ring-blue-500/50"
                                             :class="[
                                                section.locked ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10' : 'border-gray-100 dark:border-gray-700',
                                                section.isLab ? 'is-lab' : '',
                                                getHighlightClass(section)
                                             ]">
                                            
                                            <!-- Debug ID Overlay -->
                                            <div v-if="store.showIds" class="absolute inset-0 bg-blue-600/95 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover/segment:opacity-100 transition-opacity z-50 p-2">
                                                <div class="flex items-center justify-between w-full">
                                                    <span class="text-[8px] font-black text-blue-100 uppercase">Course</span>
                                                    <CopyButton v-if="section.courseId != null" :value="section.courseId" label="Course ID" class="!bg-white/20 !text-white !border-white/20 hover:!bg-white/30" />
                                                </div>
                                                <div class="flex items-center justify-between w-full">
                                                    <span class="text-[8px] font-black text-blue-100 uppercase">Section</span>
                                                    <CopyButton v-if="section.sectionId != null" :value="section.sectionId" label="Section ID" class="!bg-white/20 !text-white !border-white/20 hover:!bg-white/30" />
                                                </div>
                                                <div v-if="section.classroomId != null" class="flex items-center justify-between w-full">
                                                    <span class="text-[8px] font-black text-blue-100 uppercase">Room</span>
                                                    <CopyButton :value="section.classroomId" label="Room ID" class="!bg-white/20 !text-white !border-white/20 hover:!bg-white/30" />
                                                </div>
                                            </div>

                                            <div class="min-h-0 text-center">
                                                <div class="flex items-start justify-between gap-1">
                                                    <div class="text-[9px] font-black uppercase tracking-tighter line-clamp-1 leading-tight mb-0.5 flex-1"
                                                         :class="section.isLab ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'"
                                                         v-tooltip.top="section.course_name">
                                                        {{ section.course_name }}
                                                    </div>
                                                    <i :class="['pi cursor-pointer text-[10px] transition-colors', section.locked ? 'pi-lock text-amber-500' : 'pi-lock-open text-gray-300 hover:text-blue-400']" 
                                                       @click.stop="toggleLock(section.sectionId)"
                                                       v-tooltip.top="section.locked ? 'Unlock Placement' : 'Lock Placement'"></i>
                                                </div>
                                                <div v-if="section.quarterCount > 1 || section.days" class="text-[8px] text-gray-400 font-black space-y-0.5">
                                                    <div v-if="section.quarterCount > 1">Q: {{ section.quarters }}</div>
                                                    <div v-if="section.days" class="text-emerald-500 dark:text-emerald-400">D: {{ section.days }}</div>
                                                </div>
                                            </div>
                                            
                                            <div class="flex items-center justify-between mt-auto pt-1 border-t border-gray-50 dark:border-gray-800">
                                                <div class="flex items-center gap-1 text-[8px] text-gray-400 dark:text-gray-500 font-bold truncate flex-1">
                                                    <i class="pi pi-map-marker text-[7px]"></i>
                                                    {{ section.room_name }}
                                                </div>
                                                <div class="flex items-center gap-1 text-[8px] font-black text-gray-600 dark:text-gray-300">
                                                    <i class="pi pi-users text-[8px]"></i>
                                                    {{ section.student_count }}
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </template>
                            </template>
                        </template>
                    </div>
                </template>
            </Column>
        </DataTable>
    </div>

    <!-- Unplaced Dialog -->
    <Dialog v-model:visible="showUnplacedDialog" modal :header="'Unplaced Sections: ' + (selectedTeacherForUnplaced?.teacherName || '')" :style="{ width: '30rem' }" class="p-fluid">
        <div class="space-y-4 pt-2">
            <div v-for="section in selectedTeacherForUnplaced?.unplacedSections" :key="section.sectionId" 
                 class="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center group/segment relative"
                 :class="[ section.locked ? 'border-amber-200 bg-amber-50/30' : '', section.isLab ? 'border-emerald-100 bg-emerald-50/20' : '' ]">
                
                <div v-if="store.showIds" class="absolute inset-0 bg-blue-600/95 rounded-xl flex flex-col items-center justify-center gap-2 opacity-0 group-hover/segment:opacity-100 transition-opacity z-50 p-4">
                    <div class="flex items-center justify-between w-full max-w-[200px]">
                        <span class="text-xs font-black text-blue-100 uppercase">Course ID</span>
                        <CopyButton v-if="section.courseId != null" :value="section.courseId" label="Course ID" class="!bg-white/20 !text-white !border-white/20 hover:!bg-white/30" />
                    </div>
                    <div v-if="section.sectionId != null" class="flex items-center justify-between w-full max-w-[200px]">
                        <span class="text-xs font-black text-blue-100 uppercase">Section ID</span>
                        <CopyButton :value="section.sectionId" label="Section ID" class="!bg-white/20 !text-white !border-white/20 hover:!bg-white/30" />
                    </div>
                    <div v-if="section.classroomId != null" class="flex items-center justify-between w-full max-w-[200px]">
                        <span class="text-xs font-black text-blue-100 uppercase">Room ID</span>
                        <CopyButton :value="section.classroomId" label="Room ID" class="!bg-white/20 !text-white !border-white/20 hover:!bg-white/30" />
                    </div>
                </div>

                <div class="flex-1 min-w-0 py-1">
                    <div class="flex items-center gap-2">
                        <div class="text-sm font-black uppercase tracking-tight" :class="section.isLab ? 'text-emerald-600' : 'text-blue-600'">
                            {{ section.course_name }}
                        </div>
                        <i :class="['pi cursor-pointer text-xs transition-colors', section.locked ? 'pi-lock text-amber-500' : 'pi-lock-open text-gray-300 hover:text-blue-400']" 
                           @click.stop="toggleLock(section.sectionId)"
                           v-tooltip.top="section.locked ? 'Unlock' : 'Lock'"></i>
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 font-bold flex flex-col gap-0.5 mt-1">
                        <div>Quarters: {{ section.quarters || 'N/A' }}</div>
                        <div class="flex items-center gap-1">
                            <i class="pi pi-map-marker text-[10px]"></i>
                            <span>{{ section.room_name || 'No Room' }}</span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col gap-2 items-end">
                    <div class="flex items-center gap-2 text-sm font-black text-gray-700 dark:text-gray-200">
                        <i class="pi pi-users"></i>
                        {{ section.student_count }}
                    </div>
                    <Button 
                        v-if="getDiagnosticCount(section.sectionId) > 0"
                        size="small" 
                        severity="danger" 
                        outlined 
                        class="!text-[9px] !py-1.5 !px-2 !font-black uppercase tracking-tighter"
                        @click="goToDiagnostics(section)"
                    >
                        <i class="pi pi-exclamation-circle text-[10px]"></i>
                        <span>{{ getDiagnosticCount(section.sectionId) }} Issues</span>
                    </Button>
                </div>
            </div>
        </div>
        <template #footer>
            <Button label="Close" icon="pi pi-check" @click="showUnplacedDialog = false" text />
        </template>
    </Dialog>
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

.is-lab {
    border-color: #10b981 !important;
    background-color: #ecfdf5 !important;
}

.highlight-primary {
    outline: 3px solid #3b82f6 !important;
    border-color: #3b82f6 !important;
    background-color: #eff6ff !important;
    z-index: 20 !important;
    box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.4) !important;
}

.highlight-lab {
    outline: 3px solid #10b981 !important;
    border-color: #10b981 !important;
    background-color: #ecfdf5 !important;
    z-index: 20 !important;
    box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4) !important;
}

.highlight-subsection {
    outline: 3px solid #6366f1 !important;
    border-color: #6366f1 !important;
    background-color: #eef2ff !important;
    z-index: 20 !important;
    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4) !important;
}

.is-restriction {
    background-image: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(0, 0, 0, 0.03) 10px,
        rgba(0, 0, 0, 0.03) 20px
    );
}

.my-app-dark .is-restriction {
    background-image: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(255, 255, 255, 0.03) 10px,
        rgba(255, 255, 255, 0.03) 20px
    );
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

.my-app-dark .is-lab {
    border-color: #059669 !important;
    background-color: #064e3b !important;
}

.my-app-dark .highlight-primary {
    background-color: #1e3a8a !important;
}

.my-app-dark .highlight-lab {
    background-color: #064e3b !important;
}

.my-app-dark .highlight-subsection {
    background-color: #312e81 !important;
}
</style>
