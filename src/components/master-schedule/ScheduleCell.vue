<script setup>
import { ref, computed, watch } from 'vue'
import Button from 'primevue/button'

import SectionCard from './SectionCard.vue'
import { store } from '../../store'
import { isRelatedSection } from '../../utils'

const props = defineProps({
    teacher: Object,
    periodId: [Number, String],
    sectionDiagnosticsCounts: {
        type: Object,
        default: null
    },
    rowIndex: {
        type: Number,
        default: 0
    },
    hoveredSection: Object,
    hoverTraceData: {
        type: Object,
        default: null
    },
    jumpPulseSectionId: [Number, String],
    jumpPulseVisible: Boolean
})

const emit = defineEmits([
    'hover',
    'leave',
    'toggle-lock',
    'jump-to-teacher',
    'jump-to-section',
    'open-diagnostics',
    'open-alerts'
])

const userSelectedLayerIndex = ref(0)
const currentLayerIndex = ref(0)

const layers = computed(() => {
    return props.teacher.periodLayers?.['period_' + props.periodId] || []
})

const hoverTraceEntriesForCell = computed(() => {
    if (!store.showSectionTraceOnHover) return []
    if (!props.hoverTraceData) return []

    const teacherMatches = String(props.teacher.teacherId) === String(props.hoverTraceData.teacherId)
    if (!teacherMatches) return []

    const periodKey = String(props.periodId)
    return props.hoverTraceData.entries
        .filter(entry => entry.periodIds?.includes(periodKey))
        .map((entry, order) => ({ ...entry, _order: order }))
})

const getCombinedTone = (entries) => {
    if (entries.some(entry => entry.code === 'SECTION_FINAL_PLACEMENT')) return 'success'
    if (entries.some(entry => entry.tone === 'danger')) return 'danger'
    if (entries.some(entry => entry.tone === 'warning')) return 'warning'
    return 'info'
}

const combinedHoverTraceGroupsForCell = computed(() => {
    if (hoverTraceEntriesForCell.value.length === 0) return []

    const groups = []

    hoverTraceEntriesForCell.value.forEach((entry) => {
        const entryStartQ = Math.max(1, Number(entry.startQ) || 1)
        const entryEndQ = Math.max(entryStartQ, Number(entry.endQ) || entryStartQ)
        const overlappingGroupIndexes = []

        groups.forEach((group, idx) => {
            const overlaps = entryStartQ <= group.endQ && entryEndQ >= group.startQ
            if (overlaps) overlappingGroupIndexes.push(idx)
        })

        if (overlappingGroupIndexes.length === 0) {
            groups.push({
                startQ: entryStartQ,
                endQ: entryEndQ,
                entries: [entry]
            })
            return
        }

        const primaryIdx = overlappingGroupIndexes[0]
        const primaryGroup = groups[primaryIdx]
        primaryGroup.startQ = Math.min(primaryGroup.startQ, entryStartQ)
        primaryGroup.endQ = Math.max(primaryGroup.endQ, entryEndQ)
        primaryGroup.entries.push(entry)

        for (let i = overlappingGroupIndexes.length - 1; i >= 1; i -= 1) {
            const mergeIdx = overlappingGroupIndexes[i]
            const mergeGroup = groups[mergeIdx]
            primaryGroup.startQ = Math.min(primaryGroup.startQ, mergeGroup.startQ)
            primaryGroup.endQ = Math.max(primaryGroup.endQ, mergeGroup.endQ)
            primaryGroup.entries.push(...mergeGroup.entries)
            groups.splice(mergeIdx, 1)
        }
    })

    return groups
        .map((group, idx) => ({
            key: `trace-group-${idx}-${group.startQ}-${group.endQ}`,
            startQ: group.startQ,
            endQ: group.endQ,
            entries: group.entries.sort((a, b) => (a._order ?? 0) - (b._order ?? 0)),
            tone: getCombinedTone(group.entries)
        }))
        .sort((a, b) => a.startQ - b.startQ || a.endQ - b.endQ)
})

const layerRelationIndex = computed(() => {
    const bySectionId = new Map()
    const bySpanId = new Map()
    const byParentSectionId = new Map()

    layers.value.forEach((layer, layerIdx) => {
        layer.forEach(section => {
            if (section.sectionId != null && !bySectionId.has(section.sectionId)) {
                bySectionId.set(section.sectionId, layerIdx)
            }
            if (section.spanId != null && !bySpanId.has(section.spanId)) {
                bySpanId.set(section.spanId, layerIdx)
            }
            if (section.parentSectionId != null && !byParentSectionId.has(section.parentSectionId)) {
                byParentSectionId.set(section.parentSectionId, layerIdx)
            }
        })
    })

    return { bySectionId, bySpanId, byParentSectionId }
})

