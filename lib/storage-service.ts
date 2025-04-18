// Storage service to handle both local and "server" storage
// In a real application, server storage would be an API call
// Here we simulate it with localStorage for demonstration

export interface StorageOptions {
  useServerStorage?: boolean
}

const LOCAL_STORAGE_KEY = "testProgress"
const SERVER_STORAGE_KEY = "serverTestProgress"

export const StorageService = {
  // Save data to storage
  saveData: (data: any, options: StorageOptions = {}) => {
    const jsonData = JSON.stringify(data)

    // Always save to local storage
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonData)

    // If server storage is enabled, save there too
    if (options.useServerStorage) {
      // In a real app, this would be an API call
      // For demo purposes, we'll use a different localStorage key
      localStorage.setItem(SERVER_STORAGE_KEY, jsonData)

      // Simulate network latency
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve()
        }, 300)
      })
    }

    return Promise.resolve()
  },

  // Load data from storage
  loadData: (options: StorageOptions = {}) => {
    // Try to load from server storage first if enabled
    if (options.useServerStorage) {
      const serverData = localStorage.getItem(SERVER_STORAGE_KEY)
      if (serverData) {
        try {
          return Promise.resolve(JSON.parse(serverData))
        } catch (error) {
          console.error("Error parsing server data:", error)
        }
      }
    }

    // Fall back to local storage
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (localData) {
      try {
        return Promise.resolve(JSON.parse(localData))
      } catch (error) {
        console.error("Error parsing local data:", error)
      }
    }

    return Promise.resolve(null)
  },

  // Clear saved data
  clearData: (options: StorageOptions = {}) => {
    localStorage.removeItem(LOCAL_STORAGE_KEY)

    if (options.useServerStorage) {
      localStorage.removeItem(SERVER_STORAGE_KEY)

      // Simulate network latency
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve()
        }, 300)
      })
    }

    return Promise.resolve()
  },
}
