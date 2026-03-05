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
