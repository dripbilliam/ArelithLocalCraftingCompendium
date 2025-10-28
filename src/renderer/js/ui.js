class UIManager {
    constructor() {
        this.currentView = 'home';
        this.breadcrumbs = ['Compendium'];
        this.searchTimeout = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Skill card clicks
        document.querySelectorAll('.skill-card').forEach(card => {
            card.addEventListener('click', (e) => this.handleSkillCardClick(e));
        });

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        
        searchInput.addEventListener('input', (e) => this.handleSearchInput(e));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch(e.target.value);
            }
        });
        searchBtn.addEventListener('click', () => {
            this.performSearch(searchInput.value);
        });

        // Breadcrumb navigation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('breadcrumb-item')) {
                this.handleBreadcrumbClick(e);
            }
        });
    }

    handleSkillCardClick(e) {
        const card = e.currentTarget;
        const skillId = card.dataset.skill;
        const view = card.dataset.view;

        if (view === 'all-recipes') {
            this.showAllRecipes();
        } else if (view === 'all-ingredients') {
            this.showAllIngredients();
        } else if (skillId) {
            this.showSkillRecipes(parseInt(skillId));
        }
    }

    handleSearchInput(e) {
        const query = e.target.value.trim();
        
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Only clear search and go home if query is empty
        if (query.length === 0) {
            this.showView('home');
            this.updateBreadcrumbs(['Compendium']);
        }
        
        // Remove auto-search while typing - now only manual search
    }

    async performSearch(query) {
        if (!query || !query.trim()) {
            console.warn('Empty search query provided');
            return;
        }

        const trimmedQuery = query.trim();
        console.log(`Performing search for: "${trimmedQuery}"`);
        
        this.showLoading(true);
        
        try {
            const results = await window.apiService.searchRecipes(trimmedQuery);
            
            if (results && (results.recipes || results.ingredients)) {
                this.showSearchResults(trimmedQuery, results);
                this.updateBreadcrumbs(['Compendium', `Search: "${trimmedQuery}"`]);
            } else {
                console.warn('No valid search results returned');
                this.showSearchResults(trimmedQuery, { recipes: [], ingredients: [] });
                this.updateBreadcrumbs(['Compendium', `Search: "${trimmedQuery}"`]);
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError(`Search failed: ${error.message || 'Unknown error'}. Please try again.`);
            
            // Don't break the search functionality - allow user to try again
            document.getElementById('searchInput').disabled = false;
        } finally {
            this.showLoading(false);
        }
    }

    async showAllRecipes() {
        this.showLoading(true);
        
        try {
            const recipes = await window.apiService.getAllRecipes();
            this.displayRecipeList(recipes, 'All Recipes');
            this.updateBreadcrumbs(['Compendium', 'All Recipes']);
        } catch (error) {
            console.error('Error loading all recipes:', error);
            this.showError('Failed to load recipes.');
        } finally {
            this.showLoading(false);
        }
    }

    async showAllIngredients() {
        this.showLoading(true);
        
        try {
            const ingredients = await window.apiService.getAllInputs();
            this.displayIngredientList(ingredients, 'All Ingredients');
            this.updateBreadcrumbs(['Compendium', 'All Ingredients']);
        } catch (error) {
            console.error('Error loading all ingredients:', error);
            this.showError('Failed to load ingredients.');
        } finally {
            this.showLoading(false);
        }
    }

    async showSkillRecipes(skillId) {
        this.showLoading(true);
        
        try {
            // Load categories for this skill first
            const categories = await window.apiService.getSkillCategories(skillId);
            const skillName = window.apiService.getSkillName(skillId);
            
            if (categories.length > 1) {
                // Show category list if there are multiple categories
                this.displayCategoryList(skillId, skillName, categories);
                this.updateBreadcrumbs(['Compendium', skillName]);
            } else {
                // Show recipes directly if only one category
                const recipes = await window.apiService.getRecipesBySkill(skillId);
                this.displayRecipeList(recipes, skillName);
                this.updateBreadcrumbs(['Compendium', skillName]);
            }
        } catch (error) {
            console.error('Error loading skill recipes:', error);
            this.showError('Failed to load skill recipes.');
        } finally {
            this.showLoading(false);
        }
    }

    async showCategoryRecipes(skillId, categoryId) {
        this.showLoading(true);
        
        try {
            const recipes = await window.apiService.getRecipesByCategory(skillId, categoryId);
            const skillName = window.apiService.getSkillName(skillId);
            const categoryName = window.apiService.getCategoryName(categoryId);
            
            this.displayRecipeList(recipes, `${skillName} - ${categoryName}`);
            this.updateBreadcrumbs(['Compendium', skillName, categoryName]);
        } catch (error) {
            console.error('Error loading category recipes:', error);
            this.showError('Failed to load category recipes.');
        } finally {
            this.showLoading(false);
        }
    }

    async showRecipeDetail(recipeId) {
        this.showLoading(true);
        
        try {
            const recipe = await window.apiService.getRecipeById(recipeId);
            if (recipe) {
                this.displayRecipeDetail(recipe);
                const skillName = window.apiService.getSkillName(recipe.skill);
                const categoryName = recipe.categoryName || window.apiService.getCategoryName(recipe.category);
                
                // Build breadcrumbs with category if available
                if (categoryName && categoryName !== 'Unknown') {
                    this.updateBreadcrumbs(['Compendium', skillName, categoryName, recipe.name]);
                } else {
                    this.updateBreadcrumbs(['Compendium', skillName, recipe.name]);
                }
            } else {
                this.showError('Recipe not found.');
            }
        } catch (error) {
            console.error('Error loading recipe detail:', error);
            this.showError('Failed to load recipe details.');
        } finally {
            this.showLoading(false);
        }
    }

    displayCategoryList(skillId, skillName, categories) {
        const recipeList = document.getElementById('recipeList');
        
        recipeList.innerHTML = `
            <h2 class="section-title">${skillName} Categories</h2>
            <div class="category-grid">
                ${categories.map(category => this.createCategoryCard(skillId, category)).join('')}
            </div>
        `;

        // Add click listeners to category cards
        recipeList.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const skillId = parseInt(e.currentTarget.dataset.skillId);
                const categoryId = parseInt(e.currentTarget.dataset.categoryId);
                this.showCategoryRecipes(skillId, categoryId);
            });
        });

        this.showView('recipeList');
    }

    displayRecipeList(recipes, title) {
        const recipeList = document.getElementById('recipeList');
        
        recipeList.innerHTML = `
            <h2 class="section-title">${title} (${recipes.length})</h2>
            <div class="recipe-grid">
                ${recipes.map(recipe => this.createRecipeCard(recipe)).join('')}
            </div>
        `;

        // Add click listeners to recipe cards
        recipeList.querySelectorAll('.recipe-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const recipeId = parseInt(e.currentTarget.dataset.recipeId);
                this.showRecipeDetail(recipeId);
            });
        });

        this.showView('recipeList');
    }

    displayIngredientList(ingredients, title) {
        const ingredientList = document.getElementById('ingredientList');
        
        ingredientList.innerHTML = `
            <h2 class="section-title">${title} (${ingredients.length})</h2>
            <div class="ingredient-grid">
                ${ingredients.map(ingredient => this.createIngredientCard(ingredient)).join('')}
            </div>
        `;

        // Add click listeners to ingredient cards
        ingredientList.querySelectorAll('.ingredient-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const itemName = e.currentTarget.dataset.itemName;
                await this.showItemUsage(itemName);
            });
        });

        this.showView('ingredientList');
    }

    displayRecipeDetail(recipe) {
        const recipeDetail = document.getElementById('recipeDetail');
        const formattedRecipe = window.apiService.formatRecipeForDisplay(recipe);

        recipeDetail.innerHTML = `
            <div class="recipe-header">
                <div class="recipe-actions" style="float: right;">
                    <button class="icon-btn" title="Edit">🔧</button>
                    <button class="icon-btn" title="Shop">🛒</button>
                    <button class="icon-btn" title="Bookmark">📋</button>
                    <button class="icon-btn" title="Share">↗️</button>
                </div>
                <h1 class="recipe-name">${recipe.name}</h1>
                <div style="clear: both;"></div>
                <div class="recipe-stats">
                    <div class="stat-item">
                        <span class="stat-label">DC:</span>
                        <span class="stat-value">${recipe.dc || 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Craft Points:</span>
                        <span class="stat-value">${recipe.cp || 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Value:</span>
                        <span class="stat-value">${recipe.value || 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">ID:</span>
                        <span class="stat-value">${recipe.id}</span>
                    </div>
                </div>
            </div>

            <div class="recipe-section">
                <h3>Inputs</h3>
                <div class="item-list">
                    ${recipe.inputs ? recipe.inputs.map((input) => {
                        // Handle both old format (strings) and new format (objects with quantities)
                        if (typeof input === 'string') {
                            return `
                                <div class="item-entry">
                                    <span class="item-name" data-item-name="${input}">${input} (1)</span>
                                    <div class="item-actions">
                                        <button class="icon-btn" title="Edit">🔧</button>
                                        <button class="icon-btn" title="Shop">🛒</button>
                                        <button class="icon-btn" title="Find recipes">📋</button>
                                        <button class="icon-btn" title="Share">↗️</button>
                                    </div>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="item-entry">
                                    <span class="item-name" data-item-name="${input.name}">${input.name} (${input.quantity})</span>
                                    <div class="item-actions">
                                        <button class="icon-btn" title="Edit">🔧</button>
                                        <button class="icon-btn" title="Shop">🛒</button>
                                        <button class="icon-btn" title="Find recipes">📋</button>
                                        <button class="icon-btn" title="Share">↗️</button>
                                    </div>
                                </div>
                            `;
                        }
                    }).join('') : '<p>No inputs specified</p>'}
                </div>
            </div>

            <div class="recipe-section">
                <h3>Outputs</h3>
                <div class="item-list">
                    ${recipe.outputs ? recipe.outputs.map(output => {
                        // Handle both old format (strings) and new format (objects with quantities)
                        if (typeof output === 'string') {
                            return `
                                <div class="item-entry">
                                    <span class="item-name" data-item-name="${output}">${output} (1)</span>
                                    <div class="item-actions">
                                        <button class="icon-btn" title="Edit">🔧</button>
                                        <button class="icon-btn" title="Shop">🛒</button>
                                        <button class="icon-btn" title="Find recipes">📋</button>
                                        <button class="icon-btn" title="Share">↗️</button>
                                    </div>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="item-entry">
                                    <span class="item-name" data-item-name="${output.name}">${output.name} (${output.quantity})</span>
                                    <div class="item-actions">
                                        <button class="icon-btn" title="Edit">🔧</button>
                                        <button class="icon-btn" title="Shop">🛒</button>
                                        <button class="icon-btn" title="Find recipes">📋</button>
                                        <button class="icon-btn" title="Share">↗️</button>
                                    </div>
                                </div>
                            `;
                        }
                    }).join('') : '<p>No outputs specified</p>'}
                </div>
            </div>

            ${recipe.races || recipe.classes ? `
                <div class="recipe-section">
                    <h3>Requirements</h3>
                    <div class="requirements-list">
                        ${recipe.races ? `
                            <div class="requirement-group">
                                <span class="requirement-label">Allowed Races:</span>
                                <div class="requirement-tags">
                                    ${recipe.races.map(race => `<span class="race-tag">${race}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                        ${recipe.classes ? `
                            <div class="requirement-group">
                                <span class="requirement-label">Allowed Classes:</span>
                                <div class="requirement-tags">
                                    ${recipe.classes.map(cls => `<span class="class-tag">${cls}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}

            ${recipe.feats && recipe.feats.length > 0 ? `
                <div class="recipe-section">
                    <h3>Required Feats</h3>
                    <div class="feats-list">
                        ${recipe.feats.map(feat => `
                            <span class="feat-tag" data-feat-id="${feat.id}" title="Feat ID: ${feat.id}">
                                ${feat.name}
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        // Add click listeners for item names
        recipeDetail.querySelectorAll('.item-name').forEach(item => {
            item.addEventListener('click', async (e) => {
                const itemName = e.target.dataset.itemName;
                if (itemName) {
                    await this.showItemUsage(itemName);
                }
            });
        });

        // Add click listeners for feat tags to search by feat
        recipeDetail.querySelectorAll('.feat-tag').forEach(tag => {
            tag.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    const featName = e.target.textContent.trim();
                    if (featName && featName.length > 0) {
                        document.getElementById('searchInput').value = featName;
                        await this.performSearch(featName);
                    }
                } catch (error) {
                    console.error('Error searching by feat:', error);
                    this.showError('Failed to search by feat. Please try manually.');
                }
            });
        });

        // Add click listeners for race tags to search by race
        recipeDetail.querySelectorAll('.race-tag').forEach(tag => {
            tag.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    const raceName = e.target.textContent.trim();
                    if (raceName && raceName.length > 0) {
                        document.getElementById('searchInput').value = raceName;
                        await this.performSearch(raceName);
                    }
                } catch (error) {
                    console.error('Error searching by race:', error);
                    this.showError('Failed to search by race. Please try manually.');
                }
            });
        });

        // Add click listeners for class tags to search by class
        recipeDetail.querySelectorAll('.class-tag').forEach(tag => {
            tag.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    const className = e.target.textContent.trim();
                    if (className && className.length > 0) {
                        document.getElementById('searchInput').value = className;
                        await this.performSearch(className);
                    }
                } catch (error) {
                    console.error('Error searching by class:', error);
                    this.showError('Failed to search by class. Please try manually.');
                }
            });
        });

        this.showView('recipeDetail');
    }

    showSearchResults(query, results) {
        const searchResults = document.getElementById('searchResults');
        
        searchResults.innerHTML = `
            <h2 class="section-title">Search Results for "${query}"</h2>
            
            ${results.recipes.length > 0 ? `
                <div class="results-section">
                    <h3>Recipes (${results.recipes.length})</h3>
                    <div class="recipe-grid">
                        ${results.recipes.map(recipe => this.createRecipeCard(recipe)).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${results.ingredients.length > 0 ? `
                <div class="results-section">
                    <h3>Ingredients (${results.ingredients.length})</h3>
                    <div class="ingredient-grid">
                        ${results.ingredients.map(ingredient => this.createIngredientCard(ingredient)).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${results.recipes.length === 0 && results.ingredients.length === 0 ? `
                <p class="no-results">No results found for "${query}". Try a different search term.</p>
            ` : ''}
        `;

        // Add event listeners
        this.addSearchResultListeners(searchResults);
        this.showView('searchResults');
    }

    addSearchResultListeners(container) {
        // Recipe clicks
        container.querySelectorAll('.recipe-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const recipeId = parseInt(e.currentTarget.dataset.recipeId);
                this.showRecipeDetail(recipeId);
            });
        });

        // Ingredient clicks
        container.querySelectorAll('.ingredient-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const itemName = e.currentTarget.dataset.itemName;
                await this.showItemUsage(itemName);
            });
        });
    }

    async showItemUsage(itemName) {
        this.showLoading(true);
        
        try {
            const usage = await window.apiService.getItemUsageChain(itemName);
            // For now, show recipes that use this item
            if (usage.usedIn.length > 0 || usage.producedBy.length > 0) {
                const allRecipes = [...usage.producedBy, ...usage.usedIn];
                this.displayRecipeList(allRecipes, `Recipes using "${itemName}"`);
                this.updateBreadcrumbs(['Compendium', 'Item Usage', itemName]);
            } else {
                this.showError(`No recipes found using "${itemName}"`);
            }
        } catch (error) {
            console.error('Error loading item usage:', error);
            this.showError('Failed to load item usage.');
        } finally {
            this.showLoading(false);
        }
    }

    createCategoryCard(skillId, category) {
        return `
            <div class="category-item" data-skill-id="${skillId}" data-category-id="${category.id}">
                <div class="category-info">
                    <h4>${category.name}</h4>
                    <div class="category-meta">
                        <span>${category.count} recipes</span>
                    </div>
                </div>
                <div class="category-actions">
                    <button class="icon-btn" title="View Recipes">👁️</button>
                </div>
            </div>
        `;
    }

    createRecipeCard(recipe) {
        const formattedRecipe = window.apiService.formatRecipeForDisplay(recipe);
        
        return `
            <div class="recipe-item ${formattedRecipe.hasRestrictions ? 'has-restrictions' : ''} ${formattedRecipe.hasFeats ? 'has-feats' : ''}" data-recipe-id="${recipe.id}">
                <div class="recipe-info">
                    <div class="recipe-header">
                        <h4>${recipe.name}</h4>
                        <div class="recipe-indicators">
                            ${formattedRecipe.hasRestrictions ? '<span class="indicator restriction-indicator" title="Race/Class Restrictions">🚫</span>' : ''}
                            ${formattedRecipe.hasFeats ? '<span class="indicator feat-indicator" title="Feat Requirements">⭐</span>' : ''}
                        </div>
                    </div>
                    <div class="recipe-meta">
                        <span>DC: ${recipe.dc || 'N/A'}</span>
                        <span>CP: ${recipe.cp || 'N/A'}</span>
                        <span>Value: ${recipe.value || 'N/A'}</span>
                        <span>Skill: ${formattedRecipe.skillName}</span>
                    </div>
                    ${formattedRecipe.restrictionSummary ? `
                        <div class="recipe-restrictions">
                            <small>Restricted to: ${formattedRecipe.restrictionSummary}</small>
                        </div>
                    ` : ''}
                    ${formattedRecipe.hasFeats ? `
                        <div class="recipe-feat-hint">
                            <small>Requires ${recipe.feats.length} feat${recipe.feats.length > 1 ? 's' : ''}</small>
                        </div>
                    ` : ''}
                </div>
                <div class="recipe-actions">
                    <button class="icon-btn" title="View Details">👁️</button>
                </div>
            </div>
        `;
    }

    createIngredientCard(ingredient) {
        return `
            <div class="ingredient-item" data-item-name="${ingredient.name}">
                <div class="ingredient-name">${ingredient.name}</div>
                <div class="ingredient-usage">Click to see usage in recipes</div>
            </div>
        `;
    }

    showView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Show target view
        const targetView = document.getElementById(viewName + 'View');
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;
        }
    }

    updateBreadcrumbs(crumbs) {
        this.breadcrumbs = crumbs;
        const breadcrumbNav = document.getElementById('breadcrumbs');
        
        breadcrumbNav.innerHTML = crumbs.map((crumb, index) => {
            const isActive = index === crumbs.length - 1;
            return `<span class="breadcrumb-item ${isActive ? 'active' : ''}" data-index="${index}">${crumb}</span>`;
        }).join('');
    }

    handleBreadcrumbClick(e) {
        const index = parseInt(e.target.dataset.index);
        const targetCrumb = this.breadcrumbs[index];
        
        if (index === 0) {
            // Back to home
            this.showView('home');
            this.updateBreadcrumbs(['Compendium']);
            document.getElementById('searchInput').value = '';
        }
        // Add more breadcrumb navigation logic as needed
    }

    showLoading(show) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (show) {
            loadingIndicator.classList.add('active');
        } else {
            loadingIndicator.classList.remove('active');
        }
    }

    showError(message) {
        console.error('UI Error:', message);
        
        // Create a temporary error display instead of alert
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span class="error-message">${message}</span>
                <button class="error-close" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// Create global UI manager instance
window.uiManager = new UIManager();