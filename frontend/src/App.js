import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Import shadcn components
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { Calendar } from './components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { username, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(userData);
      
      toast.success('Login successful!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
      return false;
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      toast.success('Logged out successfully');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Login Component
function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await login(username, password);
    setLoading(false);
  };

  const initializeSystem = async () => {
    try {
      await axios.post(`${API}/init`);
      toast.success('System initialized! Admin credentials: admin/admin123');
    } catch (error) {
      toast.error('Failed to initialize system');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md backdrop-blur-lg bg-white/10 border-white/20">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-bold text-center text-white">
            Employee Work Management
          </CardTitle>
          <p className="text-center text-gray-200 text-sm">
            Sign in to your account
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-white">Username</Label>
              <Input
                id="username"
                data-testid="login-username-input"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input
                id="password"
                data-testid="login-password-input"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-300"
              />
            </div>
            <Button
              type="submit"
              data-testid="login-submit-button"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          
          <div className="text-center">
            <Button
              variant="outline"
              onClick={initializeSystem}
              className="text-sm border-white/20 text-white hover:bg-white/10"
            >
              Initialize System
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Dashboard
function AdminDashboard() {
  const [stats, setStats] = useState({});
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [timeTracking, setTimeTracking] = useState({});
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, employeesRes, assignmentsRes, timeRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/users`),
        axios.get(`${API}/assignments`),
        axios.get(`${API}/time-tracking`)
      ]);
      
      setStats(statsRes.data);
      setEmployees(employeesRes.data);
      setAssignments(assignmentsRes.data);
      setTimeTracking(timeRes.data);
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {user?.full_name}</span>
            <Button onClick={logout} variant="outline" size="sm" data-testid="logout-button">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">{stats.total_employees || 0}</div>
              <div className="text-sm text-gray-600">Total Employees</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-green-600">{stats.total_assignments || 0}</div>
              <div className="text-sm text-gray-600">Total Assignments</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending_assignments || 0}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-purple-600">{stats.submitted_assignments || 0}</div>
              <div className="text-sm text-gray-600">Submitted</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="assignments" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="timetracking">Time Tracking</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Work Assignments</h2>
              <CreateAssignmentDialog employees={employees} onAssignmentCreated={fetchDashboardData} />
            </div>
            <div className="grid gap-4">
              {assignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="employees" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Employees</h2>
              <CreateUserDialog onUserCreated={fetchDashboardData} />
            </div>
            <div className="grid gap-4">
              {employees.map((employee) => (
                <Card key={employee.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{employee.full_name}</h3>
                        <p className="text-sm text-gray-600">{employee.email}</p>
                        <p className="text-sm text-gray-500">@{employee.username}</p>
                      </div>
                      <Badge variant={employee.is_active ? "default" : "secondary"}>
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="timetracking" className="space-y-4">
            <h2 className="text-xl font-semibold">Time Tracking</h2>
            <div className="grid gap-4">
              {Object.entries(timeTracking).map(([userId, data]) => (
                <Card key={userId}>
                  <CardHeader>
                    <CardTitle className="text-lg">{data.user_name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(data.daily_hours).map(([date, minutes]) => (
                        <div key={date} className="flex justify-between items-center">
                          <span className="text-sm">{date}</span>
                          <Badge variant="outline">
                            {Math.round(minutes / 60 * 100) / 100} hours
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4">
            <h2 className="text-xl font-semibold">Submissions</h2>
            <div className="grid gap-4">
              {assignments.filter(a => a.has_submission).map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{assignment.title}</CardTitle>
                    <p className="text-sm text-gray-600">Submitted by: {assignment.employee_name}</p>
                  </CardHeader>
                  <CardContent>
                    {assignment.submission && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                          Submitted: {new Date(assignment.submission.submitted_at).toLocaleString()}
                        </p>
                        {assignment.submission.submission_file_name && (
                          <p className="text-sm">
                            File: {assignment.submission.submission_file_name}
                          </p>
                        )}
                        {assignment.submission.notes && (
                          <div>
                            <p className="text-sm font-medium">Notes:</p>
                            <p className="text-sm text-gray-600">{assignment.submission.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Employee Dashboard
function EmployeeDashboard() {
  const [stats, setStats] = useState({});
  const [assignments, setAssignments] = useState([]);
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, assignmentsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/assignments`)
      ]);
      
      setStats(statsRes.data);
      setAssignments(assignmentsRes.data);
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {user?.full_name}</span>
            <Button onClick={logout} variant="outline" size="sm" data-testid="logout-button">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">{stats.total_assignments || 0}</div>
              <div className="text-sm text-gray-600">Total Assignments</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending_assignments || 0}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-green-600">{stats.submitted_assignments || 0}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </CardContent>
          </Card>
        </div>

        {/* Assignments */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">My Assignments</h2>
          <div className="grid gap-4">
            {assignments.map((assignment) => (
              <EmployeeAssignmentCard key={assignment.id} assignment={assignment} onSubmit={fetchDashboardData} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Assignment Card Component
function AssignmentCard({ assignment }) {
  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800'
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{assignment.title}</CardTitle>
          <Badge className={statusColor[assignment.status] || 'bg-gray-100 text-gray-800'}>
            {assignment.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{assignment.description}</p>
          <div className="flex items-center justify-between text-sm">
            <span>Assigned to: {assignment.employee_name}</span>
            <span>Deadline: {new Date(assignment.deadline).toLocaleDateString()}</span>
          </div>
          {assignment.attachment_name && (
            <div className="text-sm">
              <span className="font-medium">Attachment: </span>
              <span className="text-blue-600">{assignment.attachment_name}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Employee Assignment Card
function EmployeeAssignmentCard({ assignment, onSubmit }) {
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (notes) formData.append('notes', notes);
      if (file) formData.append('file', file);
      
      await axios.post(`${API}/assignments/${assignment.id}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Assignment submitted successfully!');
      setShowSubmissionDialog(false);
      setNotes('');
      setFile(null);
      onSubmit();
    } catch (error) {
      toast.error('Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const isOverdue = new Date(assignment.deadline) < new Date();
  const canSubmit = assignment.status === 'pending' && !isOverdue;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{assignment.title}</CardTitle>
          <div className="flex items-center space-x-2">
            {isOverdue && assignment.status === 'pending' && (
              <Badge variant="destructive">Overdue</Badge>
            )}
            <Badge 
              className={assignment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}
            >
              {assignment.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{assignment.description}</p>
          <div className="text-sm">
            <span className="font-medium">Deadline: </span>
            <span className={isOverdue ? 'text-red-600' : 'text-gray-700'}>
              {new Date(assignment.deadline).toLocaleString()}
            </span>
          </div>
          {assignment.attachment_name && (
            <div className="text-sm">
              <span className="font-medium">Attachment: </span>
              <span className="text-blue-600">{assignment.attachment_name}</span>
            </div>
          )}
          
          {canSubmit && (
            <Dialog open={showSubmissionDialog} onOpenChange={setShowSubmissionDialog}>
              <DialogTrigger asChild>
                <Button className="w-full" data-testid={`submit-assignment-${assignment.id}`}>
                  Submit Work
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Assignment: {assignment.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any notes about your submission..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="file">Upload File (optional)</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={(e) => setFile(e.target.files[0])}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowSubmissionDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          {assignment.status === 'submitted' && (
            <div className="text-sm text-green-600 font-medium">
              ✓ Submitted successfully
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Create User Dialog
function CreateUserDialog({ onUserCreated }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/users`, formData);
      toast.success('Employee created successfully!');
      setOpen(false);
      setFormData({ username: '', email: '', password: '', full_name: '' });
      onUserCreated();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="create-employee-button">Add Employee</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Employee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              data-testid="create-user-fullname"
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              placeholder="Enter full name"
            />
          </div>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              data-testid="create-user-username"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              placeholder="Enter username"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              data-testid="create-user-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="Enter email"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              data-testid="create-user-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="Enter password"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading} data-testid="create-user-submit">
              {loading ? 'Creating...' : 'Create Employee'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Create Assignment Dialog
function CreateAssignmentDialog({ employees, onAssignmentCreated }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    deadline: new Date()
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('assigned_to', formData.assigned_to);
      submitData.append('deadline', formData.deadline.toISOString());
      if (file) submitData.append('file', file);
      
      await axios.post(`${API}/assignments`, submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Assignment created successfully!');
      setOpen(false);
      setFormData({ title: '', description: '', assigned_to: '', deadline: new Date() });
      setFile(null);
      onAssignmentCreated();
    } catch (error) {
      toast.error('Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="create-assignment-button">Create Assignment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              data-testid="assignment-title"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="Enter assignment title"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              data-testid="assignment-description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Enter assignment description"
            />
          </div>
          <div>
            <Label htmlFor="assigned_to">Assign to Employee</Label>
            <Select value={formData.assigned_to} onValueChange={(value) => setFormData({...formData, assigned_to: value})}>
              <SelectTrigger data-testid="assignment-employee-select">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name} ({employee.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="assignment-deadline-picker"
                >
                  {format(formData.deadline, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.deadline}
                  onSelect={(date) => setFormData({...formData, deadline: date})}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="file">Attachment (optional)</Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading} data-testid="create-assignment-submit">
              {loading ? 'Creating...' : 'Create Assignment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main App Component
function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppContent />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </div>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return user.role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />;
}

export default App;