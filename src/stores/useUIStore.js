import { defineStore } from 'pinia';

export const useUIStore = defineStore('ui', {
    state: () => ({
        windowWidth: window.innerWidth,
        mobileMenuOpen: true,
        activeMobileTab: 'tools',
        viewMode: '2d',
        viewMode3D: 'full-edit',
        activeRightTab: 'properties',
        showLeftSidebar: true,
        uiTrigger: 0,
        isPlacing3D: false,
        activeDecorId: null,
        isRebuilding: false,
        isXRayMode: false,
        showGuide: false,
        showAdvancedTools: false,
        layerRefreshTrigger: 0
    }),
    getters: {
        isMobile: (state) => state.windowWidth < 768,
        isTablet: (state) => state.windowWidth >= 768 && state.windowWidth < 1200,
        isDesktop: (state) => state.windowWidth >= 1200
    },
    actions: {
        handleResize() {
            this.windowWidth = window.innerWidth;
            if (!this.isMobile && !this.isTablet) this.mobileMenuOpen = false;
        },
        toggleMobileTab(tabId) {
            if (this.activeMobileTab === tabId && this.mobileMenuOpen) {
                this.mobileMenuOpen = false;
            } else {
                this.activeMobileTab = tabId;
                this.mobileMenuOpen = true;
            }
        },
        triggerUIRefresh() {
            this.uiTrigger++;
        },
        triggerLayerRefresh() {
            this.layerRefreshTrigger++;
        }
    }
});
