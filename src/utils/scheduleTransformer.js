export function transformScheduleData(localDataset) {
    if (!localDataset) return []

    const teacherMap = {}
    const teacherNameById = new Map()

    // Initialize teacher map from teachers list if available to include those without sections and capture restrictions
    if (localDataset.teachers) {
        localDataset.teachers.forEach(t => {
            teacherNameById.set(t.teacherId, t.name)
            teacherMap[t.teacherId] = {
                teacherName: t.name,
                teacherId: t.teacherId,
                unplacedSections: [],
                periodRawSections: {},
                restrictedCoursePeriods: t.restrictedCoursePeriods || []
            }
        })
    }

    if (localDataset.sections) {
        localDataset.sections.forEach(s => {
            const assignedTeacherIds = Array.from(
                new Set(
                    [
                        ...(Array.isArray(s.teacherIds) ? s.teacherIds : []),
                        ...(Array.isArray(s.teacher_ids) ? s.teacher_ids : []),
                        s.teacherId,
                        s.teacher_id
                    ].filter(id => id != null)
                )
            )

            if (assignedTeacherIds.length === 0) return

            assignedTeacherIds.forEach(teacherId => {
                if (teacherMap[teacherId]) return
                teacherMap[teacherId] = {
                    teacherName: teacherNameById.get(teacherId) || s.teacher_name || `Teacher ${teacherId}`,
                    teacherId,
                    unplacedSections: [],
                    periodRawSections: {},
                    restrictedCoursePeriods: []
                }
            })

            const qArray = s.quarters ? s.quarters.split(',').map(n => parseInt(n)) : []
            const sectionData = {
                ...s,
                startQ: qArray.length ? Math.min(...qArray) : 1,
                endQ: qArray.length ? Math.max(...qArray) : 4,
                quarterCount: qArray.length
            }

            assignedTeacherIds.forEach(teacherId => {
                if (!s.coursePeriodIds || s.coursePeriodIds.length === 0) {
                    teacherMap[teacherId].unplacedSections.push(sectionData)
                } else if (Array.isArray(s.coursePeriodIds)) {
                    s.coursePeriodIds.forEach(pid => {
                        if (!teacherMap[teacherId].periodRawSections[pid]) {
                            teacherMap[teacherId].periodRawSections[pid] = []
                        }
                        teacherMap[teacherId].periodRawSections[pid].push(sectionData)
                    })
                }
            })
        })
    }

    const result = Object.values(teacherMap).map(teacher => {
        const periodLayers = {}

        // Add restrictions to raw sections for layer processing
        teacher.restrictedCoursePeriods.forEach(pid => {
            if (!teacher.periodRawSections[pid]) {
                teacher.periodRawSections[pid] = []
            }
            teacher.periodRawSections[pid].push({
                sectionId: `restriction-${teacher.teacherId}-${pid}`,
                isRestriction: true,
                startQ: 1,
                endQ: 4,
                quarterCount: 4,
                course_name: 'RESTRICTED'
            })
        })

        Object.entries(teacher.periodRawSections).forEach(([pid, sections]) => {
            const sorted = [...sections].sort((a, b) => {
                // Restrictions always go last in the processing order to ensure they end up in the final layer
                if (a.isRestriction !== b.isRestriction) {
                    return a.isRestriction ? 1 : -1
                }
                return (b.quarterCount - a.quarterCount) || (a.startQ - b.startQ)
            })
            const layers = []
            sorted.forEach(s => {
                let placed = false
                for (let layer of layers) {
                    const hasOverlap = layer.some(ls => !(s.endQ < ls.startQ || ls.endQ < s.startQ))
                    if (!hasOverlap) {
                        layer.push(s)
                        placed = true
                        break
                    }
                }
                if (!placed) layers.push([s])
            })
            periodLayers[`period_${pid}`] = layers.map(l => l.sort((a, b) => a.startQ - b.startQ))
        })
        return {
            ...teacher,
            periodLayers
        }
    })

    return result.sort((a, b) => a.teacherName.localeCompare(b.teacherName))
}

export function transformPeriods(scheduleStructure) {
    if (!scheduleStructure) return []

    const periodMap = new Map()
    scheduleStructure.forEach(ss => {
        if (!periodMap.has(ss.coursePeriodId)) {
            periodMap.set(ss.coursePeriodId, {
                coursePeriodId: ss.coursePeriodId,
                name: ss.name || `P${ss.coursePeriodId}`,
                startTime: ss.startTime,
                endTime: ss.endTime
            })
        }
    })
    return Array.from(periodMap.values()).sort((a, b) => a.coursePeriodId - b.coursePeriodId)
}
