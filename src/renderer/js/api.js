const { ipcRenderer } = require('electron');

class APIService {
    constructor() {
        this.cache = {
            skills: null,
            recipes: null,
            inputs: null,
            categories: new Map(), // skillId -> categories data
            detailedRecipes: new Map(), // recipeId -> detailed recipe data
            skillCategories: new Map() // skillId -> category mapping
        };
        this.cacheTimestamps = {
            skills: null,
            recipes: null,
            inputs: null,
            categories: new Map(),
            detailedRecipes: new Map()
        };
        this.cacheTTL = {
            skills: 30 * 60 * 1000, // 30 minutes
            recipes: 30 * 60 * 1000, // 30 minutes
            inputs: 60 * 60 * 1000, // 1 hour
            categories: 60 * 60 * 1000, // 1 hour
            detailedRecipes: 2 * 60 * 60 * 1000 // 2 hours
        };
        this.endpoints = {
            skills: 'https://astrolabe.nwnarelith.com/api/crafting/skills',
            recipes: 'https://astrolabe.nwnarelith.com/api/crafting/recipes',
            inputs: 'https://astrolabe.nwnarelith.com/api/crafting/inputs'
        };
    }

    isDataExpired(type, key = null) {
        if (key) {
            // For Map-based caches (categories, detailedRecipes)
            const timestamp = this.cacheTimestamps[type].get(key);
            if (!timestamp) return true;
            return Date.now() - timestamp > this.cacheTTL[type];
        } else {
            // For simple caches (skills, recipes, inputs)
            if (!this.cacheTimestamps[type]) return true;
            return Date.now() - this.cacheTimestamps[type] > this.cacheTTL[type];
        }
    }

    async fetchData(type) {
        // Check if data is cached and not expired
        if (this.cache[type] && !this.isDataExpired(type)) {
            console.log(`Using cached ${type} data`);
            return this.cache[type];
        }

        try {
            console.log(`Fetching fresh ${type} data from API`);
            // Use IPC to fetch data through main process to avoid CORS issues
            const data = await ipcRenderer.invoke('fetch-api-data', this.endpoints[type]);
            this.cache[type] = data;
            this.cacheTimestamps[type] = Date.now();
            return data;
        } catch (error) {
            console.error(`Error fetching ${type} data:`, error);
            // Fallback to local data if available
            return await this.loadLocalData(type);
        }
    }

    async loadLocalData(type) {
        // Load data from local files as fallback
        const fileMap = {
            skills: '../skills.response.json',
            recipes: '../recipes.response.json',
            inputs: '../inputs.response.json'
        };

        try {
            const response = await fetch(fileMap[type]);
            const data = await response.json();
            this.cache[type] = data;
            return data;
        } catch (error) {
            console.error(`Error loading local ${type} data:`, error);
            return [];
        }
    }

    async getAllSkills() {
        return await this.fetchData('skills');
    }

    async getAllRecipes() {
        return await this.fetchData('recipes');
    }

    async getAllInputs() {
        return await this.fetchData('inputs');
    }

    async getSkillCategories(skillId) {
        // Check if categories are cached and not expired
        if (this.cache.categories.has(skillId) && !this.isDataExpired('categories', skillId)) {
            console.log(`Using cached categories for skill ${skillId}`);
            return this.cache.categories.get(skillId);
        }

        try {
            console.log(`Fetching categories for skill ${skillId}`);
            const categoryUrl = `https://astrolabe.nwnarelith.com/_next/data/dUq4pBnh_8dy1C2Nz3to_/crafting/${skillId}.json?skillID=${skillId}`;
            const data = await ipcRenderer.invoke('fetch-api-data', categoryUrl);
            
            if (data && data.pageProps && data.pageProps.categories) {
                const categories = data.pageProps.categories;
                
                // Cache the categories
                this.cache.categories.set(skillId, categories);
                this.cacheTimestamps.categories.set(skillId, Date.now());
                
                // Also build a reverse mapping for category ID to name
                categories.forEach(category => {
                    this.cache.skillCategories.set(category.id, {
                        id: category.id,
                        name: category.name,
                        count: category.count,
                        skillId: skillId
                    });
                });
                
                return categories;
            }
            
            return [];
        } catch (error) {
            console.error(`Error fetching categories for skill ${skillId}:`, error);
            return [];
        }
    }

