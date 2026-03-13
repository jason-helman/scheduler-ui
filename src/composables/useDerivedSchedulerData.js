import { computed } from 'vue'
import { store } from '../store'

const ACTIONABLE_LEVELS = new Set(['warn', 'error'])
const SECTION_ENTITY_TYPES = new Set(['section', 'subsection', 'lab_section'])

const EMPTY_REFERENCE_INDEX = () => ({
    index: new Map(),
    typed: {
        course: new Map(),
        teacher: new Map(),
        classroom: new Map(),
        student: new Map(),
        section: new Map(),
        period: new Map(),
        group: new Map(),
        lunch: new Map()
    }
})

const toDisplaySeverity = (record) => {
    if (record?.severity) return String(record.severity)
    if (record?.level) return String(record.level)
    return 'info'
}

const normalizeMetricKey = (key) => {
    const mapping = {
        pre_populate_ms: 'prePopulateMs',
        greedy_placement_ms: 'greedyPlacementMs',
        'greedy.totalMs': 'greedyPlacementMs',
        total_run_ms: 'totalRunMs',
        tabu_search_ms: 'tabuSearchMs',
        'tabu.totalMs': 'tabuSearchMs',
        'beam.totalMs': 'beamTotalMs',
        'multistart.totalMs': 'multistartTotalMs',
        'lns.totalMs': 'lnsTotalMs',
        classroom_assignment_ms: 'classroomAssignmentMs',
        diagnostics_finalize_ms: 'diagnosticsFinalizeMs',
        global_score_before_tabu: 'globalScoreBeforeTabu',
        global_score_after_tabu: 'globalScoreAfterTabu',
        global_score_delta: 'globalScoreDelta',
        final_placed_count: 'finalPlacedCount',
        total_sections: 'totalSections'
    }
    return mapping[key] || key
}

const isPlacedSection = (section) => Boolean(section?.coursePeriodIds && section.coursePeriodIds.length > 0)

const normalizeRelatedRefs = (record) => {
    if (Array.isArray(record?.related)) return record.related

    const legacyIds = record?.conflictingIds ?? record?.conflicting_ids
    if (!Array.isArray(legacyIds)) return []

    return legacyIds.map((entityId) => ({
        entityType: 'course_period',
        entityId,
        role: 'related'
    }))
}

const normalizeRecord = (record, family) => {
    if (!record || typeof record !== 'object') return null

    const subject = record.subject || {
        entityId: record.entityId ?? record.entity_id ?? record.id,
        entityType: record.entityType ?? record.entity_type ?? record.type ?? 'system'
    }

    const entityId = subject?.entityId
    const entityType = subject?.entityType
    const related = normalizeRelatedRefs(record)
    const targetRef = related.find((ref) => ['target', 'candidate', 'blocked_by', 'conflict'].includes(ref.role))

    const normalized = {
        ...record,
        family,
        entityId,
        entityType,
        targetEntityId: record.targetEntityId ?? record.target_entity_id ?? targetRef?.entityId ?? null,
        conflictingIds: record.conflictingIds ?? record.conflicting_ids ?? related.map((ref) => ref.entityId),
        message: record.message ?? record.log ?? record.reason ?? '',
        metrics: record.metrics ?? record.meta ?? {},
        severity: toDisplaySeverity(record),
        level: record.level ?? null,
        category: record.category ?? null,
        subject,
        related
    }

    if (normalized.entityId == null && !normalized.message && !normalized.code) return null
    return normalized
}

const normalizeTypeForLookup = (entityType) => {
    if (entityType === 'course_period') return 'period'
    if (entityType === 'request_group') return 'group'
    if (SECTION_ENTITY_TYPES.has(entityType)) return 'section'
    return entityType
}

const isSectionRecord = (record) => SECTION_ENTITY_TYPES.has(String(record?.entityType || '').toLowerCase())
const isSystemRecord = (record) => String(record?.entityType || '').toLowerCase() === 'system'
const isActionableSeverity = (severity) => ACTIONABLE_LEVELS.has(String(severity || '').toLowerCase())
const isSectionRef = (ref) => SECTION_ENTITY_TYPES.has(String(ref?.entityType || '').toLowerCase())

