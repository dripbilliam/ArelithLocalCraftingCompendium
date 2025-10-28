class CraftingCompendiumApp {
    constructor() {
        this.initialized = false;
        this.init();
    }

    async init() {
        if (this.initialized) return;

        try {
            // Show loading indicator
            window.uiManager.showLoading(true);

            // Initialize data by loading skills
            await this.loadInitialData();

            // Setup additional event listeners
            this.setupEventListeners();

            // Hide loading indicator
            window.uiManager.showLoading(false);

            this.initialized = true;
            console.log('Crafting Compendium initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            window.uiManager.showLoading(false);
            window.uiManager.showError('Failed to initialize application. Please check your connection.');
        }
    }

    async loadInitialData() {
        try {
            // Pre-load skills data to update counts
            const skills = await window.apiService.getAllSkills();
            this.updateSkillCounts(skills);
            
            // Pre-load other data in background for caching
            Promise.all([
                window.apiService.getAllRecipes(),
                window.apiService.getAllInputs(),
                // Pre-load categories for common skills
                ...skills.slice(0, 3).map(skill => 
                    window.apiService.getSkillCategories(skill.id)
                )
            ]).then(() => {
                console.log('Initial data cached successfully');
                console.log('Cache stats:', window.apiService.getCacheStats());
            }).catch(err => {
                console.warn('Background data loading failed:', err);
            });
            
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    updateSkillCounts(skills) {
        // Update skill card counts with real data
        skills.forEach(skill => {
            const skillCard = document.querySelector(`[data-skill="${skill.id}"]`);
            if (skillCard) {
                const countSpan = skillCard.querySelector('.count');
                if (countSpan) {
                    countSpan.textContent = `(${skill.count})`;
                }
            }
        });
    }

    setupEventListeners() {
        // Handle window events
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Handle back/forward browser buttons
        window.addEventListener('popstate', (e) => {
            if (e.state) {
                this.restoreState(e.state);
            }
        });

        // Auto-refresh data periodically (every 30 minutes)
        setInterval(() => {
            this.refreshData();
        }, 30 * 60 * 1000);
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + F: Focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }

        // Escape: Clear search or go back
        if (e.key === 'Escape') {
            const searchInput = document.getElementById('searchInput');
            if (searchInput.value) {
                searchInput.value = '';
                window.uiManager.showView('home');
                window.uiManager.updateBreadcrumbs(['Compendium']);
            } else if (window.uiManager.currentView !== 'home') {
                this.goBack();
            }
        }

        // Alt + Left: Go back
        if (e.altKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            this.goBack();
        }

        // Ctrl + Shift + D: Show debug cache info
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            console.log('Cache Statistics:', window.apiService.getCacheStats());
            const stats = window.apiService.getCacheStats();
            alert('Cache Stats:\n' + Object.entries(stats).map(([key, value]) => `${key}: ${value}`).join('\n'));
        }
    }

    goBack() {
        const breadcrumbs = window.uiManager.breadcrumbs;
        if (breadcrumbs.length > 1) {
            // Remove last breadcrumb and navigate to previous
            const newBreadcrumbs = breadcrumbs.slice(0, -1);
            window.uiManager.updateBreadcrumbs(newBreadcrumbs);
            
            if (newBreadcrumbs.length === 1) {
                window.uiManager.showView('home');
            }
            // Add more back navigation logic as needed
        }
    }

    async refreshData() {
        try {
            console.log('Refreshing data...');
            window.apiService.clearCache();
            await this.loadInitialData();
            console.log('Data refreshed successfully');
        } catch (error) {
            console.error('Data refresh failed:', error);
        }
    }

    saveState() {
        const state = {
            view: window.uiManager.currentView,
            breadcrumbs: window.uiManager.breadcrumbs,
            searchQuery: document.getElementById('searchInput').value
        };
        
        history.pushState(state, '', window.location.href);
    }

    restoreState(state) {
        if (state.view) {
            window.uiManager.showView(state.view);
        }
        if (state.breadcrumbs) {
            window.uiManager.updateBreadcrumbs(state.breadcrumbs);
        }
        if (state.searchQuery) {
            document.getElementById('searchInput').value = state.searchQuery;
        }
    }

    cleanup() {
        // Cleanup resources before app closes
        console.log('Cleaning up application resources...');
    }

    // Public API methods for external integration
    async searchFor(query) {
        document.getElementById('searchInput').value = query;
        await window.uiManager.performSearch(query);
    }

    async showRecipe(recipeId) {
        await window.uiManager.showRecipeDetail(recipeId);
    }

    async showSkill(skillId) {
        await window.uiManager.showSkillRecipes(skillId);
    }
}

// Enhanced breadcrumb navigation system
class BreadcrumbManager {
    constructor() {
        this.history = [];
        this.maxHistory = 10;
    }

    addToHistory(breadcrumbs, view, data = {}) {
        const historyItem = {
            breadcrumbs: [...breadcrumbs],
            view,
            data,
            timestamp: Date.now()
        };

        this.history.push(historyItem);
        
        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    canGoBack() {
        return this.history.length > 1;
    }

    goBack() {
        if (this.canGoBack()) {
            this.history.pop(); // Remove current
            const previous = this.history[this.history.length - 1];
            return previous;
        }
        return null;
    }

    getCurrentState() {
        return this.history[this.history.length - 1] || null;
    }

    clear() {
        this.history = [];
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add breadcrumb manager to UI manager
    window.uiManager.breadcrumbManager = new BreadcrumbManager();
    
    // Override updateBreadcrumbs to use history
    const originalUpdateBreadcrumbs = window.uiManager.updateBreadcrumbs;
    window.uiManager.updateBreadcrumbs = function(crumbs, view, data) {
        originalUpdateBreadcrumbs.call(this, crumbs);
        this.breadcrumbManager.addToHistory(crumbs, view || this.currentView, data);
    };

    // Enhanced breadcrumb click handler
    const originalHandleBreadcrumbClick = window.uiManager.handleBreadcrumbClick;
    window.uiManager.handleBreadcrumbClick = function(e) {
        const index = parseInt(e.target.dataset.index);
        
        if (index === 0) {
            // Back to home
            this.showView('home');
            this.updateBreadcrumbs(['Compendium'], 'home');
            document.getElementById('searchInput').value = '';
        } else {
            // Navigate to specific breadcrumb level
            const targetCrumbs = this.breadcrumbs.slice(0, index + 1);
            this.updateBreadcrumbs(targetCrumbs);
            
            // Add logic to restore appropriate view based on breadcrumb path
            this.restoreBreadcrumbView(targetCrumbs);
        }
    };

    // Add method to restore view based on breadcrumbs
    window.uiManager.restoreBreadcrumbView = function(crumbs) {
        if (crumbs.length === 1) {
            this.showView('home');
        } else if (crumbs.length === 2) {
            const secondCrumb = crumbs[1];
            if (secondCrumb === 'All Recipes') {
                this.showAllRecipes();
            } else if (secondCrumb === 'All Ingredients') {
                this.showAllIngredients();
            } else if (secondCrumb.startsWith('Search:')) {
                const query = secondCrumb.match(/Search: "(.+)"/)?.[1];
                if (query) {
                    this.performSearch(query);
                }
            } else {
                // Assume it's a skill name
                const skillId = this.getSkillIdByName(secondCrumb);
                if (skillId) {
                    this.showSkillRecipes(skillId);
                }
            }
        } else if (crumbs.length === 3) {
            // Could be Skill -> Category or Skill -> Recipe
            const skillName = crumbs[1];
            const thirdCrumb = crumbs[2];
            const skillId = this.getSkillIdByName(skillName);
            
            if (skillId) {
                // Try to find if this is a category
                window.apiService.getSkillCategories(skillId).then(categories => {
                    const category = categories.find(cat => cat.name === thirdCrumb);
                    if (category) {
                        this.showCategoryRecipes(skillId, category.id);
                    } else {
                        // Might be a recipe name, just show skill recipes for now
                        this.showSkillRecipes(skillId);
                    }
                });
            }
        }
    };

    // Helper method to get skill ID by name
    window.uiManager.getSkillIdByName = function(skillName) {
        const skillMap = {
            'Carpentry': 1,
            'Herbalism': 2,
            'Art Crafting': 3,
            'Smithing': 4,
            'Alchemy': 5,
            'Tailoring': 6
        };
        return skillMap[skillName] || null;
    };

    // Initialize the main application
    window.app = new CraftingCompendiumApp();
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CraftingCompendiumApp, BreadcrumbManager };
}