    async getAllCategories() {
        // Load categories for all skills
        const skills = await this.getAllSkills();
        const allCategories = [];
        
        for (const skill of skills) {
            const categories = await this.getSkillCategories(skill.id);
            allCategories.push(...categories.map(cat => ({
                ...cat,
                skillId: skill.id,
                skillName: skill.name
            })));
        }
        
        return allCategories;
    }

    async getRecipesBySkill(skillId) {
        const recipes = await this.getAllRecipes();
        return recipes.filter(recipe => recipe.skill === skillId);
    }

    async getRecipesByCategory(skillId, categoryId) {
        const recipes = await this.getAllRecipes();
        return recipes.filter(recipe => 
            recipe.skill === skillId && recipe.category === categoryId
        );
    }

    async getRecipeById(recipeId) {
        const recipes = await this.getAllRecipes();
        const basicRecipe = recipes.find(recipe => recipe.id === recipeId);
        
        if (!basicRecipe) return null;
        
        // Try to fetch detailed recipe data with quantities
        try {
            const detailedRecipe = await this.getDetailedRecipe(basicRecipe.skill, basicRecipe.category, recipeId);
            return detailedRecipe || basicRecipe;
        } catch (error) {
            console.warn('Failed to fetch detailed recipe, using basic data:', error);
            return basicRecipe;
        }
    }

