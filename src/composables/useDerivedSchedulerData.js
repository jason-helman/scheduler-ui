import { shallowRef, watch } from 'vue'
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

const reportStats = shallowRef(null)
const courseStats = shallowRef([])
const teacherLoad = shallowRef([])
const roomUsage = shallowRef([])
const sectionsWithoutRoom = shallowRef([])
const studentStats = shallowRef([])
const studentSeats = shallowRef(0)

const sectionPlacementDiagnostics = shallowRef([])
const validationDiagnostics = shallowRef([])
const studentPlacementDiagnostics = shallowRef([])
const sectionDiagnosticsIndex = shallowRef({ bySectionId: new Map(), countsBySectionId: new Map() })
const sectionRows = shallowRef([])
const unplacedSectionRows = shallowRef([])
const placedSectionRows = shallowRef([])
const invalidSectionRows = shallowRef([])
const systemAndDecisionDiagnostics = shallowRef([])
const validationIssueCount = shallowRef(0)
const hasAnyDiagnostics = shallowRef(false)
const systemMetrics = shallowRef({})
const diagnosticScopeIndex = shallowRef(new WeakMap())
const idReferenceIndex = shallowRef(EMPTY_REFERENCE_INDEX())

let initialized = false

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
        total_run_ms: 'totalRunMs',
        tabu_search_ms: 'tabuSearchMs',
        global_score_before_tabu: 'globalScoreBeforeTabu',
        global_score_after_tabu: 'globalScoreAfterTabu',
        global_score_delta: 'globalScoreDelta',
        final_placed_count: 'finalPlacedCount',
        total_sections: 'totalSections'
    }
    return mapping[key] || key
}

const isPlacedSection = (section) => Boolean(section?.coursePeriodIds && section.coursePeriodIds.length > 0)

