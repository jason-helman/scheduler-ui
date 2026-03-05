<script setup>
import { computed, ref, watch } from 'vue'
import { store } from '../store'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Badge from 'primevue/badge'
import CopyButton from './CopyButton.vue'

const selectedUnplacedSection = ref(null)

const unplacedSections = computed(() => {
    if (!store.localDataset) return []
    return (store.localDataset.sections || [])
        .filter(s => !s.coursePeriodIds || s.coursePeriodIds.length === 0)
        .map(s => {
            const sectionDiagnostics = (store.diagnostics?.sectionPlacement || [])
                .filter(d => d.entityId === s.sectionId && d.entityType === 'section');
            return {
                ...s,
                diagnosticCount: sectionDiagnostics.length
            };
        })
})

const currentDiagnostics = computed(() => {
    if (!selectedUnplacedSection.value || !store.diagnostics) return []
    return (store.diagnostics.sectionPlacement || [])
        .filter(d => d.entityId === selectedUnplacedSection.value.sectionId && d.entityType === 'section')
})

// Sync selected section from store if it changes (external navigation)
watch([() => store.selectedSectionId, unplacedSections], ([newId, sections]) => {
    if (newId && sections.length > 0) {
        const found = sections.find(s => s.sectionId === newId)
        if (found && selectedUnplacedSection.value?.sectionId !== newId) {
            selectedUnplacedSection.value = found
        }
    }
}, { immediate: true })

// Also sync internal selection back to store to keep them in sync
watch(selectedUnplacedSection, (newSection) => {
    if (newSection && store.selectedSectionId !== newSection.sectionId) {
        store.selectedSectionId = newSection.sectionId
    }
})
</script>

<template>
    <div class="space-y-8">
        <div class="flex items-center justify-between mb-2">
            <h2 class="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Placement Diagnostics</h2>
            <div v-if="store.selectedVersion" class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                {{ store.selectedVersion.schedule_name }}
            </div>
        </div>

        <div v-if="!store.localDataset" class="py-20 text-center bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <i class="pi pi-search text-5xl text-gray-200 dark:text-gray-700 mb-4"></i>
            <p class="text-gray-400 dark:text-gray-500 font-medium">Load a schedule version to view diagnostics.</p>
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <div class="lg:col-span-1 card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                <div class="flex items-center justify-between mb-6 px-2">
                    <h3 class="text-xl font-black">Unplaced Sections</h3>
                    <Badge :value="unplacedSections.length" severity="secondary"></Badge>
                </div>
                <DataTable 
                    v-model:selection="selectedUnplacedSection" 
                    :value="unplacedSections" 
                    selectionMode="single" 
                    stripedRows 
                    paginator 
                    :rows="15" 
                    class="p-datatable-sm"
                    dataKey="sectionId"
                    scrollable
                    scrollHeight="calc(100vh - 350px)"
                >
                    <Column field="course_name" header="Course" sortable class="font-bold text-sm"></Column>
                    <Column field="teacher_name" header="Teacher" sortable class="text-xs"></Column>
                    <Column field="diagnosticCount" header="Issues" sortable style="width: 3rem">
                        <template #body="slotProps">
                            <Badge :value="slotProps.data.diagnosticCount" :severity="slotProps.data.diagnosticCount > 0 ? 'danger' : 'secondary'"></Badge>
                        </template>
                    </Column>
                </DataTable>
            </div>
            
            <div class="lg:col-span-2 card bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 class="text-xl font-black mb-6 px-2">Diagnostic Report</h3>
                
                <div v-if="!selectedUnplacedSection" class="flex flex-col items-center justify-center py-40 text-gray-400">
                    <i class="pi pi-search text-6xl mb-4 opacity-20"></i>
                    <p class="font-medium text-lg">Select an unplaced section to investigate conflicts.</p>
                </div>
                
                <div v-else class="space-y-6">
                    <div class="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <div class="flex flex-col gap-1">
                            <div class="flex items-center gap-3">
                                <h4 class="text-2xl font-black text-gray-900 dark:text-white">{{ selectedUnplacedSection.course_name }}</h4>
                                <div class="flex gap-2">
                                    <Tag v-if="selectedUnplacedSection.isLab" severity="success" value="Lab" />
                                    <Tag v-if="selectedUnplacedSection.isInclusion" severity="warning" value="Inclusion" />
                                </div>
                            </div>
                            <p class="text-gray-500 font-bold flex items-center gap-2">
                                <i class="pi pi-user text-xs"></i>
                                {{ selectedUnplacedSection.teacher_name }}
                            </p>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <CopyButton :value="selectedUnplacedSection.sectionId" label="Section ID" />
                            <div class="text-[10px] font-black uppercase text-gray-400">Section ID</div>
                        </div>
                    </div>

                    <div v-if="!store.diagnostics" class="p-12 text-center bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                        <i class="pi pi-exclamation-triangle text-5xl text-amber-500 mb-4"></i>
                        <p class="text-amber-700 dark:text-amber-400 font-bold text-lg mb-2">No Placement Diagnostics Available</p>
                        <p class="text-amber-600/70 dark:text-amber-500/70 text-sm">The scheduler diagnostics are generated when you run the placement simulation.</p>
                    </div>

                    <div v-else-if="currentDiagnostics.length === 0" class="p-12 text-center bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                        <i class="pi pi-check-circle text-5xl text-emerald-500 mb-4"></i>
                        <p class="text-emerald-700 dark:text-emerald-400 font-bold text-lg mb-2">No Conflicts Detected</p>
                        <p class="text-emerald-600/70 dark:text-emerald-500/70 text-sm">The scheduler was unable to place this section, but no specific conflict was recorded.</p>
                    </div>

                    <div v-else class="space-y-4">
                        <div class="flex items-center gap-2 px-2 text-red-500">
                            <i class="pi pi-exclamation-circle font-black"></i>
                            <span class="text-xs font-black uppercase tracking-widest">Recorded Placement Failures</span>
                        </div>
                        <div v-for="(diag, idx) in currentDiagnostics" :key="idx" class="flex gap-4 p-5 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/5 items-start transition-all hover:border-red-200 dark:hover:border-red-800">
                            <div class="mt-1">
                                <i class="pi pi-times-circle text-red-500 text-lg"></i>
                            </div>
                            <div class="text-sm font-bold text-red-700 dark:text-red-400 leading-relaxed">
                                {{ diag.message }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
