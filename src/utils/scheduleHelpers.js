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
        return { studentById: new Map(), courseById: new Map() }
    }

    const cached = datasetIndexCache.get(localDataset)
    if (
        cached &&
        cached.studentsRef === localDataset.students &&
        cached.coursesRef === localDataset.courses
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

    const indexes = {
        studentsRef: localDataset.students,
        coursesRef: localDataset.courses,
        studentById,
        courseById
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

export function getHighlightClass(section, target) {
    if (!target) return ''
    
    const isPrimaryRelated = section.sectionId === target.sectionId || (target.spanId && section.spanId === target.spanId)

    if (isPrimaryRelated) {
        return section.isLab ? 'highlight-lab' : 'highlight-primary'
    }
    
    // Subsection: Parent, child, or sibling relationship
    const isSubsectionRel = 
        section.parentSectionId === target.sectionId || 
        target.parentSectionId === section.sectionId ||
        (target.parentSectionId && section.parentSectionId === target.parentSectionId)
        
    if (isSubsectionRel) {
        return 'highlight-subsection'
    }
    
    return ''
}