const buildReportData = (dataset) => {
    if (!dataset) {
        reportStats.value = null
        courseStats.value = []
        teacherLoad.value = []
        roomUsage.value = []
        sectionsWithoutRoom.value = []
        studentStats.value = []
        studentSeats.value = 0
        return
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

    reportStats.value = {
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

    studentSeats.value = totalStudentSeats
    teacherLoad.value = Object.values(teacherMap).sort((a, b) => b.total - a.total)
    roomUsage.value = Object.values(roomMap).sort((a, b) => b.assignedPeriods - a.assignedPeriods)

    const periodMap = {}
    ;(dataset.coursePeriods || []).forEach((cp) => {
        periodMap[cp.coursePeriodId] = cp.name
    })
    sectionsWithoutRoom.value = sections
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
    studentStats.value = Object.values(studentGradeMap).sort((a, b) => String(a.grade).localeCompare(String(b.grade)))

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

    const rows = []
    Object.values(courseMap).forEach((course) => {
        if (course.inc.total > 0 || course.inc.students > 0) {
            rows.push({
                courseId: course.id,
                name: course.name,
                code: course.code,
                ...course.inc,
                avgSize: course.inc.placed > 0 ? (course.inc.studentsInPlaced / course.inc.placed).toFixed(1) : 0
            })
        }
        if (course.gen.total > 0 || course.gen.students > 0) {
            rows.push({
                courseId: course.id,
                name: course.name,
                code: course.code,
                ...course.gen,
                avgSize: course.gen.placed > 0 ? (course.gen.studentsInPlaced / course.gen.placed).toFixed(1) : 0
            })
        }
    })
    courseStats.value = rows.sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.type).localeCompare(String(b.type)))
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

const buildDiagnosticsData = (dataset, diagnostics) => {
    const validationRaw = diagnostics?.validation || diagnostics?.validation_diagnostics || []
    const sectionPlacementRaw = diagnostics?.sectionPlacement || diagnostics?.section_placement || []
    const studentPlacementRaw = diagnostics?.studentPlacement || diagnostics?.student_placement || []

    const validation = validationRaw.map(normalizeDiagnostic).filter(Boolean)
    const sectionPlacement = sectionPlacementRaw.map(normalizeDiagnostic).filter(Boolean)
    const studentPlacement = studentPlacementRaw.map(normalizeDiagnostic).filter(Boolean)

    validationDiagnostics.value = validation
    sectionPlacementDiagnostics.value = sectionPlacement
    studentPlacementDiagnostics.value = studentPlacement

    const bySectionId = new Map()
    const countsBySectionId = new Map()
    const invalidCountsBySectionId = new Map()

    sectionPlacement.forEach((d) => {
        if (d.entityType !== 'section') return
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

    sectionDiagnosticsIndex.value = { bySectionId, countsBySectionId }

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

    sectionRows.value = rows
    unplacedSectionRows.value = rows.filter((s) => !s.isPlaced && !s.isInvalid)
    placedSectionRows.value = rows.filter((s) => s.isPlaced)
    invalidSectionRows.value = rows
        .filter((s) => s.isInvalid)
        .sort((a, b) => {
            const invalidDelta = (b.invalidDiagnosticCount || 0) - (a.invalidDiagnosticCount || 0)
            if (invalidDelta !== 0) return invalidDelta
            return String(a.course_name || '').localeCompare(String(b.course_name || ''))
        })

    const filtered = []
    validation.forEach((d) => {
        if (d.entityType === 'system' || DECISION_CODES.has(d.code)) filtered.push(d)
    })
    sectionPlacement.forEach((d) => {
        if (d.entityType === 'system' || DECISION_CODES.has(d.code)) filtered.push(d)
    })
    studentPlacement.forEach((d) => {
        if (d.entityType === 'system' || DECISION_CODES.has(d.code)) filtered.push(d)
    })
    systemAndDecisionDiagnostics.value = filtered

    validationIssueCount.value = validation.reduce((count, d) => count + (VALIDATION_ISSUE_SEVERITIES.has(d.severity) ? 1 : 0), 0)
    hasAnyDiagnostics.value = Boolean(diagnostics) && (validation.length > 0 || sectionPlacement.length > 0 || studentPlacement.length > 0)

    const metrics = {}
    sectionPlacement.forEach((d) => {
        const entityType = String(d.entityType || '').toLowerCase()
        const isSystemDiagnostic = entityType === 'system' || d.entityId === 0 || d.entityId === '0'
        if (!isSystemDiagnostic || !d.metrics) return
        Object.entries(d.metrics).forEach(([k, v]) => {
            metrics[normalizeMetricKey(k)] = v
        })
    })
    systemMetrics.value = metrics

    const scopeMap = new WeakMap()
    validation.forEach((d) => scopeMap.set(d, 'validation'))
    sectionPlacement.forEach((d) => scopeMap.set(d, 'sectionPlacement'))
    studentPlacement.forEach((d) => scopeMap.set(d, 'studentPlacement'))
    diagnosticScopeIndex.value = scopeMap

    idReferenceIndex.value = buildIdReferenceIndex(dataset)
}

const ensureInitialized = () => {
    if (initialized) return
    initialized = true

    watch(
        [
            () => store.localDataset,
            () => store.localDataset?.sections,
            () => store.diagnostics
        ],
        ([dataset, _sections, diagnostics]) => {
            buildReportData(dataset)
            buildDiagnosticsData(dataset, diagnostics)
        },
        { immediate: true }
    )
}

const resolveIdName = (id, preferredType = null) => {
    if (id == null) return '-'
    const key = String(id)
    if (preferredType && idReferenceIndex.value.typed?.[preferredType]?.has(key)) {
        return idReferenceIndex.value.typed[preferredType].get(key)
    }
    const options = idReferenceIndex.value.index.get(key) || []
    if (options.length === 0) return 'Unknown'
    if (options.length === 1) return options[0]
    return `${options[0]} (+${options.length - 1} more)`
}

const getDiagnosticScope = (diagnostic) => diagnosticScopeIndex.value.get(diagnostic) || '-'
const isActionableSeverity = (severity) => ACTIONABLE_SEVERITIES.has(severity)

export function useDerivedSchedulerData() {
    ensureInitialized()

    return {
        reportStats,
        courseStats,
        teacherLoad,
        roomUsage,
        sectionsWithoutRoom,
        studentStats,
        studentSeats,

        sectionPlacementDiagnostics,
        validationDiagnostics,
        studentPlacementDiagnostics,
        sectionDiagnosticsIndex,
        sectionRows,
        unplacedSectionRows,
        placedSectionRows,
        invalidSectionRows,
        systemAndDecisionDiagnostics,
        validationIssueCount,
        hasAnyDiagnostics,
        systemMetrics,

        resolveIdName,
        getDiagnosticScope,
        isActionableSeverity,
        decisionCodes: DECISION_CODES
    }
}