    async getDetailedRecipe(skillId, categoryId, recipeId) {
        // Check if detailed recipe is cached and not expired
        if (this.cache.detailedRecipes.has(recipeId) && !this.isDataExpired('detailedRecipes', recipeId)) {
            console.log(`Using cached detailed recipe for ${recipeId}`);
            return this.cache.detailedRecipes.get(recipeId);
        }

        const detailUrl = `https://astrolabe.nwnarelith.com/_next/data/dUq4pBnh_8dy1C2Nz3to_/crafting/${skillId}/${categoryId}/${recipeId}.json?skillID=${skillId}&categoryID=${categoryId}&recipeID=${recipeId}`;
        
        try {
            console.log(`Fetching detailed recipe ${recipeId}`);
            const data = await ipcRenderer.invoke('fetch-api-data', detailUrl);
            
            if (data && data.pageProps && data.pageProps.recipe) {
                const recipe = data.pageProps.recipe;
                
                // Transform the detailed recipe data to match our format
                const detailedRecipe = {
                    id: recipe.id,
                    skill: recipe.skill,
                    category: recipe.category,
                    categoryName: recipe.categoryName,
                    name: recipe.name,
                    value: recipe.value,
                    cp: recipe.cp,
                    dc: recipe.dc,
                    races: recipe.races || null, // Array of race names or null
                    classes: recipe.classes || null, // Array of class names or null
                    inputs: recipe.input ? recipe.input.map(input => ({
                        name: input.name,
                        quantity: input.quantity,
                        id: input.id,
                        skill: input.skill,
                        category: input.category
                    })) : [],
                    outputs: recipe.output ? recipe.output.map(output => ({
                        name: output.name,
                        quantity: output.quantity,
                        id: output.id,
                        skill: output.skill,
                        category: output.category
                    })) : [],
                    feats: recipe.feats ? recipe.feats.map(feat => ({
                        name: feat.name,
                        id: feat.id
                    })) : [] // Array of feat objects with name and id
                };
                
                // Cache the detailed recipe
                this.cache.detailedRecipes.set(recipeId, detailedRecipe);
                this.cacheTimestamps.detailedRecipes.set(recipeId, Date.now());
                
                return detailedRecipe;
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching detailed recipe:', error);
            return null;
        }
    }

    async searchRecipes(query) {
        if (!query || typeof query !== 'string') {
            console.error('Invalid search query:', query);
            return { recipes: [], ingredients: [] };
        }
        
        try {
            const recipes = await this.getAllRecipes();
            const inputs = await this.getAllInputs();
            
            if (!recipes || !Array.isArray(recipes)) {
                console.error('No valid recipes data available');
                return { recipes: [], ingredients: [] };
            }
            
            if (!inputs || !Array.isArray(inputs)) {
                console.error('No valid inputs data available');
                return { recipes: [], ingredients: [] };
            }
            
            const lowerQuery = query.toLowerCase().trim();
            
            // Search in recipe names
            const recipeResults = recipes.filter(recipe => {
                if (!recipe || !recipe.name) return false;
                
                try {
                    // Search in recipe name
                    if (recipe.name.toLowerCase().includes(lowerQuery)) {
                        return true;
                    }
                    
                    // Search in inputs (handle both string array and object array formats)
                    if (recipe.inputs) {
                        const inputMatches = recipe.inputs.some(input => {
                            const inputName = typeof input === 'string' ? input : input.name;
                            return inputName && inputName.toLowerCase().includes(lowerQuery);
                        });
                        if (inputMatches) return true;
                    }
                    
                    // Search in outputs (handle both string array and object array formats)
                    if (recipe.outputs) {
                        const outputMatches = recipe.outputs.some(output => {
                            const outputName = typeof output === 'string' ? output : output.name;
                            return outputName && outputName.toLowerCase().includes(lowerQuery);
                        });
                        if (outputMatches) return true;
                    }
                    
                    // Search in feats (handle both string array and object array formats)
                    if (recipe.feats) {
                        const featMatches = recipe.feats.some(feat => {
                            const featName = typeof feat === 'string' ? feat : feat.name;
                            return featName && featName.toLowerCase().includes(lowerQuery);
                        });
                        if (featMatches) return true;
                    }
                    
                    // Search in races
                    if (recipe.races) {
                        const raceMatches = recipe.races.some(race => 
                            race && race.toLowerCase().includes(lowerQuery)
                        );
                        if (raceMatches) return true;
                    }
                    
                    // Search in classes
                    if (recipe.classes) {
                        const classMatches = recipe.classes.some(cls => 
                            cls && cls.toLowerCase().includes(lowerQuery)
                        );
                        if (classMatches) return true;
                    }
                    
                    // Search in category name if available
                    if (recipe.categoryName && recipe.categoryName.toLowerCase().includes(lowerQuery)) {
                        return true;
                    }
                    
                    return false;
                } catch (searchError) {
                    console.warn('Error searching recipe:', recipe.name, searchError);
                    return false;
                }
            });

            // Search in ingredient names
            const ingredientResults = inputs.filter(input => {
                try {
                    return input && input.name && input.name.toLowerCase().includes(lowerQuery);
                } catch (searchError) {
                    console.warn('Error searching ingredient:', input, searchError);
                    return false;
                }
            });

            return {
                recipes: recipeResults || [],
                ingredients: ingredientResults || []
            };
            
        } catch (error) {
            console.error('Search recipes error:', error);
            return {
                recipes: [],
                ingredients: []
            };
        }
    }

    async getRecipesUsingItem(itemName) {
        const recipes = await this.getAllRecipes();
        return recipes.filter(recipe => {
            // Check inputs (handle both string array and object array formats)
            const inputMatch = recipe.inputs?.some(input => {
                const inputName = typeof input === 'string' ? input : input.name;
                return inputName === itemName;
            });
            
            // Check outputs (handle both string array and object array formats)
            const outputMatch = recipe.outputs?.some(output => {
                const outputName = typeof output === 'string' ? output : output.name;
                return outputName === itemName;
            });
            
            return inputMatch || outputMatch;
        });
    }

    async getItemUsageChain(itemName) {
        const recipes = await this.getAllRecipes();
        
        // Find recipes that produce this item
        const producers = recipes.filter(recipe => {
            return recipe.outputs?.some(output => {
                const outputName = typeof output === 'string' ? output : output.name;
                return outputName === itemName;
            });
        });

        // Find recipes that use this item
        const consumers = recipes.filter(recipe => {
            return recipe.inputs?.some(input => {
                const inputName = typeof input === 'string' ? input : input.name;
                return inputName === itemName;
            });
        });

        return {
            producedBy: producers,
            usedIn: consumers
        };
    }

    getSkillName(skillId) {
        const skillNames = {
            1: 'Carpentry',
            2: 'Herbalism',
            3: 'Art Crafting',
            4: 'Smithing',
            5: 'Alchemy',
            6: 'Tailoring'
        };
        return skillNames[skillId] || 'Unknown';
    }

    getCategoryName(categoryId) {
        // Check if we have the category in our cache
        if (this.cache.skillCategories.has(categoryId)) {
            return this.cache.skillCategories.get(categoryId).name;
        }
        
        // Fallback to common category names
        const categoryNames = {
            121: 'Materials',
            247: 'Alchemy - Other',
            129: 'Book and Writing Supplies',
            250: 'Containers',
            127: 'Defensive Essence',
            240: 'Fishing',
            115: 'Fixture',
            131: 'Golem Parts',
            81: 'Grenadelike',
            39: 'Medical',
            260: 'Miscellaneous',
            130: 'Mundane Consumable',
            137: 'Pending Removal',
            125: 'Permanent Essence',
            123: 'Poison',
            49: 'Potion',
            231: 'Siege Projectile',
            126: 'Temporary Essence',
            116: 'Workstation'
        };
        return categoryNames[categoryId] || `Category ${categoryId}`;
    }

    async getCategoryById(categoryId) {
        // Return full category info if available
        if (this.cache.skillCategories.has(categoryId)) {
            return this.cache.skillCategories.get(categoryId);
        }
        
        // Try to load categories for all skills if not loaded
        await this.getAllCategories();
        
        return this.cache.skillCategories.get(categoryId) || {
            id: categoryId,
            name: this.getCategoryName(categoryId),
            count: 0,
            skillId: null
        };
    }

    formatRecipeForDisplay(recipe) {
        const hasRestrictions = (recipe.races && recipe.races.length > 0) || 
                              (recipe.classes && recipe.classes.length > 0);
        const hasFeats = recipe.feats && recipe.feats.length > 0;
        
        return {
            ...recipe,
            skillName: this.getSkillName(recipe.skill),
            inputCount: recipe.inputs?.length || 0,
            outputCount: recipe.outputs?.length || 0,
            hasRestrictions: hasRestrictions,
            hasFeats: hasFeats,
            restrictionSummary: this.getRestrictionSummary(recipe),
            featSummary: this.getFeatSummary(recipe)
        };
    }

    getRestrictionSummary(recipe) {
        const restrictions = [];
        if (recipe.races && recipe.races.length > 0) {
            const uniqueRaces = [...new Set(recipe.races)]; // Remove duplicates
            restrictions.push(`${uniqueRaces.length} race${uniqueRaces.length > 1 ? 's' : ''}`);
        }
        if (recipe.classes && recipe.classes.length > 0) {
            const uniqueClasses = [...new Set(recipe.classes)];
            restrictions.push(`${uniqueClasses.length} class${uniqueClasses.length > 1 ? 'es' : ''}`);
        }
        return restrictions.join(', ') || null;
    }

    getFeatSummary(recipe) {
        if (!recipe.feats || recipe.feats.length === 0) return null;
        
        const featCount = recipe.feats.length;
        const featNames = recipe.feats.map(feat => 
            typeof feat === 'string' ? feat : feat.name
        );
        
        return `${featCount} feat${featCount > 1 ? 's' : ''}: ${featNames.join(', ')}`;
    }

    // Helper to get recipes by feat requirement
    async getRecipesByFeat(featName) {
        const recipes = await this.getAllRecipes();
        return recipes.filter(recipe => {
            if (!recipe.feats) return false;
            return recipe.feats.some(feat => {
                const name = typeof feat === 'string' ? feat : feat.name;
                return name && name.toLowerCase().includes(featName.toLowerCase());
            });
        });
    }

    // Helper to get recipes by race restriction
    async getRecipesByRace(raceName) {
        const recipes = await this.getAllRecipes();
        return recipes.filter(recipe => {
            if (!recipe.races) return false;
            return recipe.races.some(race => 
                race.toLowerCase().includes(raceName.toLowerCase())
            );
        });
    }

    // Clear cache to force refresh
    clearCache(type = null) {
        if (type) {
            // Clear specific cache type
            if (this.cache[type] instanceof Map) {
                this.cache[type].clear();
                this.cacheTimestamps[type].clear();
            } else {
                this.cache[type] = null;
                this.cacheTimestamps[type] = null;
            }
        } else {
            // Clear all caches
            this.cache = {
                skills: null,
                recipes: null,
                inputs: null,
                categories: new Map(),
                detailedRecipes: new Map(),
                skillCategories: new Map()
            };
            this.cacheTimestamps = {
                skills: null,
                recipes: null,
                inputs: null,
                categories: new Map(),
                detailedRecipes: new Map()
            };
        }
    }

    // Get cache statistics for debugging
    getCacheStats() {
        return {
            skills: this.cache.skills ? 'cached' : 'not cached',
            recipes: this.cache.recipes ? `${this.cache.recipes.length} items` : 'not cached',
            inputs: this.cache.inputs ? `${this.cache.inputs.length} items` : 'not cached',
            categories: `${this.cache.categories.size} skills cached`,
            detailedRecipes: `${this.cache.detailedRecipes.size} recipes cached`,
            skillCategories: `${this.cache.skillCategories.size} categories mapped`
        };
    }
}

// Create global instance
window.apiService = new APIService();