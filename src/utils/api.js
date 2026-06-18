const API_BASE = '/api';

// Helper to retrieve token from storage
const getToken = () => localStorage.getItem('comp_graph_token');

// Main request helper
async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Clear credentials on authentication expiration
    localStorage.removeItem('comp_graph_token');
    localStorage.removeItem('comp_graph_user');
    
    // Broadcast event or dispatch reload to push back to login
    window.dispatchEvent(new Event('auth-expired'));
    throw new Error('Session expired. Please log in again.');
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error('Unable to connect to the backend server. Please verify the server is running.', { cause: err });
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  auth: {
    signup: (username, email, passwordHash, name) => 
      request('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, email, passwordHash, name })
      }),
    login: (username, passwordHash) => 
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, passwordHash })
      }),
    getProfile: () => 
      request('/auth/profile'),
    updateSettings: (settings) => 
      request('/auth/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      })
  },
  events: {
    getEvents: () => 
      request('/events'),

    createSalary: (event) => 
      request('/events/salary', {
        method: 'POST',
        body: JSON.stringify(event)
      }),
    updateSalary: (id, event) => 
      request(`/events/salary/${id}`, {
        method: 'PUT',
        body: JSON.stringify(event)
      }),
    deleteSalary: (id) => 
      request(`/events/salary/${id}`, {
        method: 'DELETE'
      }),
    createComp: (event) => 
      request('/events/comp', {
        method: 'POST',
        body: JSON.stringify(event)
      }),
    updateComp: (id, event) => 
      request(`/events/comp/${id}`, {
        method: 'PUT',
        body: JSON.stringify(event)
      }),
    deleteComp: (id) => 
      request(`/events/comp/${id}`, {
        method: 'DELETE'
      })
  }
};
export default api;
