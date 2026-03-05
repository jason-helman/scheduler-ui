<script setup>
import { computed } from 'vue'
import Dialog from 'primevue/dialog'

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    section: {
        type: Object,
        required: true
    },
    scheduledStudents: {
        type: Array,
        default: () => []
    }
})

const emit = defineEmits(['update:visible'])

const showDialog = computed({
    get: () => props.visible,
    set: value => emit('update:visible', value)
})
</script>

<template>
    <Dialog
        v-if="showDialog"
        v-model:visible="showDialog"
        modal
        :header="`${section.course_name} · Students`"
        :style="{ width: '26rem' }"
        :dismissableMask="true"
    >
        <div class="max-h-[55vh] overflow-y-auto pr-1 space-y-1.5">
            <div
                v-for="st in scheduledStudents"
                :key="st.studentId || st.student_id || st.id || st._displayName"
                class="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 bg-gray-50 dark:bg-gray-800/60"
            >
                <span class="truncate text-xs font-semibold text-gray-700 dark:text-gray-300">{{ st._displayName }}</span>
                <span v-if="st.grade" class="text-[11px] text-blue-500 font-bold shrink-0">Grade {{ st.grade }}</span>
            </div>
            <div v-if="scheduledStudents.length === 0" class="py-8 text-center text-xs text-gray-400 dark:text-gray-500 font-semibold">
                No students scheduled
            </div>
        </div>
    </Dialog>
</template>