const getDecisionSectionIds = (record) => {
    const ids = new Set()

    if (isSectionRecord(record) && record?.entityId != null) {
        ids.add(String(record.entityId))
    }

    ;(record?.related || []).forEach((ref) => {
        if (!isSectionRef(ref) || ref?.entityId == null) return
        ids.add(String(ref.entityId))
    })

    return Array.from(ids)
}

const buildIdReferenceIndex = (dataset) => {
    const refIndex = EMPTY_REFERENCE_INDEX()
    const { index, typed } = refIndex

    const add = (id, label, type) => {
        if (id == null || !label) return
        const key = String(id)
        if (!index.has(key)) index.set(key, [])
        const values = index.get(key)
        if (!values.includes(label)) values.push(label)
        if (type && typed[type]) typed[type].set(key, label)
    }

    if (!dataset) return refIndex

    ;(dataset.courses || []).forEach((c) => add(c.courseId, `Course: ${c.course_name || c.name || c.courseId}`, 'course'))
    ;(dataset.teachers || []).forEach((t) => add(t.teacherId, `Teacher: ${t.teacher_name || t.name || t.teacherId}`, 'teacher'))
    ;(dataset.classrooms || []).forEach((r) => add(r.classroomId, `Room: ${r.room_name || r.classroom_name || r.name || r.classroomId}`, 'classroom'))
    ;(dataset.students || []).forEach((s) => add(s.studentId, `Student: ${s.student_name || s.name || s.studentId}`, 'student'))
    ;(dataset.sections || []).forEach((s) => add(s.sectionId, s.course_name ? `Section: ${s.course_name}` : `Section: ${s.sectionId}`, 'section'))
    ;(dataset.coursePeriods || []).forEach((p) => add(p.coursePeriodId, `Period: ${p.name || p.period_name || `P${p.coursePeriodId}`}`, 'period'))
    ;(dataset.scheduleStructure || []).forEach((ss) => {
        const periodName = ss.name || ss.period_name || `P${ss.coursePeriodId}`
        const timeWindow = ss.startTime && ss.endTime ? ` (${ss.startTime}-${ss.endTime})` : ''
        add(ss.coursePeriodId, `Period: ${periodName}${timeWindow}`, 'period')
    })
    ;(dataset.requestGroups || []).forEach((g) => add(g.groupId, `Group: ${g.groupId}`, 'group'))
    ;(dataset.lunches || []).forEach((l) => add(l.lunchId, `Lunch: ${l.lunchId}`, 'lunch'))

    return refIndex
}

