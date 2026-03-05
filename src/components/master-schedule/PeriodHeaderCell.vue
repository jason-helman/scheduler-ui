<script setup>
import CopyButton from '../common/CopyButton.vue'

const props = defineProps({
    period: {
        type: Object,
        required: true
    },
    showIds: {
        type: Boolean,
        default: false
    },
    isCompressed: {
        type: Boolean,
        default: false
    }
})

const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':')
    const hours = parseInt(h)
    const suffix = hours >= 12 ? 'pm' : 'am'
    const displayHours = ((hours + 11) % 12 + 1).toString().padStart(2, '0')
    return `${displayHours}:${m}${suffix}`
}
</script>

<template>
    <div class="flex flex-col items-center w-full group/period">
        <div class="flex items-center gap-2">
            <span :class="['font-black', isCompressed ? 'text-[10px]' : 'text-[11px]']">{{ period.name }}</span>
            <CopyButton v-if="showIds && period.coursePeriodId != null" :value="period.coursePeriodId" label="Period ID" />
        </div>
        <span v-if="period.startTime" :class="['font-bold opacity-60 tracking-normal normal-case mt-0.5', isCompressed ? 'text-[8px]' : 'text-[9px]']">
            {{ formatTime(period.startTime) }} - {{ formatTime(period.endTime) }}
        </span>
    </div>
</template>
