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
import { Switch } from './components/ui/switch';
import { format } from 'date-fns';
import { Download, Eye, Clock, DollarSign, Users, FileText, CheckCircle, XCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalEnabled, setPortalEnabled] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    // Check portal status
    checkPortalStatus();
    setLoading(false);
  }, []);

  const checkPortalStatus = async () => {
    try {
      const response = await axios.get(`${API}/portal-status`);
      setPortalEnabled(response.data.enabled);
    } catch (error) {
      console.error('Error checking portal status:', error);
    }
  };

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
    <AuthContext.Provider value={{ user, login, logout, loading, portalEnabled, checkPortalStatus }}>
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
  const { login, portalEnabled } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!portalEnabled && username !== 'admin') {
      toast.error('Portal is currently disabled. Please contact administrator.');
      return;
    }
    setLoading(true);
    await login(username, password);
    setLoading(false);
  };

  const initializeSystem = async () => {
    try {
      await axios.post(`${API}/init`);
      toast.success('Life Line\'s work portal initialized! Admin credentials: admin/admin');
    } catch (error) {
      toast.error('Failed to initialize system');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md backdrop-blur-lg bg-white/10 border-white/20">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Life Line's Work Portal
          </CardTitle>
          <p className="text-gray-200 text-sm">
            Professional Work Management System
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!portalEnabled && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-center">
              <p className="text-red-200 text-sm">Portal is currently disabled for employees</p>
            </div>
          )}
          
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
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
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
  const [employeeEarnings, setEmployeeEarnings] = useState([]);
  const [portalEnabled, setPortalEnabled] = useState(true);
  const { user, logout, checkPortalStatus } = useAuth();

  useEffect(() => {
    fetchDashboardData();
    fetchPortalStatus();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, employeesRes, assignmentsRes, timeRes, earningsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/users`),
        axios.get(`${API}/assignments`),
        axios.get(`${API}/time-tracking`),
        axios.get(`${API}/employees/earnings`)
      ]);
      
      setStats(statsRes.data);
      setEmployees(employeesRes.data);
      setAssignments(assignmentsRes.data);
      setTimeTracking(timeRes.data);
      setEmployeeEarnings(earningsRes.data);
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
    }
  };

  const fetchPortalStatus = async () => {
    try {
      const response = await axios.get(`${API}/portal-status`);
      setPortalEnabled(response.data.enabled);
    } catch (error) {
      console.error('Error fetching portal status:', error);
    }
  };

  const togglePortalStatus = async () => {
    try {
      const response = await axios.post(`${API}/system/portal-toggle`);
      setPortalEnabled(response.data.portal_enabled);
      toast.success(response.data.message);
      checkPortalStatus();
    } catch (error) {
      toast.error('Failed to toggle portal status');
    }
  };

  const downloadFile = async (assignmentId, type = 'submission') => {
    try {
      const endpoint = type === 'submission' 
        ? `${API}/assignments/${assignmentId}/download`
        : `${API}/assignments/${assignmentId}/attachment`;
      
      const response = await axios.get(endpoint, {
        responseType: 'blob'
      });
      
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `${type}_file`;
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`${type} file downloaded successfully`);
    } catch (error) {
      toast.error(`Failed to download ${type} file`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Life Line's Work Portal</h1>
              <p className="text-sm text-gray-600">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Label htmlFor="portal-toggle" className="text-sm font-medium">
                Portal Status
              </Label>
              <Switch
                id="portal-toggle"
                checked={portalEnabled}
                onCheckedChange={togglePortalStatus}
                data-testid="portal-toggle-switch"
              />
              <span className={`text-sm ${portalEnabled ? 'text-green-600' : 'text-red-600'}`}>
                {portalEnabled ? 'Online' : 'Offline'}
              </span>
            </div>
            <span className="text-sm text-gray-600">Welcome, {user?.full_name}</span>
            <Button onClick={logout} variant="outline" size="sm" data-testid="logout-button">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xl font-bold text-blue-600">{stats.total_employees || 0}</div>
                  <div className="text-xs text-gray-600">Employees</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xl font-bold text-green-600">{stats.total_assignments || 0}</div>
                  <div className="text-xs text-gray-600">Assignments</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <div>
                  <div className="text-xl font-bold text-yellow-600">{stats.pending_assignments || 0}</div>
                  <div className="text-xs text-gray-600">Pending</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="text-xl font-bold text-purple-600">{stats.accepted_assignments || 0}</div>
                  <div className="text-xs text-gray-600">Accepted</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-indigo-600" />
                <div>
                  <div className="text-xl font-bold text-indigo-600">₹{stats.total_earnings || 0}</div>
                  <div className="text-xs text-gray-600">Total Earnings</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <div>
                  <div className="text-xl font-bold text-orange-600">₹{stats.total_pending_earnings || 0}</div>
                  <div className="text-xs text-gray-600">Pending Pay</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="text-xl font-bold text-emerald-600">₹{stats.total_credited_earnings || 0}</div>
                  <div className="text-xs text-gray-600">Credited</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="assignments" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
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
                <AdminAssignmentCard 
                  key={assignment.id} 
                  assignment={assignment} 
                  onUpdate={fetchDashboardData}
                  onDownload={downloadFile}
                />
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
                      <div className="text-right space-y-1">
                        <div className="text-sm font-medium">Total: ₹{employee.total_earnings || 0}</div>
                        <div className="text-xs text-orange-600">Pending: ₹{employee.pending_earnings || 0}</div>
                        <div className="text-xs text-green-600">Credited: ₹{employee.credited_earnings || 0}</div>
                        <div className="text-xs text-blue-600">Balance: ₹{employee.account_balance || 0}</div>
                        <Badge variant={employee.is_active ? "default" : "secondary"}>
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="balances" className="space-y-4">
            <h2 className="text-xl font-semibold">Employee Balance Management</h2>
            <div className="grid gap-4">
              {employees.map((employee) => (
                <EmployeeBalanceCard key={employee.id} employee={employee} onUpdate={fetchDashboardData} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <h2 className="text-xl font-semibold">Payment Management</h2>
            <div className="grid gap-4">
              {employeeEarnings.map((emp) => (
                <Card key={emp.employee_id}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      {emp.employee_name}
                      <div className="text-right text-sm space-y-1">
                        <div>Total: ₹{emp.total_earnings}</div>
                        <div className="text-orange-600">Pending: ₹{emp.pending_earnings}</div>
                        <div className="text-green-600">Credited: ₹{emp.credited_earnings}</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {emp.payment_details.map((payment, idx) => (
                        <PaymentCard key={idx} payment={payment} onUpdate={fetchDashboardData} />
                      ))}
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
            <h2 className="text-xl font-semibold">Submissions Review</h2>
            <div className="grid gap-4">
              {assignments.filter(a => a.has_submission && ['submitted', 'resubmitted'].includes(a.status)).map((assignment) => (
                <SubmissionReviewCard 
                  key={assignment.id} 
                  assignment={assignment} 
                  onUpdate={fetchDashboardData}
                  onDownload={downloadFile}
                />
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
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Life Line's Work Portal</h1>
              <p className="text-sm text-gray-600">Employee Dashboard</p>
            </div>
          </div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xl font-bold text-blue-600">{stats.total_assignments || 0}</div>
                  <div className="text-xs text-gray-600">Total Tasks</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <div>
                  <div className="text-xl font-bold text-yellow-600">{stats.pending_assignments || 0}</div>
                  <div className="text-xs text-gray-600">Pending</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xl font-bold text-green-600">{stats.accepted_assignments || 0}</div>
                  <div className="text-xs text-gray-600">Completed</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-indigo-600" />
                <div>
                  <div className="text-xl font-bold text-indigo-600">₹{stats.total_earnings || 0}</div>
                  <div className="text-xs text-gray-600">Total Earnings</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <div>
                  <div className="text-xl font-bold text-orange-600">₹{stats.pending_earnings || 0}</div>
                  <div className="text-xs text-gray-600">Pending</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="text-xl font-bold text-emerald-600">₹{stats.credited_earnings || 0}</div>
                  <div className="text-xs text-gray-600">Credited</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-purple-500 to-pink-500">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-white" />
                <div>
                  <div className="text-xl font-bold text-white">₹{stats.account_balance || 0}</div>
                  <div className="text-xs text-white/90">Account Balance</div>
                </div>
              </div>
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

// Admin Assignment Card Component
function AdminAssignmentCard({ assignment, onUpdate, onDownload }) {
  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    submitted: 'bg-blue-100 text-blue-800', 
    resubmitted: 'bg-purple-100 text-purple-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{assignment.title}</CardTitle>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">₹{assignment.amount}</span>
            <Badge className={statusColors[assignment.status] || 'bg-gray-100 text-gray-800'}>
              {assignment.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{assignment.description}</p>
          <div className="flex items-center justify-between text-sm">
            <span>Assigned to: {assignment.employee_name}</span>
            <span>Deadline: {new Date(assignment.deadline).toLocaleDateString()}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            {assignment.attachment_name && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onDownload(assignment.id, 'attachment')}
              >
                <Download className="w-4 h-4 mr-1" />
                Assignment File
              </Button>
            )}
            
            {assignment.has_submission && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onDownload(assignment.id, 'submission')}
              >
                <Download className="w-4 h-4 mr-1" />
                Submission File
              </Button>
            )}
          </div>
          
          {assignment.submission && (
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm font-medium">Submitted: {new Date(assignment.submission.submitted_at).toLocaleString()}</p>
              {assignment.submission.notes && (
                <p className="text-sm text-gray-600 mt-1">{assignment.submission.notes}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Submission Review Card
function SubmissionReviewCard({ assignment, onUpdate, onDownload }) {
  const [reviewAction, setReviewAction] = useState('');
  const [comments, setComments] = useState('');
  const [resubmissionHours, setResubmissionHours] = useState(48);
  const [loading, setLoading] = useState(false);

  const handleReview = async () => {
    if (!reviewAction) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/assignments/${assignment.id}/review`, {
        action: reviewAction,
        comments: comments,
        resubmission_hours: resubmissionHours
      });
      
      toast.success(response.data.message);
      onUpdate();
      setReviewAction('');
      setComments('');
    } catch (error) {
      toast.error('Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{assignment.title}</CardTitle>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">₹{assignment.amount}</span>
            <Badge className="bg-blue-100 text-blue-800">
              {assignment.status === 'resubmitted' ? 'Resubmitted' : 'New Submission'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-sm font-medium">Employee: {assignment.employee_name}</p>
            <p className="text-sm text-gray-600">Submitted: {new Date(assignment.submission.submitted_at).toLocaleString()}</p>
            {assignment.submission.notes && (
              <p className="text-sm mt-2"><strong>Notes:</strong> {assignment.submission.notes}</p>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onDownload(assignment.id, 'submission')}
            >
              <Download className="w-4 h-4 mr-1" />
              Download Work
            </Button>
            
            {assignment.attachment_name && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onDownload(assignment.id, 'attachment')}
              >
                <Eye className="w-4 h-4 mr-1" />
                Original Assignment
              </Button>
            )}
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Review Submission</h4>
            
            <div className="space-y-3">
              <div className="flex space-x-2">
                <Button 
                  size="sm"
                  variant={reviewAction === 'accept' ? 'default' : 'outline'}
                  onClick={() => setReviewAction('accept')}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Accept
                </Button>
                <Button 
                  size="sm"
                  variant={reviewAction === 'reject' ? 'default' : 'outline'}
                  onClick={() => setReviewAction('reject')}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
              </div>
              
              {reviewAction && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Comments for employee..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                  />
                  
                  {reviewAction === 'reject' && (
                    <div>
                      <Label htmlFor="resubmission-hours">Resubmission deadline (hours)</Label>
                      <Input
                        id="resubmission-hours"
                        type="number"
                        value={resubmissionHours}
                        onChange={(e) => setResubmissionHours(parseInt(e.target.value))}
                        min="1"
                        max="168"
                      />
                    </div>
                  )}
                  
                  <Button onClick={handleReview} disabled={loading} className="w-full">
                    {loading ? 'Submitting...' : `${reviewAction === 'accept' ? 'Accept' : 'Reject'} & Notify Employee`}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Payment Card Component
function PaymentCard({ payment, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const handlePaymentAction = async (action) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/assignments/${payment.assignment_id}/payment`, {
        action: action
      });
      
      toast.success(response.data.message);
      onUpdate();
    } catch (error) {
      toast.error('Failed to update payment status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 p-3 rounded flex items-center justify-between">
      <div>
        <p className="font-medium">{payment.assignment_title}</p>
        <p className="text-sm text-gray-600">₹{payment.amount}</p>
        <p className="text-xs text-gray-500">
          Accepted: {new Date(payment.accepted_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Badge variant={payment.payment_status === 'paid' ? 'default' : 'secondary'}>
          {payment.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
        </Badge>
        {payment.payment_status === 'paid' ? (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handlePaymentAction('mark_unpaid')}
            disabled={loading}
          >
            Mark Unpaid
          </Button>
        ) : (
          <Button 
            size="sm"
            onClick={() => handlePaymentAction('mark_paid')}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Mark Paid
          </Button>
        )}
      </div>
    </div>
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
      
      const response = await axios.post(`${API}/assignments/${assignment.id}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(response.data.message);
      setShowSubmissionDialog(false);
      setNotes('');
      setFile(null);
      onSubmit();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadAttachment = async () => {
    try {
      const response = await axios.get(`${API}/assignments/${assignment.id}/attachment`, {
        responseType: 'blob'
      });
      
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : 'assignment_file';
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download attachment');
    }
  };

  const isOverdue = new Date(assignment.deadline) < new Date();
  const canSubmit = ['pending', 'rejected'].includes(assignment.status) && !isOverdue;
  const needsResubmission = assignment.status === 'rejected';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{assignment.title}</CardTitle>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-green-600">₹{assignment.amount}</span>
            {isOverdue && assignment.status === 'pending' && (
              <Badge variant="destructive">Overdue</Badge>
            )}
            <Badge 
              className={{
                pending: 'bg-gray-100 text-gray-800',
                submitted: 'bg-blue-100 text-blue-800',
                resubmitted: 'bg-purple-100 text-purple-800', 
                accepted: 'bg-green-100 text-green-800',
                rejected: 'bg-red-100 text-red-800'
              }[assignment.status] || 'bg-gray-100 text-gray-800'}
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
            <Button 
              size="sm" 
              variant="outline"
              onClick={downloadAttachment}
            >
              <Download className="w-4 h-4 mr-1" />
              {assignment.attachment_name}
            </Button>
          )}
          
          {assignment.review_comments && (
            <div className="bg-red-50 border border-red-200 p-3 rounded">
              <p className="text-sm font-medium text-red-800">Review Comments:</p>
              <p className="text-sm text-red-700 mt-1">{assignment.review_comments}</p>
              {assignment.resubmission_deadline && (
                <p className="text-xs text-red-600 mt-2">
                  Resubmit by: {new Date(assignment.resubmission_deadline).toLocaleString()}
                </p>
              )}
            </div>
          )}
          
          {assignment.status === 'accepted' && (
            <div className="bg-green-50 border border-green-200 p-3 rounded">
              <p className="text-sm font-medium text-green-800">
                ✓ Work Accepted! ₹{assignment.amount} has been added to your earnings.
              </p>
            </div>
          )}
          
          {canSubmit && (
            <Dialog open={showSubmissionDialog} onOpenChange={setShowSubmissionDialog}>
              <DialogTrigger asChild>
                <Button className="w-full" data-testid={`submit-assignment-${assignment.id}`}>
                  {needsResubmission ? 'Resubmit Work' : 'Submit Work'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {needsResubmission ? 'Resubmit Assignment' : 'Submit Assignment'}: {assignment.title}
                  </DialogTitle>
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
                    <Label htmlFor="file">Upload File (required)</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={(e) => setFile(e.target.files[0])}
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowSubmissionDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || !file}>
                      {submitting ? 'Submitting...' : (needsResubmission ? 'Resubmit' : 'Submit')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          {assignment.status === 'submitted' && (
            <div className="text-sm text-blue-600 font-medium">
              ✓ Submitted successfully. You will be informed within 24 hours.
            </div>
          )}
          
          {assignment.status === 'resubmitted' && (
            <div className="text-sm text-purple-600 font-medium">
              ✓ Resubmitted successfully. You will be informed within 24 hours.
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
    deadline: new Date(),
    amount: 0,
    review_deadline_hours: 24
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
      submitData.append('amount', formData.amount);
      submitData.append('review_deadline_hours', formData.review_deadline_hours);
      if (file) submitData.append('file', file);
      
      await axios.post(`${API}/assignments`, submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Assignment created successfully!');
      setOpen(false);
      setFormData({ 
        title: '', 
        description: '', 
        assigned_to: '', 
        deadline: new Date(),
        amount: 0,
        review_deadline_hours: 24
      });
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
            <Label htmlFor="description">Task Description</Label>
            <Textarea
              id="description"
              data-testid="assignment-description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Describe the task (e.g., Download the attached image/PDF and create a poster, PowerPoint presentation, or Word document based on the requirements)"
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
              placeholder="Enter payment amount"
            />
          </div>
          <div>
            <Label htmlFor="assigned_to">Assign to Employee</Label>
            <Select value={formData.assigned_to} onValueChange={(value) => setFormData({...formData, assigned_to: value})}>
              <SelectTrigger data-testid="assignment-employee-select">
                <SelectValue placeholder="Select employee or assign to all" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_employees" className="font-medium text-blue-600">
                  📢 Assign to All Employees
                </SelectItem>
                <div className="border-t my-1"></div>
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
            <Label htmlFor="review_hours">Review Deadline (hours)</Label>
            <Input
              id="review_hours"
              type="number"
              value={formData.review_deadline_hours}
              onChange={(e) => setFormData({...formData, review_deadline_hours: parseInt(e.target.value) || 24})}
              min="1"
              max="168"
            />
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return user.role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />;
}

export default App;