const deriveReportData = (dataset) => {
    if (!dataset) {
        return {
            reportStats: null,
            courseStats: [],
            teacherLoad: [],
            roomUsage: [],
            periodLoad: [],
            sectionsWithoutRoom: [],
            studentStats: [],
            studentSeats: 0
        }
    }

    const sections = dataset.sections || []
    const courses = dataset.courses || []
    const requests = dataset.studentRequests || []
    const students = dataset.students || []

    let placed = 0
    let placedWithoutRoom = 0
    let locked = 0
    let labs = 0
    let inclusion = 0
    let totalStudentSeats = 0

    const teacherMap = {}
    const roomMap = {}

    sections.forEach((s) => {
        const isPlaced = isPlacedSection(s) && Boolean(s.quartersDays && s.quartersDays.length > 0)

        if (isPlaced) {
            placed += 1
            if (!s.classroomId) placedWithoutRoom += 1
        }

        if (s.locked) locked += 1
        if (s.isLab) labs += 1
        if (s.isInclusion) inclusion += 1

        const sectionSeatCount = Number(s.student_count || 0)
        totalStudentSeats += sectionSeatCount

        if (!teacherMap[s.teacherId]) {
            teacherMap[s.teacherId] = {
                id: s.teacherId,
                name: s.teacher_name,
                total: 0,
                placed: 0,
                labs: 0,
                inclusion: 0,
                students: 0
            }
        }
        teacherMap[s.teacherId].total += 1
        if (isPlacedSection(s)) teacherMap[s.teacherId].placed += 1
        if (s.isLab) teacherMap[s.teacherId].labs += 1
        if (s.isInclusion) teacherMap[s.teacherId].inclusion += 1
        teacherMap[s.teacherId].students += sectionSeatCount

        if (s.classroomId && s.coursePeriodIds) {
            if (!roomMap[s.classroomId]) {
                roomMap[s.classroomId] = {
                    id: s.classroomId,
                    name: s.room_name || `Room ${s.classroomId}`,
                    assignedPeriods: 0
                }
            }
            const dayCount = (s.days || '').split(',').filter(Boolean).length || 1
            roomMap[s.classroomId].assignedPeriods += (s.coursePeriodIds.length * dayCount)
        }
    })

    const reportStats = {
        total: sections.length,
        placed,
        unplaced: sections.length - placed,
        placedWithoutRoom,
        locked,
        labs,
        inclusion,
        studentSeats: totalStudentSeats,
        totalRequests: requests.length,
        placementRate: sections.length > 0 ? Math.round((placed / sections.length) * 100) : 0,
        fulfillmentRate: requests.length > 0 ? Math.round((totalStudentSeats / requests.length) * 100) : 0
    }

    const periodMap = {}
    ;(dataset.coursePeriods || []).forEach((cp) => {
        periodMap[cp.coursePeriodId] = cp.name
    })

    const periodLoadMap = {}
    const ensurePeriodRow = (periodId) => {
        if (!periodLoadMap[periodId]) {
            const structure = (dataset.scheduleStructure || []).find((ss) => String(ss.coursePeriodId) === String(periodId)) || {}
            periodLoadMap[periodId] = {
                periodId,
                name: periodMap[periodId] || structure.name || structure.period_name || `P${periodId}`,
                startTime: structure.startTime || structure.start_time || null,
                endTime: structure.endTime || structure.end_time || null,
                totalSections: 0,
                placedSections: 0,
                unplacedSections: 0,
                locked: 0,
                labs: 0,
                inclusion: 0,
                students: 0,
                teachers: new Set(),
                rooms: new Set()
            }
        }
        return periodLoadMap[periodId]
    }

    ;(dataset.coursePeriods || []).forEach((cp) => {
        ensurePeriodRow(cp.coursePeriodId)
    })
    ;(dataset.scheduleStructure || []).forEach((ss) => {
        ensurePeriodRow(ss.coursePeriodId)
    })

    sections.forEach((s) => {
        const periodIds = s.coursePeriodIds || []
        if (!Array.isArray(periodIds) || periodIds.length === 0) return

        const isPlaced = isPlacedSection(s) && Boolean(s.quartersDays && s.quartersDays.length > 0)
        const seatCount = Number(s.student_count || 0)

        periodIds.forEach((pid) => {
            const row = ensurePeriodRow(pid)
            row.totalSections += 1
            if (isPlaced) row.placedSections += 1
            else row.unplacedSections += 1
            if (s.locked) row.locked += 1
            if (s.isLab) row.labs += 1
            if (s.isInclusion) row.inclusion += 1
            row.students += seatCount
            if (s.teacherId != null) row.teachers.add(String(s.teacherId))
            if (s.classroomId != null) row.rooms.add(String(s.classroomId))
        })
    })

    const periodLoadRows = Object.values(periodLoadMap)
        .sort((a, b) => {
            const aTime = String(a.startTime || '')
            const bTime = String(b.startTime || '')
            const timeDelta = aTime.localeCompare(bTime)
            if (timeDelta !== 0) return timeDelta
            return Number(a.periodId) - Number(b.periodId)
        })
        .map((row) => ({
            periodId: row.periodId,
            name: row.name,
            startTime: row.startTime,
            endTime: row.endTime,
            totalSections: row.totalSections,
            placedSections: row.placedSections,
            unplacedSections: row.unplacedSections,
            locked: row.locked,
            labs: row.labs,
            inclusion: row.inclusion,
            students: row.students,
            teacherCount: row.teachers.size,
            roomCount: row.rooms.size
        }))
    const maxPlacedSections = periodLoadRows.reduce((max, row) => Math.max(max, row.placedSections), 0)
    const periodLoad = periodLoadRows.map((row) => ({
        ...row,
        relativeLoadPct: maxPlacedSections > 0 ? Math.round((row.placedSections / maxPlacedSections) * 100) : 0
    }))

    const sectionsWithoutRoom = sections
        .filter((s) => isPlacedSection(s) && !s.classroomId)
        .map((s) => ({
            ...s,
            periodNames: (s.coursePeriodIds || []).map((pid) => periodMap[pid] || `P${pid}`).join(', ')
        }))

    const studentGradeMap = {}
    students.forEach((st) => {
        const key = st.grade
        if (!studentGradeMap[key]) studentGradeMap[key] = { grade: key, total: 0, inclusion: 0 }
        studentGradeMap[key].total += 1
        if (st.inclusion) studentGradeMap[key].inclusion += 1
    })

    const courseMap = {}
    courses.forEach((c) => {
        courseMap[c.courseId] = {
            id: c.courseId,
            name: c.name,
            code: c.courseCode,
            inc: { type: 'Inclusion', total: 0, placed: 0, students: 0, studentsInPlaced: 0 },
            gen: { type: 'Gen-Ed', total: 0, placed: 0, students: 0, studentsInPlaced: 0 }
        }
    })

    sections.forEach((s) => {
        const course = courseMap[s.courseId]
        if (!course) return
        const target = s.isInclusion ? course.inc : course.gen
        target.total += 1
        if (isPlacedSection(s)) {
            target.placed += 1
            target.studentsInPlaced += Number(s.student_count || 0)
        }
    })

    requests.forEach((req) => {
        const course = courseMap[req.courseId]
        if (!course) return
        const target = req.isInclusion ? course.inc : course.gen
        target.students += 1
    })

    const courseRows = []
    Object.values(courseMap).forEach((course) => {
        if (course.inc.total > 0 || course.inc.students > 0) {
            courseRows.push({
                courseId: course.id,
                name: course.name,
                code: course.code,
                ...course.inc,
                avgSize: course.inc.placed > 0 ? (course.inc.studentsInPlaced / course.inc.placed).toFixed(1) : 0
            })
        }
        if (course.gen.total > 0 || course.gen.students > 0) {
            courseRows.push({
                courseId: course.id,
                name: course.name,
                code: course.code,
                ...course.gen,
                avgSize: course.gen.placed > 0 ? (course.gen.studentsInPlaced / course.gen.placed).toFixed(1) : 0
            })
        }
    })

    return {
        reportStats,
        courseStats: courseRows.sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.type).localeCompare(String(b.type))),
        teacherLoad: Object.values(teacherMap).sort((a, b) => b.total - a.total),
        roomUsage: Object.values(roomMap).sort((a, b) => b.assignedPeriods - a.assignedPeriods),
        periodLoad,
        sectionsWithoutRoom,
        studentStats: Object.values(studentGradeMap).sort((a, b) => String(a.grade).localeCompare(String(b.grade))),
        studentSeats: totalStudentSeats
    }
}

