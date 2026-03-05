<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { MasterSchedule } from './components/master-schedule'
import Reports from './components/Reports.vue'
import Diagnostics from './components/Diagnostics.vue'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { store } from './store'

const isDarkMode = ref(false)
const isCollapsed = ref(false)

const updateTheme = (e) => {
    isDarkMode.value = e.matches
    if (isDarkMode.value) {
        document.documentElement.classList.add('my-app-dark')
    } else {
        document.documentElement.classList.remove('my-app-dark')
    }
}

const toggleDarkMode = () => {
    isDarkMode.value = !isDarkMode.value
    document.documentElement.classList.toggle('my-app-dark')
}

const toggleSidebar = () => {
    isCollapsed.value = !isCollapsed.value
}

let mediaQuery

onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    updateTheme(mediaQuery)
    mediaQuery.addEventListener('change', updateTheme)
})

onUnmounted(() => {
    if (mediaQuery) {
        mediaQuery.removeEventListener('change', updateTheme)
    }
})

const navItems = [
    {
        label: 'Master Schedule',
        icon: 'pi pi-calendar',
        view: 'MasterSchedule'
    },
    {
        label: 'Reports',
        icon: 'pi pi-chart-bar',
        view: 'Reports'
    },
    {
        label: 'Diagnostics',
        icon: 'pi pi-search-plus',
        view: 'Diagnostics'
    }
]
</script>

<template>
  <div :class="['flex h-screen transition-colors duration-300', isDarkMode ? 'bg-gray-950 text-gray-100 my-app-dark' : 'bg-gray-50 text-gray-900']">
    <!-- Sidebar: Always Dark -->
    <aside :class="[isCollapsed ? 'w-20' : 'w-64', 'h-full bg-slate-900 flex flex-col shadow-2xl z-20 transition-all duration-300 relative']">
      <!-- Collapse Toggle Button -->
      <button 
        @click="toggleSidebar"
        class="absolute -right-4 top-20 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center border-4 border-slate-900 cursor-pointer z-30 hover:bg-blue-500 transition-all shadow-xl hover:scale-110 active:scale-95"
      >
        <i :class="['pi text-[10px] font-bold', isCollapsed ? 'pi-chevron-right' : 'pi-chevron-left']"></i>
      </button>

      <div :class="['flex items-center gap-3 border-b border-slate-800 bg-slate-900 transition-all duration-300 overflow-hidden shrink-0', isCollapsed ? 'justify-center p-4 h-[81px]' : 'p-6 h-[81px]']">
        <span class="pi pi-calendar-plus text-2xl text-blue-400 shrink-0"></span>
        <span v-if="!isCollapsed" class="text-xl font-bold tracking-tight text-white whitespace-nowrap">Scheduler UI</span>
      </div>
      
      <nav class="flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-2">
        <div v-for="item in navItems" :key="item.view" class="px-3">
            <a 
                @click="store.currentView = item.view"
                :class="[
                    'flex items-center transition-all duration-200 no-underline cursor-pointer group rounded-xl overflow-hidden',
                    isCollapsed ? 'justify-center w-14 h-14' : 'px-4 py-3.5 w-full',
                    store.currentView === item.view 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                ]"
                v-tooltip.right="isCollapsed ? { value: item.label, pt: { text: 'text-xs font-bold' } } : null"
            >
                <span :class="[item.icon, isCollapsed ? 'text-xl' : 'text-lg mr-3', 'shrink-0 transition-transform group-hover:scale-110']"></span>
                <span v-if="!isCollapsed" class="text-sm font-bold tracking-wide whitespace-nowrap">{{ item.label }}</span>
            </a>
        </div>
      </nav>

      <div class="p-4 border-t border-slate-800 bg-slate-900 space-y-4 shrink-0">
        <div :class="['flex items-center transition-all duration-300', isCollapsed ? 'justify-center' : 'justify-between px-3']">
            <span v-if="!isCollapsed" class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Show IDs</span>
            <ToggleSwitch v-model="store.showIds" v-tooltip.right="isCollapsed ? { value: 'Show IDs', pt: { text: 'text-xs font-bold' } } : null" />
        </div>
        <div :class="['flex items-center transition-all duration-300', isCollapsed ? 'justify-center' : 'justify-between px-3']">
            <span v-if="!isCollapsed" class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compressed</span>
            <ToggleSwitch v-model="store.isCompressed" v-tooltip.right="isCollapsed ? { value: 'Compressed View', pt: { text: 'text-xs font-bold' } } : null" />
        </div>
        <Button 
            :icon="isDarkMode ? 'pi pi-sun' : 'pi pi-moon'" 
            :label="isCollapsed ? '' : (isDarkMode ? 'Light Mode' : 'Dark Mode')" 
            class="w-full !text-white hover:!bg-slate-800 !border-none !shadow-none font-bold h-12" 
            variant="text"
            @click="toggleDarkMode" 
            v-tooltip.right="isCollapsed ? { value: (isDarkMode ? 'Light Mode' : 'Dark Mode'), pt: { text: 'text-xs font-bold' } } : null"
        />
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto p-10">
      <div v-if="store.currentView === 'MasterSchedule'" class="animate-in fade-in duration-500 h-full">
        <MasterSchedule />
      </div>
      <div v-else-if="store.currentView === 'Reports'" class="animate-in fade-in duration-500 h-full">
        <Reports />
      </div>
      <div v-else-if="store.currentView === 'Diagnostics'" class="animate-in fade-in duration-500 h-full">
        <Diagnostics />
      </div>
    </main>
  </div>
</template>

<style>
/* Base styles */
body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    overflow: hidden;
}

.my-app-dark {
    color-scheme: dark;
}

/* Custom scrollbar for sidebar */
aside ::-webkit-scrollbar {
    width: 4px;
}
aside ::-webkit-scrollbar-track {
    background: transparent;
}
aside ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
}
aside ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
}
</style>