const nextLayer = (total) => {
    userSelectedLayerIndex.value = (userSelectedLayerIndex.value + 1) % total
    currentLayerIndex.value = userSelectedLayerIndex.value
}

const prevLayer = (total) => {
    userSelectedLayerIndex.value = (userSelectedLayerIndex.value - 1 + total) % total
    currentLayerIndex.value = userSelectedLayerIndex.value
}

// Watch for hover changes to temporarily switch layers
watch(() => props.hoveredSection, (newTarget) => {
    if (!newTarget) {
        if (currentLayerIndex.value !== userSelectedLayerIndex.value) {
            currentLayerIndex.value = userSelectedLayerIndex.value
        }
        return
    }

    const { bySectionId, bySpanId, byParentSectionId } = layerRelationIndex.value

    const relationCandidates = [
        bySectionId.get(newTarget.sectionId),
        newTarget.spanId != null ? bySpanId.get(newTarget.spanId) : undefined,
        byParentSectionId.get(newTarget.sectionId),
        newTarget.parentSectionId != null ? bySectionId.get(newTarget.parentSectionId) : undefined,
        newTarget.parentSectionId != null ? byParentSectionId.get(newTarget.parentSectionId) : undefined
    ]

    for (const idx of relationCandidates) {
        if (Number.isInteger(idx)) {
            if (currentLayerIndex.value !== idx) currentLayerIndex.value = idx
            return
        }
    }

    // Safety fallback for any relationship shape not indexed above
    for (let i = 0; i < layers.value.length; i++) {
        if (layers.value[i].some(section => isRelatedSection(section, newTarget))) {
            if (currentLayerIndex.value !== i) currentLayerIndex.value = i
            return
        }
    }

    if (currentLayerIndex.value !== userSelectedLayerIndex.value) {
        currentLayerIndex.value = userSelectedLayerIndex.value
    }
}, { immediate: true })
</script>

<template>
    <div :class="['grid grid-rows-4 gap-1.5 relative items-stretch group/cell overflow-hidden min-h-0', store.isCompressed ? 'h-[260px] p-1.5' : 'h-[350px] p-3']">
        <!-- Quarter Separator Lines -->
        <div v-for="q in 4" :key="'qline-' + q" class="absolute left-0 right-0 border-b border-gray-50 dark:border-gray-800/50 pointer-events-none" :style="{ top: ((q-1) * 25) + '%', height: '25%' }"></div>

        <template v-if="layers.length > 0">
            <!-- Layer Navigation Indicators -->
            <div v-if="layers.length > 1" 
                 class="absolute top-1 left-1/2 -translate-x-1/2 flex gap-1.5 z-[60]">
                <div v-for="(_, dotIdx) in layers" :key="'dot-' + dotIdx"
                     :class="['w-1.5 h-1.5 rounded-full border border-white/20', dotIdx === currentLayerIndex ? 'bg-blue-500 shadow-sm' : 'bg-gray-200 dark:bg-gray-700']"></div>
            </div>

            <!-- Navigation Controls -->
            <div v-if="layers.length > 1" 
                 class="absolute inset-x-1 top-1/2 -translate-y-1/2 flex items-center justify-between z-[70] pointer-events-none opacity-0 group-hover/cell:opacity-100 transition-opacity">
                <Button icon="pi pi-chevron-left" rounded severity="secondary" size="small" 
                        class="!w-7 !h-7 !p-0 shadow-lg border border-gray-200 dark:border-gray-700 pointer-events-auto !bg-white/90 dark:!bg-gray-800/90"
                        @click.stop="prevLayer(layers.length)" />
                <Button icon="pi pi-chevron-right" rounded severity="secondary" size="small" 
                        class="!w-7 !h-7 !p-0 shadow-lg border border-gray-200 dark:border-gray-700 pointer-events-auto !bg-white/90 dark:!bg-gray-800/90"
                        @click.stop="nextLayer(layers.length)" />
            </div>

            <!-- Layer Rendering -->
            <template v-for="(layerSections, lIdx) in layers" :key="'layer-' + lIdx">
                <template v-if="lIdx === currentLayerIndex">
                    <template v-for="section in layerSections" :key="section.sectionId">
                        <!-- Restriction Card -->
                        <div v-if="section.isRestriction"
                             :style="{ gridRow: '1 / 5' }"
                             class="p-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-center opacity-60 z-10 w-full is-restriction">
                            <div class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex flex-col items-center gap-1 text-center">
                                <i class="pi pi-ban text-xs"></i>
                                <span>Restricted</span>
                            </div>
                        </div>

                        <!-- Regular Section Card -->
                        <SectionCard
                            v-else
                            :section="section"
                            :current-teacher-id="teacher.teacherId"
                            :section-diagnostics-counts="sectionDiagnosticsCounts"
                            :hovered-section="hoveredSection"
                            :jump-pulse-section-id="jumpPulseSectionId"
                            :jump-pulse-visible="jumpPulseVisible"
                            @hover="s => emit('hover', s)"
                            @leave="() => emit('leave')"
                            @toggle-lock="id => emit('toggle-lock', id)"
                            @jump-to-teacher="id => emit('jump-to-teacher', id)"
                            @jump-to-section="id => emit('jump-to-section', id)"
                            @open-diagnostics="id => emit('open-diagnostics', id)"
                            @open-alerts="id => emit('open-alerts', id)"
                        />
                    </template>

                </template>
            </template>
        </template>

        <div
            v-for="group in combinedHoverTraceGroupsForCell"
            :key="group.key"
            :style="{
                top: `${(group.startQ - 1) * 25}%`,
                height: `${(group.endQ - group.startQ + 1) * 25}%`
            }"
            :class="[
                'trace-overlay-card',
                `trace-overlay-card--${group.tone}`
            ]"
        >
            <div class="trace-overlay-card__code">
                {{ group.entries.length }} Trace Event{{ group.entries.length === 1 ? '' : 's' }}
            </div>
            <div class="trace-overlay-card__list">
                <div
                    v-for="entry in group.entries"
                    :key="entry.key"
                    class="trace-overlay-card__list-item"
                >
                    <span class="trace-overlay-card__item-code">{{ entry.code }}:</span>
                    <span>{{ entry.message || 'Trace event' }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.is-restriction {
    background-image: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(0, 0, 0, 0.03) 10px,
        rgba(0, 0, 0, 0.03) 20px
    );
}

