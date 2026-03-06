<script setup>
import { computed } from 'vue'

import { store } from '../../store'

const props = defineProps({
    teacherId: {
        type: [Number, String],
        default: null
    },
    periodId: {
        type: [Number, String],
        required: true
    },
    hoverTraceData: {
        type: Object,
        default: null
    }
})

const hoverTraceEntriesForCell = computed(() => {
    if (!store.showSectionTraceOnHover) return []
    if (!props.hoverTraceData) return []

    const teacherMatches = String(props.teacherId) === String(props.hoverTraceData.teacherId)
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

const formatScoreValue = (value) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return null
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2)
}

const buildEntryScoreBadges = (entry) => {
    const metrics = entry.metrics && typeof entry.metrics === 'object' ? entry.metrics : {}
    const badges = []
    const add = (label, value) => {
        const formatted = formatScoreValue(value)
        if (formatted == null) return
        badges.push(`${label}: ${formatted}`)
    }

    add('Greedy', entry.greedyScore ?? metrics.greedyScore)
    add('Final', entry.finalScore ?? metrics.finalScore)
    add('Score', metrics.score)
    add('Selected', metrics.selectedScore)
    add('2nd', metrics.secondBestScore)
    add('Gap', metrics.scoreGap)

    return badges
}

const formatTraceCodeLabel = (code) => {
    const key = String(code || '').toUpperCase()
    const labels = {
        DECISION_SUMMARY: 'SUMMARY',
        CANDIDATE_REJECTED_FILTER: 'REJECTED',
        CANDIDATE_SELECTED: 'SELECTED',
        VALID_CANDIDATE_SUMMARY: 'VALID-SUM',
        VALID_CANDIDATE_SCORED: 'VALID-SCORE',
        SECTION_FINAL_PLACEMENT: 'FINAL'
    }
    return labels[key] || key
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
</script>

<template>
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
                <div class="trace-overlay-card__primary-row">
                    <span class="trace-overlay-card__item-code" :title="entry.code">{{ formatTraceCodeLabel(entry.code) }}</span>
                    <span v-if="buildEntryScoreBadges(entry).length > 0" class="trace-overlay-card__scores">
                        {{ buildEntryScoreBadges(entry).join(' • ') }}
                    </span>
                    <span v-else class="trace-overlay-card__scores trace-overlay-card__scores--na">No score</span>
                </div>
                <div class="trace-overlay-card__secondary-row">
                    {{ entry.message || 'Trace event' }}
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
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
    display: flex;
    flex-direction: column;
    min-height: 0;
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
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 2px;
}

.trace-overlay-card__list-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: 8px;
    line-height: 1.1;
    font-weight: 700;
    color: #1e3a8a;
}

.trace-overlay-card__primary-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}

.trace-overlay-card__secondary-row {
    opacity: 0.85;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.trace-overlay-card__item-code {
    font-weight: 900;
    font-size: 8px;
    opacity: 0.9;
    white-space: nowrap;
}

.trace-overlay-card__scores {
    display: inline-block;
    min-width: 0;
    font-size: 9px;
    line-height: 1;
    font-weight: 900;
    color: #0f172a;
    background: rgba(255, 255, 255, 0.55);
    border: 1px solid rgba(59, 130, 246, 0.35);
    border-radius: 999px;
    padding: 2px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.trace-overlay-card__scores--na {
    font-size: 8px;
    opacity: 0.8;
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

.my-app-dark .trace-overlay-card__scores {
    color: #e2e8f0;
    background: rgba(15, 23, 42, 0.55);
    border-color: rgba(148, 163, 184, 0.4);
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
</style>
