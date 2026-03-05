import { computed } from 'vue'
import { transformScheduleData, transformPeriods } from '../utils'

export function useMasterScheduleTableConfig({ localDataset, isCompressed }) {
    const periods = computed(() => transformPeriods(localDataset.value?.scheduleStructure))
    const scheduleData = computed(() => transformScheduleData(localDataset.value))
    const rowItemSize = computed(() => (isCompressed.value ? 264 : 354))
    // Keep overscan modest so deep scrolls do not mount too many heavyweight rows at once.
    const toleratedItems = computed(() => (isCompressed.value ? 10 : 8))

    const virtualScrollerOptions = computed(() => ({
        itemSize: rowItemSize.value,
        numToleratedItems: toleratedItems.value,
        delay: 16,
        showLoader: false
    }))

    return {
        periods,
        scheduleData,
        rowItemSize,
        virtualScrollerOptions
    }
}
