import { computed } from 'vue'
import { transformScheduleData, transformPeriods } from '../utils'

export function useMasterScheduleTableConfig({ localDataset, isCompressed }) {
    const periods = computed(() => transformPeriods(localDataset.value?.scheduleStructure))
    const scheduleData = computed(() => transformScheduleData(localDataset.value))
    const rowItemSize = computed(() => (isCompressed.value ? 264 : 354))
    const toleratedItems = computed(() => (isCompressed.value ? 30 : 24))
    const virtualScrollerOptions = computed(() => ({
        itemSize: rowItemSize.value,
        numToleratedItems: toleratedItems.value,
        delay: 0,
        showLoader: false
    }))

    return {
        periods,
        scheduleData,
        rowItemSize,
        virtualScrollerOptions
    }
}