.trace-overlay-card {
    pointer-events: none;
    position: absolute;
    left: 0.35rem;
    right: 0.35rem;
    z-index: 80;
    margin: 0;
    border-radius: 0.5rem;
    border: 1px dashed #60a5fa;
    background: rgba(219, 234, 254, 0.88);
    backdrop-filter: blur(1px);
    padding: 0.3rem 0.4rem;
    overflow: hidden;
}

.trace-overlay-card__code {
    font-size: 9px;
    line-height: 1.1;
    font-weight: 900;
    color: #1d4ed8;
    letter-spacing: 0.03em;
    text-transform: uppercase;
}

.trace-overlay-card__message {
    margin-top: 2px;
    font-size: 8px;
    line-height: 1.2;
    font-weight: 700;
    color: #1e3a8a;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.trace-overlay-card__list {
    margin-top: 2px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 100%;
    overflow: auto;
    padding-right: 2px;
}

.trace-overlay-card__list-item {
    font-size: 8px;
    line-height: 1.15;
    font-weight: 700;
    color: #1e3a8a;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.trace-overlay-card__item-code {
    font-weight: 900;
    margin-right: 3px;
}

.trace-overlay-card--success {
    border-color: #34d399;
    background: rgba(209, 250, 229, 0.9);
}

.trace-overlay-card--success .trace-overlay-card__code,
.trace-overlay-card--success .trace-overlay-card__message {
    color: #065f46;
}

.trace-overlay-card--warning {
    border-color: #f59e0b;
    background: rgba(254, 243, 199, 0.9);
}

.trace-overlay-card--warning .trace-overlay-card__code,
.trace-overlay-card--warning .trace-overlay-card__message {
    color: #92400e;
}

.trace-overlay-card--danger {
    border-color: #ef4444;
    background: rgba(254, 226, 226, 0.9);
}

.trace-overlay-card--danger .trace-overlay-card__code,
.trace-overlay-card--danger .trace-overlay-card__message {
    color: #991b1b;
}

.my-app-dark .trace-overlay-card {
    border-color: #3b82f6;
    background: rgba(30, 58, 138, 0.88);
}

.my-app-dark .trace-overlay-card__code,
.my-app-dark .trace-overlay-card__message,
.my-app-dark .trace-overlay-card__list-item {
    color: #dbeafe;
}

.my-app-dark .trace-overlay-card--success {
    border-color: #10b981;
    background: rgba(6, 78, 59, 0.92);
}

.my-app-dark .trace-overlay-card--warning {
    border-color: #f59e0b;
    background: rgba(120, 53, 15, 0.92);
}

.my-app-dark .trace-overlay-card--danger {
    border-color: #ef4444;
    background: rgba(127, 29, 29, 0.92);
}

.my-app-dark .is-restriction {
    background-image: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(255, 255, 255, 0.03) 10px,
        rgba(255, 255, 255, 0.03) 20px
    );
}
</style>
