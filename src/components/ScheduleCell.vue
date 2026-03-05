<script setup>
import { ref, computed, watch } from 'vue'
import Button from 'primevue/button'
import SectionCard from './SectionCard.vue'
import { isRelatedSection } from '../utils/scheduleHelpers'

const props = defineProps({
    teacher: Object,
    periodId: [Number, String],
    hoveredSection: Object
})

const emit = defineEmits(['hover', 'leave', 'toggle-lock'])

const userSelectedLayerIndex = ref(0)
const currentLayerIndex = ref(0)

const layers = computed(() => {
    return props.teacher.periodLayers?.['period_' + props.periodId] || []
})

const nextLayer = (total) => {
    userSelectedLayerIndex.value = (userSelectedLayerIndex.value + 1) % total
    currentLayerIndex.value = userSelectedLayerIndex.value
}

const prevLayer = (total) => {
    userSelectedLayerIndex.value = (userSelectedLayerIndex.value - 1 + total) % total
    currentLayerIndex.value = userSelectedLayerIndex.value
}

// Watch for hover changes to temporarily switch layers
watch(() => props.hoveredSection, (newTarget) => {
    if (!newTarget) {
        currentLayerIndex.value = userSelectedLayerIndex.value
        return
    }

    // Check if any layer contains a related section
    for (let i = 0; i < layers.value.length; i++) {
        const layer = layers.value[i]
        const hasRelated = layer.some(section => isRelatedSection(section, newTarget))
        
        if (hasRelated) {
            currentLayerIndex.value = i
            return
        }
    }
    
    // If no related section found in any layer, stay on user's selected layer
    currentLayerIndex.value = userSelectedLayerIndex.value
})
</script>

<template>
    <div class="grid grid-rows-4 gap-1.5 min-h-[350px] relative p-3 items-stretch group/cell">
        <!-- Quarter Separator Lines -->
        <div v-for="q in 4" :key="'qline-' + q" class="absolute left-0 right-0 border-b border-gray-50 dark:border-gray-800/50 pointer-events-none" :style="{ top: ((q-1) * 25) + '%', height: '25%' }"></div>

        <template v-if="layers.length > 0">
            <!-- Layer Navigation Indicators -->
            <div v-if="layers.length > 1" 
                 class="absolute top-1 left-1/2 -translate-x-1/2 flex gap-1.5 z-[60]">
                <div v-for="(_, dotIdx) in layers" :key="'dot-' + dotIdx"
                     :class="['w-1.5 h-1.5 rounded-full border border-white/20', dotIdx === currentLayerIndex ? 'bg-blue-500 shadow-sm' : 'bg-gray-200 dark:bg-gray-700']"></div>
            </div>

            <!-- Navigation Controls -->
            <div v-if="layers.length > 1" 
                 class="absolute inset-x-1 top-1/2 -translate-y-1/2 flex items-center justify-between z-[70] pointer-events-none opacity-0 group-hover/cell:opacity-100 transition-opacity">
                <Button icon="pi pi-chevron-left" rounded severity="secondary" size="small" 
                        class="!w-7 !h-7 !p-0 shadow-lg border border-gray-200 dark:border-gray-700 pointer-events-auto !bg-white/90 dark:!bg-gray-800/90"
                        @click.stop="prevLayer(layers.length)" />
                <Button icon="pi pi-chevron-right" rounded severity="secondary" size="small" 
                        class="!w-7 !h-7 !p-0 shadow-lg border border-gray-200 dark:border-gray-700 pointer-events-auto !bg-white/90 dark:!bg-gray-800/90"
                        @click.stop="nextLayer(layers.length)" />
            </div>

            <!-- Layer Rendering -->
            <template v-for="(layerSections, lIdx) in layers" :key="'layer-' + lIdx">
                <template v-if="lIdx === currentLayerIndex">
                    <template v-for="section in layerSections" :key="section.sectionId">
                        <!-- Restriction Card -->
                        <div v-if="section.isRestriction"
                             :style="{ gridRow: '1 / 5' }"
                             class="p-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-center opacity-60 z-10 w-full is-restriction">
                            <div class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex flex-col items-center gap-1 text-center">
                                <i class="pi pi-ban text-xs"></i>
                                <span>Restricted</span>
                            </div>
                        </div>

                        <!-- Regular Section Card -->
                        <SectionCard 
                            v-else
                            :section="section"
                            :hovered-section="hoveredSection"
                            @hover="s => emit('hover', s)"
                            @leave="() => emit('leave')"
                            @toggle-lock="id => emit('toggle-lock', id)"
                        />
                    </template>
                </template>
            </template>
        </template>
    </div>
</template>

<style scoped>
.is-restriction {
    background-image: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(0, 0, 0, 0.03) 10px,
        rgba(0, 0, 0, 0.03) 20px
    );
}

.my-app-dark .is-restriction {
    background-image: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(255, 255, 255, 0.03) 10px,
        rgba(255, 255, 255, 0.03) 20px
    );
}
</style>
