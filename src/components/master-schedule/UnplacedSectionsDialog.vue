<script setup>
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import CopyButton from '../CopyButton.vue'
import { store } from '../../store'

const props = defineProps({
    visible: Boolean,
    teacherId: [Number, String]
})

const emit = defineEmits(['update:visible'])

const showDialog = computed({
    get: () => props.visible,
    set: (val) => emit('update:visible', val)
})

const teacher = computed(() => {
    if (!props.teacherId || !store.localDataset) return null
    const targetTeacherId = String(props.teacherId)
    
    // We need to re-derive the teacher data because the prop might just be an ID
    // or we can just find it in the already computed scheduleData from parent if we pass it,
    // but here we can just find the teacher in the store.
    const t = (store.localDataset.teachers || []).find(t => String(t.teacherId) === targetTeacherId)

    const unplacedSections = (store.localDataset.sections || [])
        .filter(s => {
            if (s.coursePeriodIds && s.coursePeriodIds.length > 0) return false

            const sectionTeacherIds = new Set(
                [
                    s.teacherId,
                    s.teacher_id,
                    ...(Array.isArray(s.teacherIds) ? s.teacherIds : []),
                    ...(Array.isArray(s.teacher_ids) ? s.teacher_ids : [])
                ]
                    .filter(id => id != null)
                    .map(id => String(id))
            )

            return sectionTeacherIds.has(targetTeacherId)
        })

    return {
        ...(t || { teacherId: props.teacherId, name: `Teacher ${props.teacherId}` }),
        unplacedSections
    }
})

const toggleLock = (sectionId) => {
    store.toggleLock(sectionId)
}

const goToDiagnostics = (section) => {
    store.selectedSectionId = section.sectionId
    store.currentView = 'Diagnostics'
    showDialog.value = false
}

const getDiagnosticCount = (sectionId) => {
    if (!store.diagnostics?.sectionPlacement) return 0
    return store.diagnostics.sectionPlacement.filter(d => d.entityId === sectionId && d.entityType === 'section').length
}
</script>

<template>
    <Dialog v-model:visible="showDialog" modal :header="'Unplaced Sections: ' + (teacher?.name || '')" :style="{ width: '30rem' }" class="p-fluid">
        <div class="space-y-4 pt-2">
            <div v-for="section in teacher?.unplacedSections" :key="section.sectionId" 
                 class="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center group/segment relative"
                 :class="[ section.locked ? 'border-amber-200 bg-amber-50/30' : '', section.isLab ? 'border-emerald-100 bg-emerald-50/20' : '' ]">
                
                <!-- Debug ID Overlay -->
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
            <Button label="Close" icon="pi pi-check" @click="showDialog = false" text />
        </template>
    </Dialog>
</template>
