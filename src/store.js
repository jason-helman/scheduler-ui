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
    diagnostics: null,
    
    // Navigation state
    currentView: 'MasterSchedule',
    activeReportTab: '0',
    selectedSectionId: null
})
