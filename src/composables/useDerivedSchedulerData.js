import { computed } from 'vue'
import { store } from '../store'

const DECISION_CODES = new Set([
    'DECISION_SUMMARY',
    'CANDIDATE_REJECTED_FILTER',
    'CANDIDATE_SELECTED',
    'VALID_CANDIDATE_SUMMARY',
    'VALID_CANDIDATE_SCORED',
    'SECTION_FINAL_PLACEMENT'
])

const ACTIONABLE_SEVERITIES = new Set(['fatal', 'skip', 'blocking', 'preserved_conflict'])
const VALIDATION_ISSUE_SEVERITIES = new Set(['fatal', 'skip', 'blocking'])

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

const normalizeDiagnostic = (diagnostic) => {
    if (!diagnostic || typeof diagnostic !== 'object') return null

    const inferredEntityId = diagnostic.entityId ?? diagnostic.entity_id ?? diagnostic.id
    const inferredEntityType = diagnostic.entityType ?? diagnostic.entity_type ?? diagnostic.type

    const normalized = {
        ...diagnostic,
        entityId: inferredEntityId,
        entityType: inferredEntityType,
        targetEntityId: diagnostic.targetEntityId ?? diagnostic.target_entity_id,
        conflictingIds: diagnostic.conflictingIds ?? diagnostic.conflicting_ids,
        message: diagnostic.message ?? diagnostic.log ?? diagnostic.reason ?? '',
        metrics: diagnostic.metrics ?? diagnostic.meta
    }

    if (normalized.entityId == null && !normalized.message && !normalized.code) return null
    return normalized
}

