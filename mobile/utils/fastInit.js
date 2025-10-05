// Fast initialization utilities to speed up app startup
import * as SecureStore from 'expo-secure-store';

// Cache for frequently accessed data
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fast token check without blocking
export const getCachedToken = async () => {
  const cacheKey = 'cached_token';
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value;
  }
  
  try {
    const token = await SecureStore.getItemAsync('token');
    cache.set(cacheKey, { value: token, timestamp: Date.now() });
    return token;
  } catch (error) {
    console.error('Error getting cached token:', error);
    return null;
  }
};

// Fast agent data retrieval
export const getCachedAgent = async () => {
  const cacheKey = 'cached_agent';
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value;
  }
  
  try {
    const agentData = await SecureStore.getItemAsync('agent');
    const agent = agentData ? JSON.parse(agentData) : null;
    cache.set(cacheKey, { value: agent, timestamp: Date.now() });
    return agent;
  } catch (error) {
    console.error('Error getting cached agent:', error);
    return null;
  }
};

// Fast settings retrieval
export const getCachedSettings = async () => {
  const cacheKey = 'cached_settings';
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value;
  }
  
  try {
    const settings = {
      syncComplete: await SecureStore.getItemAsync('sync_complete_flag') === 'true',
      lastSyncTime: await SecureStore.getItemAsync('lastSyncTime'),
      syncProgress: await SecureStore.getItemAsync('sync_progress')
    };
    
    cache.set(cacheKey, { value: settings, timestamp: Date.now() });
    return settings;
  } catch (error) {
    console.error('Error getting cached settings:', error);
    return {
      syncComplete: false,
      lastSyncTime: null,
      syncProgress: null
    };
  }
};

// Clear cache when needed
export const clearCache = () => {
  cache.clear();
};

// Preload critical data in background
export const preloadCriticalData = async () => {
  try {
    // Preload in parallel without blocking
    const [token, agent, settings] = await Promise.allSettled([
      getCachedToken(),
      getCachedAgent(),
      getCachedSettings()
    ]);
    
    console.log('✅ Critical data preloaded');
    return {
      token: token.status === 'fulfilled' ? token.value : null,
      agent: agent.status === 'fulfilled' ? agent.value : null,
      settings: settings.status === 'fulfilled' ? settings.value : null
    };
  } catch (error) {
    console.error('Error preloading critical data:', error);
    return { token: null, agent: null, settings: null };
  }
};
