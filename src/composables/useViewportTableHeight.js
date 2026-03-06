import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

export function useViewportTableHeight({ tableHostRef, isCompressed, watchSource, bottomGap = 40 }) {
    const tableScrollHeight = ref('65vh')
    let tableHeightRafId = null

    const updateTableScrollHeight = () => {
        if (!tableHostRef.value) return
        const top = tableHostRef.value.getBoundingClientRect().top
        const viewportHeight = window.innerHeight
        const available = Math.floor(viewportHeight - top - bottomGap)
        const minHeight = isCompressed.value ? 260 : 320
        tableScrollHeight.value = `${Math.max(minHeight, available)}px`
    }

    const scheduleTableHeightUpdate = () => {
        if (tableHeightRafId != null) cancelAnimationFrame(tableHeightRafId)
        tableHeightRafId = requestAnimationFrame(() => {
            tableHeightRafId = null
            updateTableScrollHeight()
        })
    }

    onMounted(() => {
        nextTick(() => updateTableScrollHeight())
        window.addEventListener('resize', scheduleTableHeightUpdate)
    })

    onBeforeUnmount(() => {
        if (tableHeightRafId != null) cancelAnimationFrame(tableHeightRafId)
        window.removeEventListener('resize', scheduleTableHeightUpdate)
    })

    if (watchSource) {
        watch(watchSource, () => nextTick(() => scheduleTableHeightUpdate()))
    }

    return {
        tableScrollHeight
    }
}