const normalizeMetricKey = (key) => {
    const mapping = {
        pre_populate_ms: 'prePopulateMs',
        greedy_placement_ms: 'greedyPlacementMs',
        total_run_ms: 'totalRunMs',
        tabu_search_ms: 'tabuSearchMs',
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

const TIMING_LABELS = {
    prePopulateMs: 'Pre-populate Calendars',
    greedyPlacementMs: 'Greedy Placement',
    tabuSearchMs: 'Tabu Search',
    classroomAssignmentMs: 'Classroom Assignment',
    diagnosticsFinalizeMs: 'Diagnostics Finalization',
    totalRunMs: 'Total Runtime'
}

const formatTimingLabel = (key) => {
    if (TIMING_LABELS[key]) return TIMING_LABELS[key]
    return String(key)
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

const deriveDiagnosticsData = (dataset, diagnostics) => {
    const empty = {
        validationDiagnostics: [],
        sectionPlacementDiagnostics: [],
        studentPlacementDiagnostics: [],
        sectionDiagnosticsIndex: { bySectionId: new Map(), countsBySectionId: new Map() },
        sectionRows: [],
        unplacedSectionRows: [],
        placedSectionRows: [],
        invalidSectionRows: [],
        systemAndDecisionDiagnostics: [],
        validationIssueCount: 0,
        hasAnyDiagnostics: false,
        systemMetrics: {},
        periodOpportunitySummary: null,
        periodOpportunityRows: [],
        teacherBreakSummary: null,
        teacherBreakRows: [],
        diagnosticScopeIndex: new WeakMap(),
        idReferenceIndex: buildIdReferenceIndex(dataset)
    }

    if (!diagnostics) return empty

    const validationRaw = diagnostics?.validation || diagnostics?.validation_diagnostics || []
    const sectionPlacementRaw = diagnostics?.sectionPlacement || diagnostics?.section_placement || []
    const studentPlacementRaw = diagnostics?.studentPlacement || diagnostics?.student_placement || []

    const validation = validationRaw.map(normalizeDiagnostic).filter(Boolean)
    const sectionPlacement = sectionPlacementRaw.map(normalizeDiagnostic).filter(Boolean)
    const studentPlacement = studentPlacementRaw.map(normalizeDiagnostic).filter(Boolean)

    const bySectionId = new Map()
    const countsBySectionId = new Map()
    const invalidCountsBySectionId = new Map()

    sectionPlacement.forEach((d) => {
        if (String(d.entityType || '').toLowerCase() !== 'section') return
        const key = String(d.entityId)
        if (!bySectionId.has(key)) bySectionId.set(key, [])
        bySectionId.get(key).push(d)

        if (!countsBySectionId.has(key)) countsBySectionId.set(key, { actionable: 0, trace: 0 })
        const counts = countsBySectionId.get(key)
        if (ACTIONABLE_SEVERITIES.has(d.severity)) counts.actionable += 1
        if (d.severity === 'non_blocking' || DECISION_CODES.has(d.code)) counts.trace += 1
    })

    validation.forEach((d) => {
        if (String(d.entityType || '').toLowerCase() !== 'section') return
        const key = String(d.entityId)
        if (!bySectionId.has(key)) bySectionId.set(key, [])
        bySectionId.get(key).push(d)

        if (!countsBySectionId.has(key)) countsBySectionId.set(key, { actionable: 0, trace: 0 })
        const counts = countsBySectionId.get(key)
        if (ACTIONABLE_SEVERITIES.has(d.severity)) counts.actionable += 1

        if (d.severity === 'skip') {
            invalidCountsBySectionId.set(key, (invalidCountsBySectionId.get(key) || 0) + 1)
        }
    })

    const rows = (dataset?.sections || [])
        .map((s) => {
            const counts = countsBySectionId.get(String(s.sectionId)) || { actionable: 0, trace: 0 }
            const isPlaced = isPlacedSection(s)
            return {
                ...s,
                isPlaced,
                isInvalid: (invalidCountsBySectionId.get(String(s.sectionId)) || 0) > 0,
                invalidDiagnosticCount: invalidCountsBySectionId.get(String(s.sectionId)) || 0,
                diagnosticCount: counts.actionable,
                traceCount: counts.trace
            }
        })
        .sort((a, b) => {
            if (a.isPlaced !== b.isPlaced) return a.isPlaced ? 1 : -1
            const diagDelta = (b.traceCount + b.diagnosticCount) - (a.traceCount + a.diagnosticCount)
            if (diagDelta !== 0) return diagDelta
            return String(a.course_name || '').localeCompare(String(b.course_name || ''))
        })

    const filtered = []
    validation.forEach((d) => {
        if (String(d.entityType || '').toLowerCase() === 'system' || DECISION_CODES.has(d.code)) filtered.push(d)
    })
    sectionPlacement.forEach((d) => {
        if (String(d.entityType || '').toLowerCase() === 'system' || DECISION_CODES.has(d.code)) filtered.push(d)
    })
    studentPlacement.forEach((d) => {
        if (String(d.entityType || '').toLowerCase() === 'system' || DECISION_CODES.has(d.code)) filtered.push(d)
    })

    const metrics = {}
    const timingOrder = [
        'prePopulateMs',
        'greedyPlacementMs',
        'tabuSearchMs',
        'classroomAssignmentMs',
        'diagnosticsFinalizeMs',
        'totalRunMs'
    ]
    const periodOpportunityRows = []
    let periodOpportunitySummary = null
    const teacherBreakRows = []
    let teacherBreakSummary = null
    sectionPlacement.forEach((d) => {
        const entityType = String(d.entityType || '').toLowerCase()
        const isSystemDiagnostic = entityType === 'system' || d.entityId === 0 || d.entityId === '0'
        if (!isSystemDiagnostic || !d.metrics) return
        const isPerformanceSummary = d.code === 'DECISION_SUMMARY' && d.message === 'Section placement performance metrics.'
        Object.entries(d.metrics).forEach(([k, v]) => {
            const normalizedKey = normalizeMetricKey(k)
            if (normalizedKey === 'performanceMetrics' && v && typeof v === 'object' && !Array.isArray(v)) {
                Object.entries(v).forEach(([nestedKey, nestedValue]) => {
                    metrics[normalizeMetricKey(nestedKey)] = nestedValue
                })
                return
            }

            metrics[normalizedKey] = v
        })

        if (isPerformanceSummary && d.metrics.performanceMetrics && typeof d.metrics.performanceMetrics === 'object') {
            Object.entries(d.metrics.performanceMetrics).forEach(([k, v]) => {
                metrics[normalizeMetricKey(k)] = v
            })
        }

        if (d.metrics.metricType === 'period_opportunity') {
            const periodId = d.conflictingIds?.[0] ?? d.metrics.periodId
            periodOpportunityRows.push({
                periodId,
                startTime: d.metrics.startTime || '-',
                endTime: d.metrics.endTime || '-',
                opportunityCount: Number(d.metrics.opportunityCount || 0),
                assignedCount: Number(d.metrics.assignedCount || 0),
                targetAssigned: Number(d.metrics.targetAssigned || 0),
                opportunityShare: Number(d.metrics.opportunityShare || 0),
                assignedShare: Number(d.metrics.assignedShare || 0),
                deltaShare: Number(d.metrics.deltaShare || 0),
                loadIndex: Number(d.metrics.loadIndex || 0),
            })
        } else if (d.metrics.metricType === 'period_opportunity_summary') {
            periodOpportunitySummary = {
                imbalanceScore: Number(d.metrics.imbalanceScore || 0),
                periodCount: Number(d.metrics.periodCount || 0),
            }
        } else if (d.metrics.metricType === 'teacher_break_period') {
            const periodId = d.conflictingIds?.[0] ?? d.metrics.periodId
            teacherBreakRows.push({
                periodId,
                startTime: d.metrics.startTime || '-',
                endTime: d.metrics.endTime || '-',
                teacherBreakCount: Number(d.metrics.teacherBreakCount || 0),
                teacherBreakShare: Number(d.metrics.teacherBreakShare || 0),
                teacherWithBreakCount: Number(d.metrics.teacherWithBreakCount || 0),
            })
        } else if (d.metrics.metricType === 'teacher_break_summary') {
            teacherBreakSummary = {
                totalTeacherBreaks: Number(d.metrics.totalTeacherBreaks || 0),
                breakConcentrationIndex: Number(d.metrics.breakConcentrationIndex || 0),
                periodCount: Number(d.metrics.periodCount || 0),
            }
        }
    })

    const performanceTimingRows = Object.entries(metrics)
        .filter(([key, value]) => /ms$/i.test(String(key)) && value != null && !Number.isNaN(Number(value)))
        .map(([key, value]) => ({
            key,
            label: formatTimingLabel(key),
            milliseconds: Number(value)
        }))
        .sort((a, b) => {
            const aIdx = timingOrder.indexOf(a.key)
            const bIdx = timingOrder.indexOf(b.key)
            const normalizedA = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx
            const normalizedB = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx
            if (normalizedA !== normalizedB) return normalizedA - normalizedB
            return a.label.localeCompare(b.label)
        })

    const scopeMap = new WeakMap()
    validation.forEach((d) => scopeMap.set(d, 'validation'))
    sectionPlacement.forEach((d) => scopeMap.set(d, 'sectionPlacement'))
    studentPlacement.forEach((d) => scopeMap.set(d, 'studentPlacement'))

    return {
        validationDiagnostics: validation,
        sectionPlacementDiagnostics: sectionPlacement,
        studentPlacementDiagnostics: studentPlacement,
        sectionDiagnosticsIndex: { bySectionId, countsBySectionId },
        sectionRows: rows,
        unplacedSectionRows: rows.filter((s) => !s.isPlaced && !s.isInvalid),
        placedSectionRows: rows.filter((s) => s.isPlaced),
        invalidSectionRows: rows
            .filter((s) => s.isInvalid)
            .sort((a, b) => {
                const invalidDelta = (b.invalidDiagnosticCount || 0) - (a.invalidDiagnosticCount || 0)
                if (invalidDelta !== 0) return invalidDelta
                return String(a.course_name || '').localeCompare(String(b.course_name || ''))
            }),
        systemAndDecisionDiagnostics: filtered,
        validationIssueCount: validation.reduce((count, d) => count + (VALIDATION_ISSUE_SEVERITIES.has(d.severity) ? 1 : 0), 0),
        hasAnyDiagnostics: (validation.length > 0 || sectionPlacement.length > 0 || studentPlacement.length > 0),
        systemMetrics: metrics,
        performanceTimingRows,
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
        diagnosticScopeIndex: scopeMap,
        idReferenceIndex: buildIdReferenceIndex(dataset)
    }
}

export function useDerivedSchedulerData() {
    const dataset = computed(() => store.localDataset)
    const diagnostics = computed(() => store.localDataset?.diagnostics ?? null)

    const reportDerived = computed(() => deriveReportData(dataset.value))
    const diagnosticsDerived = computed(() => deriveDiagnosticsData(dataset.value, diagnostics.value))

    const resolveIdName = (id, preferredType = null) => {
        if (id == null) return '-'
        const key = String(id)
        const refIndex = diagnosticsDerived.value.idReferenceIndex

        if (preferredType && refIndex.typed?.[preferredType]?.has(key)) {
            return refIndex.typed[preferredType].get(key)
        }

        const options = refIndex.index.get(key) || []
        if (options.length === 0) return 'Unknown'
        if (options.length === 1) return options[0]
        return `${options[0]} (+${options.length - 1} more)`
    }

    const getDiagnosticScope = (diagnostic) => diagnosticsDerived.value.diagnosticScopeIndex.get(diagnostic) || '-'
    const isActionableSeverity = (severity) => ACTIONABLE_SEVERITIES.has(severity)

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
        sectionDiagnosticsIndex: computed(() => diagnosticsDerived.value.sectionDiagnosticsIndex),
        sectionRows: computed(() => diagnosticsDerived.value.sectionRows),
        unplacedSectionRows: computed(() => diagnosticsDerived.value.unplacedSectionRows),
        placedSectionRows: computed(() => diagnosticsDerived.value.placedSectionRows),
        invalidSectionRows: computed(() => diagnosticsDerived.value.invalidSectionRows),
        systemAndDecisionDiagnostics: computed(() => diagnosticsDerived.value.systemAndDecisionDiagnostics),
        validationIssueCount: computed(() => diagnosticsDerived.value.validationIssueCount),
        hasAnyDiagnostics: computed(() => diagnosticsDerived.value.hasAnyDiagnostics),
        systemMetrics: computed(() => diagnosticsDerived.value.systemMetrics),
        performanceTimingRows: computed(() => diagnosticsDerived.value.performanceTimingRows),
        periodOpportunitySummary: computed(() => diagnosticsDerived.value.periodOpportunitySummary),
        periodOpportunityRows: computed(() => diagnosticsDerived.value.periodOpportunityRows),
        teacherBreakSummary: computed(() => diagnosticsDerived.value.teacherBreakSummary),
        teacherBreakRows: computed(() => diagnosticsDerived.value.teacherBreakRows),

        resolveIdName,
        getDiagnosticScope,
        isActionableSeverity,
        decisionCodes: DECISION_CODES
    }
}
