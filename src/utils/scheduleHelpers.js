export function isRelatedSection(section, target) {
    if (!target) return false

    // Same identity (multi-course segment) or same span
    const isPrimaryRelated = section.sectionId === target.sectionId || (target.spanId && section.spanId === target.spanId)
    if (isPrimaryRelated) return true

    // Subsection: Parent, child, or sibling relationship
    const isSubsectionRel =
        section.parentSectionId === target.sectionId ||
        target.parentSectionId === section.sectionId ||
        (target.parentSectionId && section.parentSectionId === target.parentSectionId)

    return !!isSubsectionRel
}

const datasetIndexCache = new WeakMap()

function getCachedIndexes(localDataset) {
    if (!localDataset || typeof localDataset !== 'object') {
        return {
            studentById: new Map(),
            courseById: new Map(),
            teacherNameById: new Map(),
            sectionById: new Map()
        }
    }

    const cached = datasetIndexCache.get(localDataset)
    if (
        cached &&
        cached.studentsRef === localDataset.students &&
        cached.coursesRef === localDataset.courses &&
        cached.teachersRef === localDataset.teachers &&
        cached.sectionsRef === localDataset.sections
    ) {
        return cached
    }

    const studentById = new Map()
    if (Array.isArray(localDataset.students)) {
        localDataset.students.forEach(s => {
            const id = s.studentId || s.student_id || s.id
            if (id != null) studentById.set(String(id), s)
        })
    }

    const courseById = new Map()
    if (Array.isArray(localDataset.courses)) {
        localDataset.courses.forEach(c => {
            if (c?.courseId != null) courseById.set(c.courseId, c)
        })
    }

    const teacherNameById = new Map()
    if (Array.isArray(localDataset.teachers)) {
        localDataset.teachers.forEach(t => {
            const id = t?.teacherId ?? t?.teacher_id ?? t?.id
            if (id == null) return
            const name = t?.name || t?.teacher_name || `Teacher ${id}`
            teacherNameById.set(String(id), name)
        })
    }

    const sectionById = new Map()
    if (Array.isArray(localDataset.sections)) {
        localDataset.sections.forEach(s => {
            const id = s?.sectionId ?? s?.section_id ?? s?.id
            if (id != null) sectionById.set(String(id), s)
        })
    }

    const indexes = {
        studentsRef: localDataset.students,
        coursesRef: localDataset.courses,
        teachersRef: localDataset.teachers,
        sectionsRef: localDataset.sections,
        studentById,
        courseById,
        teacherNameById,
        sectionById
    }

    datasetIndexCache.set(localDataset, indexes)
    return indexes
}

export function getStudentByIdMap(localDataset) {
    return getCachedIndexes(localDataset).studentById
}

export function getCourseByIdMap(localDataset) {
    return getCachedIndexes(localDataset).courseById
}

export function getTeacherNameByIdMap(localDataset) {
    return getCachedIndexes(localDataset).teacherNameById
}

export function getSectionByIdMap(localDataset) {
    return getCachedIndexes(localDataset).sectionById
}

export function getHighlightClass(section, target) {
    if (!target) return ''

    const isPrimaryRelated = section.sectionId === target.sectionId || (target.spanId && section.spanId === target.spanId)

    if (isPrimaryRelated) {
        if (section.parentSectionId) return 'highlight-subsection'
        return section.isLab ? 'highlight-lab' : 'highlight-primary'
    }

    // Subsection: Parent, child, or sibling relationship
    const isSubsectionRel =
        section.parentSectionId === target.sectionId ||
        target.parentSectionId === section.sectionId ||
        (target.parentSectionId && section.parentSectionId === target.parentSectionId)

    if (isSubsectionRel) {
        return section.parentSectionId ? 'highlight-subsection' : 'highlight-primary'
    }

    return ''
}
