<script setup>
import { ref } from 'vue'

const props = defineProps({
    value: {
        type: [String, Number],
        required: true
    },
    label: {
        type: String,
        default: 'ID'
    }
})

const copied = ref(false)

const copy = async () => {
    try {
        await navigator.clipboard.writeText(props.value.toString())
        copied.value = true
        setTimeout(() => {
            copied.value = false
        }, 2000)
    } catch (err) {
        console.error('Failed to copy: ', err)
    }
}
</script>

<template>
    <button 
        @click.stop="copy" 
        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all cursor-pointer group/copy active:scale-95"
        v-tooltip.top="copied ? 'Copied!' : `Copy ${label}`"
    >
        <i :class="['pi text-[8px]', copied ? 'pi-check text-emerald-400' : 'pi-copy']"></i>
        <span class="text-[9px] font-mono font-bold">{{ value }}</span>
    </button>
</template>
