const PREFS_KEY = 'hcmus_user_preferences';
const SCHEDULES_KEY = 'hcmus_saved_schedules';

// Safe default values for user preferences
const DEFAULT_PREFERENCES = {
    avoidDays: [],
    preferSession: 'none',
    avoidSlot1: false,
    avoidEvening: false,
    forcedClasses: {}
};

/**
 * Gets user preferences from chrome.storage.local, falling back to localStorage
 * in non-extension environments (e.g. testing or local web development).
 * 
 * @returns {Promise<Object>} The user preferences object.
 */
export async function getUserPreferences() {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.get([PREFS_KEY], (result) => {
                    resolve(result[PREFS_KEY] || { ...DEFAULT_PREFERENCES });
                });
            });
        }
        
        // Fallback to localStorage
        const localData = localStorage.getItem(PREFS_KEY);
        return localData ? JSON.parse(localData) : { ...DEFAULT_PREFERENCES };
    } catch (error) {
        console.error("Error reading user preferences from storage:", error);
        return { ...DEFAULT_PREFERENCES };
    }
}

/**
 * Saves user preferences to storage.
 * 
 * @param {Object} preferences - The preferences object to save.
 * @returns {Promise<boolean>} Resolves to true if successful, false otherwise.
 */
export async function saveUserPreferences(preferences) {
    try {
        const dataToSave = {
            avoidDays: preferences?.avoidDays || [],
            preferSession: preferences?.preferSession || 'none',
            avoidSlot1: !!preferences?.avoidSlot1,
            avoidEvening: !!preferences?.avoidEvening,
            forcedClasses: preferences?.forcedClasses || {}
        };

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.set({ [PREFS_KEY]: dataToSave }, () => {
                    resolve(true);
                });
            });
        }

        // Fallback to localStorage
        localStorage.setItem(PREFS_KEY, JSON.stringify(dataToSave));
        return true;
    } catch (error) {
        console.error("Error saving user preferences to storage:", error);
        return false;
    }
}

/**
 * Gets saved schedule options from storage.
 * 
 * @returns {Promise<Array>} List of saved schedules.
 */
export async function getSavedSchedules() {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.get([SCHEDULES_KEY], (result) => {
                    resolve(result[SCHEDULES_KEY] || []);
                });
            });
        }

        // Fallback to localStorage
        const localData = localStorage.getItem(SCHEDULES_KEY);
        return localData ? JSON.parse(localData) : [];
    } catch (error) {
        console.error("Error reading saved schedules from storage:", error);
        return [];
    }
}

/**
 * Saves selected schedules to storage.
 * 
 * @param {Array} schedules - The array of schedules to save.
 * @returns {Promise<boolean>} Resolves to true if successful, false otherwise.
 */
export async function saveSavedSchedules(schedules) {
    try {
        const dataToSave = Array.isArray(schedules) ? schedules : [];

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.set({ [SCHEDULES_KEY]: dataToSave }, () => {
                    resolve(true);
                });
            });
        }

        // Fallback to localStorage
        localStorage.setItem(SCHEDULES_KEY, JSON.stringify(dataToSave));
        return true;
    } catch (error) {
        console.error("Error saving schedules to storage:", error);
        return false;
    }
}
