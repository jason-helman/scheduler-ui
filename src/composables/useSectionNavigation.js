import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'

export function useSectionNavigation({ scheduleData, tableRef, rowItemSize, isCompressed, isRelatedSection }) {
    const hoveredSection = shallowRef(null)
    const hoveredSectionKey = ref(null)
    const jumpPulseSection = shallowRef(null)
    const jumpPulseVisible = ref(false)

    let hoverRafId = null
    let nextHoveredSection = null
    let jumpPulseTimerIds = []

    const getHoverKey = (section) => {
        if (!section) return null
        return `${section.sectionId ?? ''}:${section.spanId ?? ''}:${section.parentSectionId ?? ''}`
    }

    const applyHoveredSection = () => {
        hoverRafId = null
        const key = getHoverKey(nextHoveredSection)
        if (key === hoveredSectionKey.value) return
        hoveredSection.value = nextHoveredSection
        hoveredSectionKey.value = key
    }

    const scheduleHoveredSectionUpdate = (section) => {
        nextHoveredSection = section
        if (hoverRafId != null) return
        hoverRafId = requestAnimationFrame(applyHoveredSection)
    }

    const setHoveredSection = (section) => {
        scheduleHoveredSectionUpdate(section)
    }

    const clearHoveredSection = () => {
        scheduleHoveredSectionUpdate(null)
    }

    const waitForSectionElement = (sectionId, timeoutMs = 1800) => {
        const targetId = String(sectionId)
        const start = performance.now()

        return new Promise(resolve => {
            const poll = () => {
                const tableEl = tableRef.value?.$el
                const node = tableEl?.querySelector?.(`[data-section-id="${targetId}"]`)
                if (node) {
                    resolve(node)
                    return
                }
                if ((performance.now() - start) >= timeoutMs) {
                    resolve(null)
                    return
                }
                requestAnimationFrame(poll)
            }
            requestAnimationFrame(poll)
        })
    }

    const scrollToTeacherRow = async (targetTeacherId) => {
        const teacherIdNum = Number(targetTeacherId)
        if (!Number.isFinite(teacherIdNum)) return null

        const rowIndex = scheduleData.value.findIndex(t => Number(t.teacherId) === teacherIdNum)
        if (rowIndex === -1) return null

        const tableEl = tableRef.value?.$el
        const virtualScrollerEl = tableEl?.querySelector('.p-virtualscroller')
        if (virtualScrollerEl) {
            const headerEl = tableEl?.querySelector('.p-datatable-thead')
            const headerHeight = headerEl?.getBoundingClientRect().height || 0
            const topPadding = isCompressed.value ? 12 : 8
            const targetTop = Math.max(0, (rowIndex * rowItemSize.value) - headerHeight - topPadding)
            if (typeof virtualScrollerEl.scrollTo === 'function') {
                virtualScrollerEl.scrollTo({ top: targetTop, behavior: 'smooth' })
            } else {
                virtualScrollerEl.scrollTop = targetTop
            }
        }

        return rowIndex
    }

    const startJumpPulse = (section) => {
        if (!section) return
        jumpPulseTimerIds.forEach(id => clearTimeout(id))
        jumpPulseTimerIds = []
        jumpPulseSection.value = section
        jumpPulseVisible.value = false

        const pulsePlan = [
            [0, true],
            [420, false],
            [1120, true],
            [1540, false],
            [2240, true],
            [2660, false]
        ]

        pulsePlan.forEach(([delayMs, visible]) => {
            const id = setTimeout(() => {
                jumpPulseVisible.value = visible
            }, delayMs)
            jumpPulseTimerIds.push(id)
        })

        const cleanupId = setTimeout(() => {
            jumpPulseVisible.value = false
            jumpPulseSection.value = null
        }, 2800)
        jumpPulseTimerIds.push(cleanupId)
    }

    const findRelatedSectionForTeacher = (targetTeacherId, source) => {
        const teacher = scheduleData.value.find(t => Number(t.teacherId) === Number(targetTeacherId))
        if (!teacher) return null

        const sections = []
        const periodLayers = teacher.periodLayers || {}
        Object.values(periodLayers).forEach(layers => {
            layers.forEach(layer => {
                layer.forEach(section => {
                    if (section?.isRestriction) return
                    sections.push(section)
                })
            })
        })

        if (sections.length === 0) return null
        if (!source) return sections[0]

        const sourceSectionId = source.sectionId != null ? String(source.sectionId) : null
        const sourceSpanId = source.spanId != null ? String(source.spanId) : null
        const sourceParentSectionId = source.parentSectionId != null ? String(source.parentSectionId) : null

        if (sourceSectionId) {
            const bySectionId = sections.find(s => String(s.sectionId) === sourceSectionId)
            if (bySectionId) return bySectionId
        }

        if (sourceSpanId) {
            const bySpan = sections.find(s => s.spanId != null && String(s.spanId) === sourceSpanId)
            if (bySpan) return bySpan
        }

        if (sourceParentSectionId) {
            const byParent = sections.find(s => s.parentSectionId != null && String(s.parentSectionId) === sourceParentSectionId)
            if (byParent) return byParent
        }

        const byRelation = sections.find(s => isRelatedSection(s, source))
        return byRelation || sections[0]
    }

    const jumpToTeacherRelatedSection = async (target) => {
        const teacherId = target && typeof target === 'object' ? target.teacherId : target
        const teacherIdNum = Number(teacherId)
        if (!Number.isFinite(teacherIdNum)) return

        const source = target && typeof target === 'object'
            ? {
                sectionId: target.sourceSectionId,
                spanId: target.sourceSpanId,
                parentSectionId: target.sourceParentSectionId
            }
            : null

        const relatedSection = findRelatedSectionForTeacher(teacherIdNum, source)
        await scrollToTeacherRow(teacherIdNum)

        if (!relatedSection) return
        await waitForSectionElement(relatedSection.sectionId)
        startJumpPulse(relatedSection)
    }

    const jumpToSection = async (targetSectionId) => {
        if (targetSectionId == null) return
        const targetSectionIdStr = String(targetSectionId)

        let targetTeacherId = null
        let targetSection = null

        for (const teacher of scheduleData.value) {
            const periodLayers = teacher?.periodLayers || {}
            const periodLayerGroups = Object.values(periodLayers)
            for (const layers of periodLayerGroups) {
                for (const layer of layers) {
                    const found = layer.find(section => String(section?.sectionId) === targetSectionIdStr)
                    if (found) {
                        targetTeacherId = teacher.teacherId
                        targetSection = found
                        break
                    }
                }
                if (targetTeacherId != null) break
            }
            if (targetTeacherId != null) break
        }

        if (targetTeacherId == null || !targetSection) return

        await scrollToTeacherRow(targetTeacherId)
        await waitForSectionElement(targetSection.sectionId)
        startJumpPulse(targetSection)
    }

    const effectiveHoveredSection = computed(() => {
        if (
            jumpPulseSection.value &&
            hoveredSection.value &&
            String(hoveredSection.value.sectionId) === String(jumpPulseSection.value.sectionId) &&
            !jumpPulseVisible.value
        ) {
            return null
        }
        return hoveredSection.value
    })

    const jumpPulseSectionId = computed(() => jumpPulseSection.value?.sectionId ?? null)

    onBeforeUnmount(() => {
        if (hoverRafId != null) cancelAnimationFrame(hoverRafId)
        jumpPulseTimerIds.forEach(id => clearTimeout(id))
        jumpPulseTimerIds = []
    })

    return {
        effectiveHoveredSection,
        jumpPulseSectionId,
        jumpPulseVisible,
        setHoveredSection,
        clearHoveredSection,
        jumpToTeacherRelatedSection,
        jumpToSection
    }
}
