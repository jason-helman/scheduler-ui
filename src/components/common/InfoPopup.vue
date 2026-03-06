<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CopyButton from './CopyButton.vue'

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    title: {
        type: String,
        default: 'Details'
    },
    subtitle: {
        type: String,
        default: ''
    },
    rows: {
        type: Array,
        default: () => []
    },
    top: {
        type: Number,
        default: 0
    },
    left: {
        type: Number,
        default: 0
    },
    width: {
        type: Number,
        default: 320
    },
    zIndex: {
        type: Number,
        default: 330
    }
})

const emit = defineEmits(['close'])
const popupEl = ref(null)

const onGlobalPointerDown = (event) => {
    if (!props.visible) return
    if (popupEl.value?.contains(event.target)) return
    emit('close')
}

const onGlobalKeydown = (event) => {
    if (!props.visible) return
    if (event.key === 'Escape') emit('close')
}

onMounted(() => {
    window.addEventListener('pointerdown', onGlobalPointerDown)
    window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onGlobalPointerDown)
    window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
    <Teleport to="body">
        <div
            v-if="visible"
            class="fixed inset-0 pointer-events-none"
            :style="{ zIndex }"
        >
            <div
                ref="popupEl"
                class="absolute pointer-events-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-2xl"
                :style="{
                    top: `${top}px`,
                    left: `${left}px`,
                    width: `${width}px`
                }"
                @click.stop
            >
                <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h3 class="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100 truncate">
                            {{ title }}
                        </h3>
                        <p
                            v-if="subtitle"
                            class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
                        >
                            {{ subtitle }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-500 transition-colors text-[11px] font-black"
                        @click="emit('close')"
                    >
                        <i class="pi pi-times"></i>
                    </button>
                </div>
                <div class="px-4 py-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[11px]">
                    <template
                        v-for="row in rows"
                        :key="row.label"
                    >
                        <div class="font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {{ row.label }}
                        </div>
                        <div class="font-semibold text-slate-800 dark:text-slate-200 break-words">
                            {{ row.value }}
                            <CopyButton
                                v-if="row.copyValue != null"
                                :value="row.copyValue"
                                :label="row.copyLabel || row.label"
                                class="ml-2 align-middle"
                            />
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </Teleport>
</template>
