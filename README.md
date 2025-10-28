# Crafting Compendium

A desktop application built with Electron for browsing NWN Arelith crafting recipes, ingredients, and skills. Features a dark fantasy-themed UI inspired by the game's aesthetic.

## Features

- **Browse by Skill**: View recipes organized by crafting skills (Carpentry, Herbalism, Art Crafting, Smithing, Alchemy, Tailoring)
- **Category Navigation**: Hierarchical browsing through skill categories for better organization
- **Advanced Search**: Search across recipes, ingredients, feats, races, and classes with real-time results
- **Recipe Details**: Detailed view of recipes with inputs, outputs, craft points, difficulty class, and more
- **Requirement Display**: Shows race restrictions, class restrictions, and required feats with visual indicators
- **Smart Caching**: TTL-based caching system reduces API calls and improves performance
- **Item Usage Tracking**: See what recipes use specific items and what they produce
- **Breadcrumb Navigation**: Easy navigation with visual breadcrumbs
- **Interactive Tags**: Click on feats, races, or classes to search for related recipes
- **Visual Indicators**: Recipe cards show icons for restriction and feat requirements
- **Offline Support**: Cached data for offline browsing
- **Keyboard Shortcuts**: 
  - `Ctrl/Cmd + F`: Focus search
  - `Escape`: Clear search or go back
  - `Alt + Left`: Navigate back
  - `Ctrl + Shift + D`: Show cache statistics

## Prerequisites

- Node.js (version 16 or higher)
- npm (comes with Node.js)

## Installation

1. **Install dependencies**:
   ```powershell
   npm install
   ```

2. **Run the application**:
   ```powershell
   npm start
   ```

   Or for development mode with DevTools:
   ```powershell
   npm run dev
   ```

## Building for Distribution

To create a distributable version:

```powershell
npm run build
```

This will create platform-specific installers in the `dist` folder.

## Data Sources

The application fetches data from the Arelith API:
- Skills: https://astrolabe.nwnarelith.com/api/crafting/skills
- Recipes: https://astrolabe.nwnarelith.com/api/crafting/recipes
- Inputs: https://astrolabe.nwnarelith.com/api/crafting/inputs

Local JSON files are included as fallbacks if the API is unavailable.

## Project Structure

```
src/
├── main.js                 # Electron main process
└── renderer/
    ├── index.html          # Main application interface
    ├── styles/
    │   └── main.css        # Application styling
    ├── js/
    │   ├── api.js          # API service for data fetching
    │   ├── ui.js           # UI management and interactions
    │   └── app.js          # Main application initialization
    └── *.json              # Local data files (fallback)
```

## Usage

### Home Screen
- Click on skill categories to browse recipes by craft type
- Use "All Recipes" or "All Ingredients" for complete listings
- Search bar allows filtering across all content

### Recipe Details
- Click any recipe to view detailed information
- See required inputs, produced outputs, and crafting requirements
- Navigate through item relationships by clicking on ingredient names

### Navigation
- Use breadcrumbs to navigate back to previous views
- Search functionality available from any screen
- Keyboard shortcuts for power users


## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test thoroughly
4. Submit a pull request

## Credits

- Built for the NWN Arelith community
- Data provided by Arelith's crafting API
- UI inspired by classic fantasy game aesthetics
