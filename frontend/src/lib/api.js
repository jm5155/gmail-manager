/**
 * api.js - Centralized API Client with JWT Authentication
 * Handles all API requests with automatic JWT token injection
 */

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// Token management
export const getAuthToken = () => {
  return localStorage.getItem('gmail_manager_token');
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('gmail_manager_token', token);
  } else {
    localStorage.removeItem('gmail_manager_token');
  }
};

export const clearAuthToken = () => {
  localStorage.removeItem('gmail_manager_token');
};

/**
 * Make an authenticated API request
 * Automatically includes JWT token in Authorization header if available
 * Falls back to credentials: 'include' for session-based auth
 */
export const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();
  
  const headers = {
    ...options.headers,
  };
  
  // Add JWT token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers,
    credentials: 'include', // Keep for backward compatibility
  };
  
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  try {
    const response = await fetch(url, config);
    
    // Handle 401 Unauthorized - clear token and redirect to login
    if (response.status === 401) {
      clearAuthToken();
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized - please log in');
    }
    
    return response;
  } catch (error) {
    console.error('[API] Request failed:', error);
    throw error;
  }
};

/**
 * Convenience method for GET requests
 */
export const apiGet = async (endpoint) => {
  return apiRequest(endpoint, { method: 'GET' });
};

/**
 * Convenience method for POST requests
 */
export const apiPost = async (endpoint, body) => {
  return apiRequest(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
};

/**
 * Convenience method for DELETE requests
 */
export const apiDelete = async (endpoint) => {
  return apiRequest(endpoint, { method: 'DELETE' });
};

export default {
  apiRequest,
  apiGet,
  apiPost,
  apiDelete,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  API_BASE,
};
