export const api = {
    async fetchSchools() {
        const res = await fetch('/api/schools')
        if (!res.ok) throw new Error('Failed to fetch schools')
        return res.json()
    },

    async fetchVersions(schoolId) {
        const res = await fetch(`/api/versions?schoolId=${schoolId}`)
        if (!res.ok) throw new Error('Failed to fetch versions')
        return res.json()
    },

    async fetchFullDataset(schoolId, scheduleVersionId) {
        const res = await fetch(`/api/full-dataset?schoolId=${schoolId}&svId=${scheduleVersionId}`)
        if (!res.ok) throw new Error('Failed to fetch dataset')
        return res.json()
    },

    async runSectionPlacement(dataset, engineOptions = {}) {
        const res = await fetch('/api/place-sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataset, engineOptions })
        })
        const result = await res.json()
        if (result.error) throw new Error(result.error)
        return result
    }
}
