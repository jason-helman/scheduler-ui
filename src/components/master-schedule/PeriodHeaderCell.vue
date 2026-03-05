<script setup>
import { CopyButton } from '../common'
import { formatTime12h } from '../../utils/formatters'

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

</script>

<template>
    <div class="flex flex-col items-center w-full group/period">
        <div class="flex items-center gap-2">
            <span :class="['font-black', isCompressed ? 'text-[10px]' : 'text-[11px]']">{{ period.name }}</span>
            <CopyButton v-if="showIds && period.coursePeriodId != null" :value="period.coursePeriodId" label="Period ID" />
        </div>
        <span v-if="period.startTime" :class="['font-bold opacity-60 tracking-normal normal-case mt-0.5', isCompressed ? 'text-[8px]' : 'text-[9px]']">
            {{ formatTime12h(period.startTime) }} - {{ formatTime12h(period.endTime) }}
        </span>
    </div>
</template>
