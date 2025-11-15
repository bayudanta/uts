import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Interceptor untuk menambahkan JWT Token ---
apiClient.interceptors.request.use(
  (config) => {
    // Cek hanya jika kode berjalan di browser
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- API Service Baru ---

// Auth (Publik)
export const authApi = {
  login: (data: any) => apiClient.post('/auth/login', data),
  register: (data: any) => apiClient.post('/auth/register', data),
};

// User (Terproteksi)
export const userApi = {
  getUsers: () => apiClient.get('/api/users'),
  getUser: (id: string) => apiClient.get(`/api/users/${id}`),
};

// Team (Terproteksi)
export const teamApi = {
  getTeams: () => apiClient.get('/api/teams'),
  getTeamDetails: (id: string) => apiClient.get(`/api/teams/${id}`),
};