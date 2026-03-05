<script setup>
import { store } from '../store'
import CopyButton from './CopyButton.vue'

const props = defineProps({
    section: Object,
    hoveredSection: Object
})

const emit = defineEmits(['hover', 'leave', 'toggle-lock'])

const getHighlightClass = (section, target) => {
    if (!target) return ''
    
    const isRelated = section.sectionId === target.sectionId || (target.spanId && section.spanId === target.spanId)

    if (isRelated) {
        return section.isLab ? 'highlight-lab' : 'highlight-primary'
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
</script>

<template>
    <div
         @mouseenter="emit('hover', section)"
         @mouseleave="emit('leave')"
         :style="{ 
            gridRow: `${section.startQ} / ${section.endQ + 1}`
         }"
         class="p-2.5 rounded-xl border bg-white dark:bg-gray-900 shadow-sm transition-all duration-200 hover:shadow-2xl hover:shadow-blue-500/30 flex flex-col justify-between overflow-hidden hover:overflow-visible z-10 w-full group/segment relative hover:z-[200] cursor-default ring-inset hover:ring-2 hover:ring-blue-500/50"
         :class="[
            section.locked ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10' : 'border-gray-100 dark:border-gray-700',
            section.isLab ? 'is-lab' : '',
            getHighlightClass(section, hoveredSection)
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
                   @click.stop="emit('toggle-lock', section.sectionId)"
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

<style scoped>
.is-lab {
    border-color: #10b981 !important;
    background-color: #ecfdf5 !important;
}

.my-app-dark .is-lab {
    border-color: #059669 !important;
    background-color: #064e3b !important;
}

.highlight-primary {
    outline: 3px solid #3b82f6 !important;
    border-color: #3b82f6 !important;
    background-color: #eff6ff !important;
    z-index: 20 !important;
    box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.4) !important;
}

.my-app-dark .highlight-primary {
    background-color: #1e3a8a !important;
}

.highlight-lab {
    outline: 3px solid #10b981 !important;
    border-color: #10b981 !important;
    background-color: #ecfdf5 !important;
    z-index: 20 !important;
    box-shadow: 0 0 20px 5px rgba(16, 185, 129, 0.5) !important;
}

.my-app-dark .highlight-lab {
    background-color: #064e3b !important;
    box-shadow: 0 0 25px 8px rgba(16, 185, 129, 0.3) !important;
}

.highlight-subsection {
    outline: 3px solid #6366f1 !important;
    border-color: #6366f1 !important;
    background-color: #eef2ff !important;
    z-index: 20 !important;
    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4) !important;
}

.my-app-dark .highlight-subsection {
    background-color: #312e81 !important;
}
</style>
