import { reactive } from 'vue'

export const store = reactive({
    schools: [],
    versions: [],
    localDataset: null,
    selectedSchool: null,
    selectedVersion: null,
    loading: false,
    error: null,
    showIds: false,
    isCompressed: false,
    selectionEpoch: 0,
    localDatasetRevision: 0,
    
    // Navigation state
    currentView: 'MasterSchedule',
    activeReportTab: '0',
    selectedSectionId: null,
    diagnosticsTargetSectionTab: null,
    diagnosticsExternalScrollKey: 0,

    // Actions
    toggleLock(sectionId) {
        if (!this.localDataset || !this.localDataset.sections) return
        const section = this.localDataset.sections.find(s => s.sectionId === sectionId)
        if (section) {
            section.locked = section.locked ? 0 : 1
        }
    }
})
