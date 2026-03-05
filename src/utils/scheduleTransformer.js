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
                restrictedCoursePeriods: t.restrictedCoursePeriods || [],
                totalSections: 0,
                totalStudents: 0,
                placedSectionsCount: 0,
                unplacedSectionsCount: 0,
                roomIds: new Set(),
                classroomNames: new Set(),
                subjectCounts: new Map()
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
                    restrictedCoursePeriods: [],
                    totalSections: 0,
                    totalStudents: 0,
                    placedSectionsCount: 0,
                    unplacedSectionsCount: 0,
                    roomIds: new Set(),
                    classroomNames: new Set(),
                    subjectCounts: new Map()
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
                const teacherEntry = teacherMap[teacherId]
                const roomId = s.classroomId ?? s.classroom_id
                const classroomName = (s.room_name || s.classroom_name || '').toString().trim()
                const courseCode = (s.courseCode || s.course_code || s.course_name || 'Unknown').toString()

                teacherEntry.totalSections += 1
                teacherEntry.totalStudents += Number(s.student_count || 0)
                teacherEntry.subjectCounts.set(courseCode, (teacherEntry.subjectCounts.get(courseCode) || 0) + 1)
                if (roomId != null && roomId !== '') teacherEntry.roomIds.add(String(roomId))
                if (classroomName) teacherEntry.classroomNames.add(classroomName)

                if (!s.coursePeriodIds || s.coursePeriodIds.length === 0) {
                    teacherEntry.unplacedSections.push(sectionData)
                    teacherEntry.unplacedSectionsCount += 1
                } else if (Array.isArray(s.coursePeriodIds)) {
                    teacherEntry.placedSectionsCount += 1
                    s.coursePeriodIds.forEach(pid => {
                        if (!teacherEntry.periodRawSections[pid]) {
                            teacherEntry.periodRawSections[pid] = []
                        }
                        teacherEntry.periodRawSections[pid].push(sectionData)
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

        const placementPct = teacher.totalSections > 0
            ? Math.round((teacher.placedSectionsCount / teacher.totalSections) * 100)
            : 100
        const sortedSubjectEntries = Array.from(teacher.subjectCounts.entries())
            .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
        const subjectMix = sortedSubjectEntries
            .slice(0, 2)
            .map(([subject, count]) => ({ subject, count }))
        const subjectList = sortedSubjectEntries
            .map(([subject, count]) => `${subject}${count > 1 ? ` (${count})` : ''}`)
            .join(', ')
        const classroomList = Array.from(teacher.classroomNames.values())
            .sort((a, b) => a.localeCompare(b))
            .join(', ')

        return {
            ...teacher,
            summary: {
                sections: teacher.totalSections,
                students: teacher.totalStudents,
                placed: teacher.placedSectionsCount,
                unplaced: teacher.unplacedSectionsCount,
                placementPct,
                roomDiversity: teacher.roomIds.size,
                classroomCount: teacher.roomIds.size,
                classroomList,
                subjectMix,
                subjectCount: teacher.subjectCounts.size,
                subjectList
            },
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
