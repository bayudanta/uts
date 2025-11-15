'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useSubscription, gql, ApolloError } from '@apollo/client';
import { authApi, teamApi } from '@/lib/api';

// --- GraphQL ---
const GET_MY_TASKS = gql`
  query GetMyTasks {
    myTasks {
      id
      title
      description
      status
      assignee {
        id
        name
      }
    }
  }
`;

const CREATE_TASK = gql`
  mutation CreateTask($title: String!, $description: String, $assigneeId: ID) {
    createTask(title: $title, description: $description, assigneeId: $assigneeId) {
      id
      title
      status
      description
      assignee { id name }
    }
  }
`;

const UPDATE_TASK_STATUS = gql`
  mutation UpdateTaskStatus($id: ID!, $status: TaskStatus!) {
    updateTaskStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

const TASK_UPDATED_SUB = gql`
  subscription OnTaskUpdated {
    taskUpdated {
      id
      title
      status
      assignee { id name }
    }
  }
`;

// --- Komponen ---

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({ email: 'admin@example.com', password: 'password', name: '', teamName: '' });
  const [newTask, setNewTask] = useState({ title: '', description: '' });

  // Cek token saat load
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // --- Auth Handlers ---
  const handleAuthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authApi.login({ email: formData.email, password: formData.password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (error: any) {
      console.error(error);
      alert(`Login Gagal: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authApi.register({ 
        name: formData.name, 
        email: formData.email, 
        password: formData.password,
        teamName: formData.teamName 
      });
      alert('Registrasi berhasil! Silakan login.');
      setAuthView('login');
    } catch (error: any) {
      console.error(error);
      alert(`Registrasi Gagal: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setTeam(null);
    window.location.reload(); // Reload untuk mereset state Apollo
  };


  // --- Render ---

  // Tampilan Login/Register
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-6">
            {authView === 'login' ? 'Login' : 'Register'}
          </h2>
          <form onSubmit={authView === 'login' ? handleLogin : handleRegister}>
            {authView === 'register' && (
              <input
                name="name"
                type="text"
                placeholder="Nama"
                onChange={handleAuthChange}
                value={formData.name}
                className="border rounded-md px-3 py-2 mb-4 w-full"
                required
              />
            )}
            <input
              name="email"
              type="email"
              placeholder="Email"
              onChange={handleAuthChange}
              value={formData.email}
              className="border rounded-md px-3 py-2 mb-4 w-full"
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              onChange={handleAuthChange}
              value={formData.password}
              className="border rounded-md px-3 py-2 mb-4 w-full"
              required
            />
            {authView === 'register' && (
              <input
                name="teamName"
                type="text"
                placeholder="Nama Tim (Opsional, buat tim baru)"
                onChange={handleAuthChange}
                value={formData.teamName}
                className="border rounded-md px-3 py-2 mb-4 w-full"
              />
            )}
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 w-full"
            >
              {authView === 'login' ? 'Login' : 'Register'}
            </button>
          </form>
          <button
            onClick={() => setAuthView(authView === 'login' ? 'register' : 'login')}
            className="text-sm text-blue-500 hover:underline mt-4 text-center w-full"
          >
            {authView === 'login' ? 'Belum punya akun? Register' : 'Sudah punya akun? Login'}
          </button>
        </div>
      </div>
    );
  }

  // Tampilan Aplikasi Utama (setelah login)
  return (
    <Dashboard user={user} onLogout={handleLogout} />
  );
}


// --- Komponen Dashboard (setelah login) ---

function Dashboard({ user, onLogout }: { user: any, onLogout: () => void }) {
  const [team, setTeam] = useState<any>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '' });

  // Ambil data tim
  useEffect(() => {
    if (user && user.teamId) {
      teamApi.getTeamDetails(user.teamId)
        .then(res => setTeam(res.data))
        .catch(err => console.error("Gagal mengambil info tim:", err));
    }
  }, [user]);

  // --- GraphQL Hooks ---
  const { data: tasksData, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useQuery(GET_MY_TASKS);

  const [createTask, { loading: creatingTask }] = useMutation(CREATE_TASK, {
    // Update cache setelah mutasi berhasil
    update(cache, { data: { createTask } }) {
      const existingTasks: any = cache.readQuery({ query: GET_MY_TASKS });
      cache.writeQuery({
        query: GET_MY_TASKS,
        data: { myTasks: [createTask, ...existingTasks.myTasks] },
      });
    }
  });
  
  const [updateTaskStatus] = useMutation(UPDATE_TASK_STATUS);

  // Subscription
  useSubscription(TASK_UPDATED_SUB, {
    onData: ({ data }) => {
      console.log('Notifikasi Task Diperbarui!', data.data.taskUpdated);
      // Cukup refetch query untuk sinkronisasi
      refetchTasks();
    }
  });

  // --- Task Handlers ---
  const handleNewTaskChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewTask({ ...newTask, [e.target.name]: e.target.value });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;
    try {
      await createTask({ variables: { ...newTask } });
      setNewTask({ title: '', description: '' });
    } catch (error) {
      console.error("Gagal membuat task:", error);
    }
  };

  const handleStatusChange = (id: string, status: string) => {
    updateTaskStatus({ variables: { id, status } });
  };

  if (tasksError) {
    return <div className='text-red-500 p-8'>Error loading tasks: {tasksError.message}. Token mungkin expired. <button onClick={onLogout} className='underline'>Logout?</button></div>
  }
  
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">
            Task Management
          </h1>
          <div>
            <span className="text-gray-700 mr-4">Hi, {user.name}!</span>
            <button
              onClick={onLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Kolom Tim */}
          <div className="lg:col-span-1 bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Tim: {team ? team.name : (user.teamId ? 'Loading team...' : 'Tidak ada tim')}
            </h2>
            {team && (
              <div className="space-y-4">
                {team.members.map((member: any) => (
                  <div key={member.id} className="p-3 border rounded">
                    <p className="font-semibold">{member.name} {member.id === user.id && '(You)'}</p>
                    <p className="text-gray-600 text-sm">{member.email}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kolom Task */}
          <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Tasks</h2>
            
            <form onSubmit={handleCreateTask} className="mb-6 space-y-4">
              <input
                name="title"
                type="text"
                placeholder="Judul task baru..."
                value={newTask.title}
                onChange={handleNewTaskChange}
                className="border rounded-md px-3 py-2 w-full"
                required
              />
              <textarea
                name="description"
                placeholder="Deskripsi (opsional)..."
                value={newTask.description}
                onChange={handleNewTaskChange}
                className="border rounded-md px-3 py-2 w-full"
                rows={2}
              />
              <button
                type="submit"
                disabled={creatingTask}
                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-400"
              >
                {creatingTask ? 'Menambahkan...' : 'Add Task'}
              </button>
            </form>

            {tasksLoading ? (
              <p>Loading tasks...</p>
            ) : (
              <div className="space-y-4">
                {tasksData?.myTasks.map((task: any) => (
                  <div key={task.id} className="p-4 border rounded">
                    <h3 className="font-semibold text-lg">{task.title}</h3>
                    {task.description && <p className="text-gray-600 mt-2">{task.description}</p>}
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-sm text-gray-500">
                        Assignee: {task.assignee ? task.assignee.name : 'Unassigned'}
                      </span>
                      <select 
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="todo">To Do</option>
                        <option value="inprogress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}