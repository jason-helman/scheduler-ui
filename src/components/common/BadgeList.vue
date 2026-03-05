<script setup>
import { computed, nextTick, onBeforeUnmount, onBeforeUpdate, onMounted, ref, watch } from 'vue'
import BadgeChip from './BadgeChip.vue'

const props = defineProps({
    items: {
        type: Array,
        default: () => []
    },
    size: {
        type: String,
        default: 'xs'
    },
    shape: {
        type: String,
        default: 'pill'
    },
    gapClass: {
        type: String,
        default: 'gap-1'
    },
    containerClass: {
        type: String,
        default: ''
    },
    wrap: {
        type: Boolean,
        default: true
    },
    collapseWrapped: {
        type: Boolean,
        default: false
    },
    maxRows: {
        type: Number,
        default: 1
    }
})

const emit = defineEmits(['item-click'])

const getKey = (item, idx) => item?.key ?? `${item?.label ?? 'item'}-${idx}`
const isInteractive = (item) => !!item?.interactive || !!item?.clickable

const containerEl = ref(null)
const measureItemEls = ref([])
const measuredVisibleCount = ref(null)
const overflowTriggerEl = ref(null)
const showOverflowPanel = ref(false)
const overflowPanelStyle = ref({})
let resizeObserver = null

const setMeasureItemRef = (el) => {
    if (el) measureItemEls.value.push(el)
}

const hiddenItems = computed(() => {
    if (!props.collapseWrapped || measuredVisibleCount.value == null) return []
    const visibleCount = measuredVisibleCount.value < props.items.length
        ? Math.max(0, measuredVisibleCount.value - 1)
        : measuredVisibleCount.value
    return props.items.slice(visibleCount)
})

const visibleItems = computed(() => {
    if (!props.collapseWrapped || measuredVisibleCount.value == null) return props.items
    const visibleCount = measuredVisibleCount.value < props.items.length
        ? Math.max(0, measuredVisibleCount.value - 1)
        : measuredVisibleCount.value
    return props.items.slice(0, visibleCount)
})

const getVisibleCountWithinRows = (elements, maxRows) => {
    const rowTops = []
    let visibleCount = 0

    for (const el of elements) {
        const top = el.offsetTop
        const knownRow = rowTops.findIndex(rowTop => Math.abs(rowTop - top) <= 1)
        if (knownRow === -1) rowTops.push(top)
        const rowIndex = knownRow === -1 ? rowTops.length : knownRow + 1
        if (rowIndex > maxRows) break
        visibleCount += 1
    }

    return visibleCount
}

const measureWrappedItems = () => {
    if (!props.collapseWrapped) {
        measuredVisibleCount.value = null
        return
    }

    nextTick(() => {
        const elements = measureItemEls.value
        if (!elements.length) {
            measuredVisibleCount.value = null
            return
        }

        const maxRows = Math.max(1, Number(props.maxRows) || 1)
        const visibleCount = getVisibleCountWithinRows(elements, maxRows)

        if (visibleCount >= props.items.length) {
            measuredVisibleCount.value = null
            return
        }

        measuredVisibleCount.value = visibleCount
    })
}

const updateOverflowPanelPosition = () => {
    if (!overflowTriggerEl.value) return
    const rect = overflowTriggerEl.value.getBoundingClientRect()
    overflowPanelStyle.value = {
        position: 'fixed',
        left: `${rect.left + (rect.width / 2)}px`,
        top: `${rect.bottom + 6}px`,
        transform: 'translateX(-50%)',
        zIndex: 3000
    }
}

const onOverflowEnter = () => {
    showOverflowPanel.value = true
    updateOverflowPanelPosition()
}

const onOverflowLeave = () => {
    showOverflowPanel.value = false
}

watch(
    () => [props.items, props.collapseWrapped, props.size, props.shape, props.gapClass, props.maxRows],
    () => {
        if (props.collapseWrapped) {
            measureWrappedItems()
            return
        }
        measuredVisibleCount.value = null
    }
)

onBeforeUpdate(() => {
    if (!props.collapseWrapped) return
    measureItemEls.value = []
})

onMounted(() => {
    if (!props.collapseWrapped) return
    measureWrappedItems()
    if (!containerEl.value) return
    resizeObserver = new ResizeObserver(() => measureWrappedItems())
    resizeObserver.observe(containerEl.value)
    window.addEventListener('scroll', updateOverflowPanelPosition, true)
    window.addEventListener('resize', updateOverflowPanelPosition)
})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    window.removeEventListener('scroll', updateOverflowPanelPosition, true)
    window.removeEventListener('resize', updateOverflowPanelPosition)
})
</script>

<template>
    <div ref="containerEl" :class="['relative flex', wrap ? 'flex-wrap' : 'flex-nowrap min-w-0', gapClass, containerClass]">
        <BadgeChip
            v-for="(item, idx) in visibleItems"
            :key="getKey(item, idx)"
            :label="item.label"
            :tone="item.tone || 'slate'"
            :size="item.size || size"
            :shape="item.shape || shape"
            :tooltip="item.tooltip || ''"
            :truncate="!!item.truncate"
            :max-width-class="item.maxWidthClass || ''"
            :as-button="isInteractive(item)"
            :interactive="isInteractive(item)"
            @click="emit('item-click', item)"
        />
        <div
            v-if="hiddenItems.length > 0"
            ref="overflowTriggerEl"
            class="relative inline-flex"
            @mouseenter="onOverflowEnter"
            @mouseleave="onOverflowLeave"
        >
            <BadgeChip
                :label="`+${hiddenItems.length}`"
                tone="slate"
                :size="size"
                :shape="shape"
            />
            <Teleport to="body">
                <div
                    v-if="showOverflowPanel"
                    :style="overflowPanelStyle"
                    class="rounded-md border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 shadow-sm p-1 flex flex-wrap gap-1 w-max max-w-[16rem]"
                    @mouseenter="onOverflowEnter"
                    @mouseleave="onOverflowLeave"
                >
                    <BadgeChip
                        v-for="(item, idx) in hiddenItems"
                        :key="`overflow-${getKey(item, idx)}`"
                        :label="item.label"
                        :tone="item.tone || 'slate'"
                        :size="item.size || size"
                        :shape="item.shape || shape"
                        :tooltip="item.tooltip || ''"
                        :truncate="!!item.truncate"
                        :max-width-class="item.maxWidthClass || ''"
                        :as-button="isInteractive(item)"
                        :interactive="isInteractive(item)"
                        @click="emit('item-click', item)"
                    />
                </div>
            </Teleport>
        </div>

        <div
            v-if="collapseWrapped"
            aria-hidden="true"
            :class="['absolute left-0 top-0 w-full flex flex-wrap invisible pointer-events-none -z-10', gapClass]"
        >
            <span
                v-for="(item, idx) in items"
                :key="`measure-${getKey(item, idx)}`"
                :ref="setMeasureItemRef"
                class="inline-flex"
            >
                <BadgeChip
                    :label="item.label"
                    :tone="item.tone || 'slate'"
                    :size="item.size || size"
                    :shape="item.shape || shape"
                    :truncate="!!item.truncate"
                    :max-width-class="item.maxWidthClass || ''"
                />
            </span>
        </div>
    </div>
</template>
