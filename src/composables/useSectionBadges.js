import { computed, unref } from 'vue'
import { getCourseByIdMap, getSectionByIdMap, getTeacherNameByIdMap } from '../utils'

export function useSectionBadges({ section, currentTeacherId, localDataset, isCompressed }) {
    const sectionValue = computed(() => unref(section) || {})

    const isLunchSection = computed(() => {
        if (sectionValue.value.isLunchCourse != null) return !!sectionValue.value.isLunchCourse
        if (!localDataset.value) return false
        const course = getCourseByIdMap(localDataset.value).get(sectionValue.value.courseId)
        return !!course?.isLunchCourse
    })

    const isCoTaughtSection = computed(() => {
        if (sectionValue.value.isCoTaught != null) return !!sectionValue.value.isCoTaught
        if (sectionValue.value.is_co_taught != null) return !!sectionValue.value.is_co_taught
        if (sectionValue.value.coTeacherId || sectionValue.value.co_teacher_id) return true
        if (Array.isArray(sectionValue.value.coTeacherIds) && sectionValue.value.coTeacherIds.length > 0) return true
        if (Array.isArray(sectionValue.value.co_teacher_ids) && sectionValue.value.co_teacher_ids.length > 0) return true
        if (Array.isArray(sectionValue.value.teacherIds) && sectionValue.value.teacherIds.length > 1) return true
        if (Array.isArray(sectionValue.value.teacher_ids) && sectionValue.value.teacher_ids.length > 1) return true
        return false
    })

    const sectionQuarterCount = computed(() => {
        const rawQuarters = String(sectionValue.value.quarters || '')
            .split(',')
            .map(q => q.trim().toUpperCase())
            .filter(Boolean)

        if (rawQuarters.length > 1) return rawQuarters.length

        if (rawQuarters.length === 1) {
            const token = rawQuarters[0]
            if (/^S[12]$/.test(token) || /^SEM(ESTER)?[12]?$/.test(token)) return 2
            if (/^(Y|FY|FULL\s*YEAR|ANNUAL)$/.test(token)) return 4

            const rangeMatch = token.match(/^(\d)\s*[-/]\s*(\d)$/)
            if (rangeMatch) {
                const start = Number(rangeMatch[1])
                const end = Number(rangeMatch[2])
                if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
                    return (end - start) + 1
                }
            }

            const numeric = Number(token)
            if (Number.isFinite(numeric) && numeric > 0) return 1
        }

        const explicitCount = Number(sectionValue.value.quarterCount)
        if (Number.isFinite(explicitCount) && explicitCount > 0) return explicitCount

        return 0
    })

    const scheduleMaxDays = computed(() => {
        const structure = localDataset.value?.scheduleStructure
        if (!Array.isArray(structure) || structure.length === 0) return 0
        return new Set(
            structure
                .map(ss => Number(ss?.day))
                .filter(day => Number.isFinite(day) && day > 0)
        ).size
    })

    const sectionDayCount = computed(() =>
        String(sectionValue.value.days || '')
            .split(',')
            .map(d => d.trim())
            .filter(Boolean)
            .length
    )

    const quarterBadgeLabel = computed(() => {
        const tokens = String(sectionValue.value.quarters || '')
            .split(',')
            .map(q => q.trim())
            .filter(Boolean)
        if (tokens.length <= 1) return ''

        const numeric = tokens
            .map(Number)
            .filter(n => Number.isFinite(n) && n > 0)
            .sort((a, b) => a - b)
        const key = numeric.join(',')
        if (key === '1,2') return 'S1'
        if (key === '3,4') return 'S2'
        if (key === '1,2,3,4') return 'FY'

        if (sectionQuarterCount.value >= 4) return 'FY'
        return `Q ${tokens.join(',')}`
    })

    const showDayBadge = computed(() => {
        if (!sectionValue.value.days) return false
        if (scheduleMaxDays.value <= 0) return true
        return sectionDayCount.value > 0 && sectionDayCount.value < scheduleMaxDays.value
    })

    const quickFlags = computed(() => {
        const flags = []
        const hasMultiPeriodSpan = Array.isArray(sectionValue.value.coursePeriodIds) && sectionValue.value.coursePeriodIds.length > 1
        if (isCoTaughtSection.value) flags.push({ key: 'co', label: 'Co-Taught', tone: 'teal' })
        if (isLunchSection.value) flags.push({ key: 'lunch', label: 'Lunch', tone: 'orange' })
        if (sectionValue.value.isLab) flags.push({ key: 'lab', label: 'Lab', tone: 'emerald' })
        if (sectionValue.value.isInclusion) flags.push({ key: 'inclusion', label: 'Inclusion', tone: 'violet' })
        if (sectionValue.value.spanId || hasMultiPeriodSpan) flags.push({ key: 'span', label: 'Span', tone: 'sky' })
        if (sectionValue.value.parentSectionId) flags.push({ key: 'sub', label: 'Subsection', tone: 'indigo' })
        if (sectionValue.value.locked) flags.push({ key: 'locked', label: 'Locked', tone: 'amber' })
        return flags
    })

    const compactBadgeLabels = computed(() => {
        const badges = []
        if (quarterBadgeLabel.value) badges.push({ key: 'q', label: quarterBadgeLabel.value, tone: 'slate' })
        if (showDayBadge.value) badges.push({ key: 'd', label: `D ${sectionValue.value.days}`, tone: 'emerald' })
        quickFlags.value.forEach(flag => badges.push({ key: flag.key, label: flag.label, tone: flag.tone }))
        return badges
    })

    const inlineBadges = computed(() => {
        const badges = []
        if (quarterBadgeLabel.value) badges.push({ key: 'q', label: quarterBadgeLabel.value, tone: 'slate' })
        if (showDayBadge.value) badges.push({ key: 'd', label: `D ${sectionValue.value.days}`, tone: 'emerald' })
        quickFlags.value.forEach(flag => badges.push({ key: flag.key, label: flag.label, tone: flag.tone }))
        return badges
    })

    const compactBadgeCount = computed(() => compactBadgeLabels.value.length)
    const useCompactBadgeOverlay = computed(() => isCompressed.value && sectionQuarterCount.value === 1)

    const teacherNameById = computed(() => getTeacherNameByIdMap(localDataset.value))

    const coTeachers = computed(() => {
        const teacherIds = Array.from(
            new Set(
                [
                    ...(Array.isArray(sectionValue.value.teacherIds) ? sectionValue.value.teacherIds : []),
                    ...(Array.isArray(sectionValue.value.teacher_ids) ? sectionValue.value.teacher_ids : []),
                    sectionValue.value.teacherId,
                    sectionValue.value.teacher_id
                ].filter(id => id != null).map(id => String(id))
            )
        )

        if (teacherIds.length <= 1) return []

        const currentTeacher = currentTeacherId.value != null ? String(currentTeacherId.value) : null
        return teacherIds
            .filter(id => id !== currentTeacher)
            .map(id => ({
                teacherId: id,
                name: teacherNameById.value.get(id) || `Teacher ${id}`
            }))
    })

    const coTeacherBadgeItems = computed(() =>
        coTeachers.value.map(ct => ({
            key: ct.teacherId,
            label: ct.name,
            tone: 'teal',
            tooltip: `Jump to ${ct.name}'s related section`,
            clickable: true,
            payload: {
                teacherId: ct.teacherId,
                sourceSectionId: sectionValue.value.sectionId,
                sourceSpanId: sectionValue.value.spanId,
                sourceParentSectionId: sectionValue.value.parentSectionId
            }
        }))
    )

    const parentSection = computed(() => {
        const parentSectionId = sectionValue.value.parentSectionId
        if (parentSectionId == null) return null

        const indexedParent = getSectionByIdMap(localDataset.value).get(String(parentSectionId))
        return indexedParent || { sectionId: parentSectionId }
    })

    const mainSectionBadgeItems = computed(() => {
        if (!parentSection.value) return []
        const parent = parentSection.value
        const courseName = parent.course_name || parent.courseCode || `Section ${parent.sectionId}`
        return [
            {
                key: `main-${parent.sectionId}`,
                label: courseName,
                tone: 'indigo',
                tooltip: `Jump to main section (${courseName})`,
                truncate: true,
                clickable: true,
                payload: parent.sectionId
            }
        ]
    })

    return {
        compactBadgeLabels,
        inlineBadges,
        compactBadgeCount,
        useCompactBadgeOverlay,
        coTeachers,
        coTeacherBadgeItems,
        mainSectionBadgeItems
    }
}