const normalizeObservability = (observability) => {
    if (!observability) {
        return {
            sectionDiagnostics: [],
            sectionDecisions: [],
            studentDiagnostics: [],
            studentDecisions: []
        }
    }

    const legacyValidation = observability.validation || observability.validation_diagnostics || []
    const legacySectionDiagnostics = observability.sectionPlacement || observability.section_placement || []
    const legacyStudentDiagnostics = observability.studentPlacement || observability.student_placement || []

    return {
        sectionDiagnostics: (observability.sectionDiagnostics || legacySectionDiagnostics || []).map((record) => normalizeRecord(record, 'diagnostics')).filter(Boolean),
        sectionDecisions: (observability.sectionDecisions || []).map((record) => normalizeRecord(record, 'decisions')).filter(Boolean),
        studentDiagnostics: [...legacyValidation, ...(observability.studentDiagnostics || legacyStudentDiagnostics || [])].map((record) => normalizeRecord(record, 'diagnostics')).filter(Boolean),
        studentDecisions: (observability.studentDecisions || []).map((record) => normalizeRecord(record, 'decisions')).filter(Boolean)
    }
}

const deriveDiagnosticsData = (dataset, observability) => {
    const idReferenceIndex = buildIdReferenceIndex(dataset)
    const empty = {
        validationDiagnostics: [],
        sectionPlacementDiagnostics: [],
        studentPlacementDiagnostics: [],
        sectionDecisionLogs: [],
        studentDecisionLogs: [],
        sectionDiagnosticsIndex: { bySectionId: new Map(), countsBySectionId: new Map() },
        sectionDecisionIndex: { bySectionId: new Map(), countsBySectionId: new Map() },
        sectionRows: [],
        unplacedSectionRows: [],
        placedSectionRows: [],
        invalidSectionRows: [],
        systemDiagnostics: [],
        allDecisionLogs: [],
        systemDecisionLogs: [],
        validationIssueCount: 0,
        hasAnyDiagnostics: false,
        hasAnyDecisionLogs: false,
        systemMetrics: {},
        periodOpportunitySummary: null,
        periodOpportunityRows: [],
        teacherBreakSummary: null,
        teacherBreakRows: [],
        performanceTimingRows: [],
        diagnosticScopeIndex: new WeakMap(),
        decisionScopeIndex: new WeakMap(),
        idReferenceIndex
    }

    if (!observability) return empty

    const normalized = normalizeObservability(observability)
    const sectionPlacement = normalized.sectionDiagnostics
    const studentPlacement = normalized.studentDiagnostics
    const sectionDecisionLogs = normalized.sectionDecisions
    const studentDecisionLogs = normalized.studentDecisions
    const allDiagnostics = [...sectionPlacement, ...studentPlacement]
    const validation = allDiagnostics.filter((record) => record.category === 'validation')

    const diagnosticBySectionId = new Map()
    const diagnosticCountsBySectionId = new Map()
    const decisionBySectionId = new Map()
    const decisionCountsBySectionId = new Map()
    const invalidCountsBySectionId = new Map()

    sectionPlacement.forEach((record) => {
        if (!isSectionRecord(record)) return
        const key = String(record.entityId)
        if (!diagnosticBySectionId.has(key)) diagnosticBySectionId.set(key, [])
        diagnosticBySectionId.get(key).push(record)

        if (!diagnosticCountsBySectionId.has(key)) diagnosticCountsBySectionId.set(key, { actionable: 0, total: 0 })
        const counts = diagnosticCountsBySectionId.get(key)
        counts.total += 1
        if (isActionableSeverity(record.severity)) counts.actionable += 1
    })

    validation.forEach((record) => {
        if (!isSectionRecord(record) || String(record.level) !== 'error') return
        const key = String(record.entityId)
        invalidCountsBySectionId.set(key, (invalidCountsBySectionId.get(key) || 0) + 1)
    })

    sectionDecisionLogs.forEach((record) => {
        const sectionIds = getDecisionSectionIds(record)
        if (sectionIds.length === 0) return

        sectionIds.forEach((key) => {
            if (!decisionBySectionId.has(key)) decisionBySectionId.set(key, [])
            decisionBySectionId.get(key).push(record)

            decisionCountsBySectionId.set(key, (decisionCountsBySectionId.get(key) || 0) + 1)
        })
    })

    const rows = (dataset?.sections || [])
        .map((section) => {
            const diagnosticCounts = diagnosticCountsBySectionId.get(String(section.sectionId)) || { actionable: 0, total: 0 }
            return {
                ...section,
                isPlaced: isPlacedSection(section),
                isInvalid: (invalidCountsBySectionId.get(String(section.sectionId)) || 0) > 0,
                invalidDiagnosticCount: invalidCountsBySectionId.get(String(section.sectionId)) || 0,
                diagnosticCount: diagnosticCounts.actionable,
                diagnosticTotalCount: diagnosticCounts.total,
                decisionCount: decisionCountsBySectionId.get(String(section.sectionId)) || 0
            }
        })
        .sort((a, b) => {
            if (a.isPlaced !== b.isPlaced) return a.isPlaced ? 1 : -1
            const activityDelta = (b.decisionCount + b.diagnosticCount) - (a.decisionCount + a.diagnosticCount)
            if (activityDelta !== 0) return activityDelta
            return String(a.course_name || '').localeCompare(String(b.course_name || ''))
        })

    const systemMetrics = {}
    const timingOrder = [
        'prePopulateMs',
        'greedyPlacementMs',
        'beamTotalMs',
        'multistartTotalMs',
        'tabuSearchMs',
        'lnsTotalMs',
        'classroomAssignmentMs',
        'diagnosticsFinalizeMs',
        'totalRunMs'
    ]
    const performanceTimingRows = []
    const periodOpportunityRows = []
    let periodOpportunitySummary = null
    const teacherBreakRows = []
    let teacherBreakSummary = null

    sectionPlacement.forEach((record) => {
        if (!record.metrics) return

        const metricType = record.metrics.metricType
        if (record.code === 'section.performance.timing' || metricType === 'performance_timing') {
            performanceTimingRows.push({
                key: String(record.metrics.key || '-'),
                label: String(record.metrics.label || record.metrics.key || '-'),
                milliseconds: Number(record.metrics.milliseconds || 0),
                order: record.metrics.order == null ? Number.MAX_SAFE_INTEGER : Number(record.metrics.order),
                shareOfTotal: record.metrics.shareOfTotal == null ? null : Number(record.metrics.shareOfTotal),
            })
        } else if (record.code === 'section.performance.period_opportunity_period' || metricType === 'period_opportunity') {
            const periodId = record.related.find((ref) => ref.entityType === 'course_period')?.entityId ?? record.metrics.periodId ?? record.conflictingIds?.[0]
            periodOpportunityRows.push({
                periodId,
                startTime: record.metrics.startTime || '-',
                endTime: record.metrics.endTime || '-',
                opportunityCount: Number(record.metrics.opportunityCount || 0),
                assignedCount: Number(record.metrics.assignedCount || 0),
                targetAssigned: Number(record.metrics.targetAssigned || 0),
                opportunityShare: Number(record.metrics.opportunityShare || 0),
                assignedShare: Number(record.metrics.assignedShare || 0),
                deltaShare: Number(record.metrics.deltaShare || 0),
                loadIndex: Number(record.metrics.loadIndex || 0),
            })
        } else if (record.code === 'section.performance.period_opportunity_summary' || metricType === 'period_opportunity_summary') {
            periodOpportunitySummary = {
                imbalanceScore: Number(record.metrics.imbalanceScore || 0),
                periodCount: Number(record.metrics.periodCount || 0),
            }
        } else if (record.code === 'section.performance.teacher_break_period' || metricType === 'teacher_break_period') {
            const periodId = record.related.find((ref) => ref.entityType === 'course_period')?.entityId ?? record.metrics.periodId ?? record.conflictingIds?.[0]
            teacherBreakRows.push({
                periodId,
                startTime: record.metrics.startTime || '-',
                endTime: record.metrics.endTime || '-',
                teacherBreakCount: Number(record.metrics.teacherBreakCount || 0),
                teacherBreakShare: Number(record.metrics.teacherBreakShare || 0),
                teacherWithBreakCount: Number(record.metrics.teacherWithBreakCount || 0),
            })
        } else if (record.code === 'section.performance.teacher_break_summary' || metricType === 'teacher_break_summary') {
            teacherBreakSummary = {
                totalTeacherBreaks: Number(record.metrics.totalTeacherBreaks || 0),
                breakConcentrationIndex: Number(record.metrics.breakConcentrationIndex || 0),
                periodCount: Number(record.metrics.periodCount || 0),
            }
        }

        if (!isSystemRecord(record)) return

        Object.entries(record.metrics).forEach(([key, value]) => {
            const normalizedKey = normalizeMetricKey(key)
            if (normalizedKey === 'performanceMetrics' && value && typeof value === 'object' && !Array.isArray(value)) {
                Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                    systemMetrics[normalizeMetricKey(nestedKey)] = nestedValue
                })
                return
            }
            systemMetrics[normalizedKey] = value
        })
    })

    const derivedPerformanceTimingRows = (performanceTimingRows.length > 0
        ? performanceTimingRows
        : Object.entries(systemMetrics)
            .filter(([key, value]) => /ms$/i.test(String(key)) && value != null && !Number.isNaN(Number(value)))
            .map(([key, value]) => ({
                key,
                label: String(key),
                milliseconds: Number(value),
                order: Number.MAX_SAFE_INTEGER,
                shareOfTotal: null,
            })))
        .sort((a, b) => {
            if (a.order !== b.order) return a.order - b.order
            const aIdx = timingOrder.indexOf(a.key)
            const bIdx = timingOrder.indexOf(b.key)
            const normalizedA = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx
            const normalizedB = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx
            if (normalizedA !== normalizedB) return normalizedA - normalizedB
            return a.label.localeCompare(b.label)
        })

    const diagnosticScopeIndex = new WeakMap()
    sectionPlacement.forEach((record) => diagnosticScopeIndex.set(record, 'sectionDiagnostics'))
    studentPlacement.forEach((record) => diagnosticScopeIndex.set(record, 'studentDiagnostics'))

    const decisionScopeIndex = new WeakMap()
    sectionDecisionLogs.forEach((record) => decisionScopeIndex.set(record, 'sectionDecisions'))
    studentDecisionLogs.forEach((record) => decisionScopeIndex.set(record, 'studentDecisions'))

    const allDecisionLogs = [...sectionDecisionLogs, ...studentDecisionLogs]

    return {
        validationDiagnostics: validation,
        sectionPlacementDiagnostics: sectionPlacement,
        studentPlacementDiagnostics: studentPlacement,
        sectionDecisionLogs,
        studentDecisionLogs,
        sectionDiagnosticsIndex: { bySectionId: diagnosticBySectionId, countsBySectionId: diagnosticCountsBySectionId },
        sectionDecisionIndex: { bySectionId: decisionBySectionId, countsBySectionId: decisionCountsBySectionId },
        sectionRows: rows,
        unplacedSectionRows: rows.filter((section) => !section.isPlaced && !section.isInvalid),
        placedSectionRows: rows.filter((section) => section.isPlaced),
        invalidSectionRows: rows
            .filter((section) => section.isInvalid)
            .sort((a, b) => {
                const invalidDelta = (b.invalidDiagnosticCount || 0) - (a.invalidDiagnosticCount || 0)
                if (invalidDelta !== 0) return invalidDelta
                return String(a.course_name || '').localeCompare(String(b.course_name || ''))
            }),
        systemDiagnostics: allDiagnostics.filter((record) => isSystemRecord(record) && record.category !== 'validation'),
        allDecisionLogs,
        systemDecisionLogs: allDecisionLogs.filter(isSystemRecord),
        validationIssueCount: validation.reduce((count, record) => count + (isActionableSeverity(record.severity) ? 1 : 0), 0),
        hasAnyDiagnostics: allDiagnostics.length > 0,
        hasAnyDecisionLogs: allDecisionLogs.length > 0,
        systemMetrics,
        performanceTimingRows: derivedPerformanceTimingRows,
        periodOpportunitySummary,
        periodOpportunityRows: periodOpportunityRows.sort((a, b) => {
            const startDelta = String(a.startTime || '').localeCompare(String(b.startTime || ''))
            if (startDelta !== 0) return startDelta
            return String(a.periodId || '').localeCompare(String(b.periodId || ''), undefined, { numeric: true })
        }),
        teacherBreakSummary,
        teacherBreakRows: teacherBreakRows.sort((a, b) => {
            const startDelta = String(a.startTime || '').localeCompare(String(b.startTime || ''))
            if (startDelta !== 0) return startDelta
            return String(a.periodId || '').localeCompare(String(b.periodId || ''), undefined, { numeric: true })
        }),
        diagnosticScopeIndex,
        decisionScopeIndex,
        idReferenceIndex
    }
}

