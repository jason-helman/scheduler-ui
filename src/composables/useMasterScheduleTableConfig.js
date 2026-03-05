import { computed } from 'vue'
import { transformScheduleData, transformPeriods } from '../utils/scheduleTransformer'

export function useMasterScheduleTableConfig({ localDataset, isCompressed }) {
    const periods = computed(() => transformPeriods(localDataset.value?.scheduleStructure))
    const scheduleData = computed(() => transformScheduleData(localDataset.value))
    const rowItemSize = computed(() => (isCompressed.value ? 264 : 354))
    const virtualScrollerOptions = computed(() => ({
        itemSize: rowItemSize.value,
        numToleratedItems: 16,
        delay: 30,
        showLoader: false
    }))

    return {
        periods,
        scheduleData,
        rowItemSize,
        virtualScrollerOptions
    }
}
