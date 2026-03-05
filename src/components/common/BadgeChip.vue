<script setup>
import { computed } from 'vue'

const props = defineProps({
    label: {
        type: String,
        default: ''
    },
    tone: {
        type: String,
        default: 'slate'
    },
    size: {
        type: String,
        default: 'xs'
    },
    shape: {
        type: String,
        default: 'pill'
    },
    asButton: {
        type: Boolean,
        default: false
    },
    interactive: {
        type: Boolean,
        default: false
    },
    tooltip: {
        type: String,
        default: ''
    },
    truncate: {
        type: Boolean,
        default: false
    },
    maxWidthClass: {
        type: String,
        default: ''
    }
})

const emit = defineEmits(['click'])

const toneClass = computed(() => {
    if (props.tone === 'teal') return 'bg-teal-100/80 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300'
    if (props.tone === 'emerald') return 'bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300'
    if (props.tone === 'orange') return 'bg-orange-100/80 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300'
    if (props.tone === 'violet') return 'bg-violet-100/70 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300'
    if (props.tone === 'sky') return 'bg-sky-100/70 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300'
    if (props.tone === 'indigo') return 'bg-indigo-100/85 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 ring-indigo-300/80 dark:ring-indigo-500/70'
    if (props.tone === 'amber') return 'bg-amber-100/70 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300'
    if (props.tone === 'blue') return 'bg-blue-100/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
    return 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300'
})

const chipClass = computed(() => {
    const classes = [
        'inline-flex items-center justify-center font-black select-none',
        'ring-1 ring-inset ring-black/10 dark:ring-white/12 shadow-[0_1px_2px_rgba(15,23,42,0.10)] dark:shadow-[0_1px_2px_rgba(2,6,23,0.35)]',
        props.shape === 'pill' ? 'rounded-full' : 'rounded',
        props.size === 'sm' ? 'text-[8px] px-1 py-0.5' : 'text-[7px] px-1.5 py-0.5',
        props.size === 'sm' ? 'tracking-wide' : 'tracking-wider'
    ]

    classes.push(toneClass.value)
    if (props.truncate) {
        classes.push('min-w-0 max-w-full overflow-hidden justify-start')
    }
    if (props.maxWidthClass) classes.push(props.maxWidthClass)

    if (props.interactive || props.asButton) {
        classes.push('cursor-pointer hover:underline transition-colors')
    } else if (props.tooltip) {
        classes.push('cursor-help')
    } else {
        classes.push('cursor-default')
    }

    return classes
})

const tagName = computed(() => (props.asButton ? 'button' : 'span'))
</script>

<template>
    <component
        :is="tagName"
        :type="asButton ? 'button' : undefined"
        :class="chipClass"
        v-tooltip.top="tooltip || null"
        @click="emit('click')"
    >
        <span :class="props.truncate ? 'block min-w-0 max-w-full truncate whitespace-nowrap' : ''">
            <slot>{{ label }}</slot>
        </span>
    </component>
</template>