export function useDerivedSchedulerData() {
    const dataset = computed(() => store.localDataset)
    const observability = computed(() => store.localDataset?.observability ?? store.localDataset?.diagnostics ?? null)

    const reportDerived = computed(() => deriveReportData(dataset.value))
    const diagnosticsDerived = computed(() => deriveDiagnosticsData(dataset.value, observability.value))

    const resolveIdName = (id, preferredType = null) => {
        if (id == null) return '-'
        const key = String(id)
        const refIndex = diagnosticsDerived.value.idReferenceIndex
        const normalizedType = preferredType ? normalizeTypeForLookup(preferredType) : null

        if (normalizedType && refIndex.typed?.[normalizedType]?.has(key)) {
            return refIndex.typed[normalizedType].get(key)
        }

        const options = refIndex.index.get(key) || []
        if (options.length === 0) return 'Unknown'
        if (options.length === 1) return options[0]
        return `${options[0]} (+${options.length - 1} more)`
    }

    const getDiagnosticScope = (record) => diagnosticsDerived.value.diagnosticScopeIndex.get(record) || '-'
    const getDecisionScope = (record) => diagnosticsDerived.value.decisionScopeIndex.get(record) || '-'

    return {
        reportStats: computed(() => reportDerived.value.reportStats),
        courseStats: computed(() => reportDerived.value.courseStats),
        teacherLoad: computed(() => reportDerived.value.teacherLoad),
        roomUsage: computed(() => reportDerived.value.roomUsage),
        periodLoad: computed(() => reportDerived.value.periodLoad),
        sectionsWithoutRoom: computed(() => reportDerived.value.sectionsWithoutRoom),
        studentStats: computed(() => reportDerived.value.studentStats),
        studentSeats: computed(() => reportDerived.value.studentSeats),

        sectionPlacementDiagnostics: computed(() => diagnosticsDerived.value.sectionPlacementDiagnostics),
        validationDiagnostics: computed(() => diagnosticsDerived.value.validationDiagnostics),
        studentPlacementDiagnostics: computed(() => diagnosticsDerived.value.studentPlacementDiagnostics),
        sectionDecisionLogs: computed(() => diagnosticsDerived.value.sectionDecisionLogs),
        studentDecisionLogs: computed(() => diagnosticsDerived.value.studentDecisionLogs),
        sectionDiagnosticsIndex: computed(() => diagnosticsDerived.value.sectionDiagnosticsIndex),
        sectionDecisionIndex: computed(() => diagnosticsDerived.value.sectionDecisionIndex),
        sectionRows: computed(() => diagnosticsDerived.value.sectionRows),
        unplacedSectionRows: computed(() => diagnosticsDerived.value.unplacedSectionRows),
        placedSectionRows: computed(() => diagnosticsDerived.value.placedSectionRows),
        invalidSectionRows: computed(() => diagnosticsDerived.value.invalidSectionRows),
        systemDiagnostics: computed(() => diagnosticsDerived.value.systemDiagnostics),
        allDecisionLogs: computed(() => diagnosticsDerived.value.allDecisionLogs),
        systemDecisionLogs: computed(() => diagnosticsDerived.value.systemDecisionLogs),
        validationIssueCount: computed(() => diagnosticsDerived.value.validationIssueCount),
        hasAnyDiagnostics: computed(() => diagnosticsDerived.value.hasAnyDiagnostics),
        hasAnyDecisionLogs: computed(() => diagnosticsDerived.value.hasAnyDecisionLogs),
        systemMetrics: computed(() => diagnosticsDerived.value.systemMetrics),
        performanceTimingRows: computed(() => diagnosticsDerived.value.performanceTimingRows),
        periodOpportunitySummary: computed(() => diagnosticsDerived.value.periodOpportunitySummary),
        periodOpportunityRows: computed(() => diagnosticsDerived.value.periodOpportunityRows),
        teacherBreakSummary: computed(() => diagnosticsDerived.value.teacherBreakSummary),
        teacherBreakRows: computed(() => diagnosticsDerived.value.teacherBreakRows),

        resolveIdName,
        getDiagnosticScope,
        getDecisionScope,
        isActionableSeverity,
    }
}
