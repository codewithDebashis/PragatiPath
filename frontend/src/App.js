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
import { Download, Eye, Clock, DollarSign, Users, FileText, CheckCircle, XCircle, Network, TreePine, CreditCard } from 'lucide-react';

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

  const login = async (mobileNumber, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { 
        mobile_number: mobileNumber, 
        password: password 
      });
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

  const register = async (formData) => {
    try {
      const response = await axios.post(`${API}/auth/register`, formData);
      toast.success('Registration successful! Please wait for admin approval.');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
      throw error;
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
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

// Login/Register Component
function LoginRegister() {
  const [isLogin, setIsLogin] = useState(true);
  const [loginData, setLoginData] = useState({ mobile_number: '', password: '' });
  const [registerData, setRegisterData] = useState({
    mobile_number: '',
    full_name: '',
    upi_address: '',
    password: '',
    referred_by_code: ''
  });
  const [loading, setLoading] = useState(false);
  const [referrerInfo, setReferrerInfo] = useState(null);
  const { login, register } = useAuth();

  // Check for referral code in URL when component mounts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
      setRegisterData(prev => ({ ...prev, referred_by_code: refCode }));
      setIsLogin(false); // Switch to registration mode
      validateReferralCode(refCode);
    }
  }, []);

  const validateReferralCode = async (code) => {
    try {
      const response = await axios.get(`${API}/referral/validate/${code}`);
      setReferrerInfo(response.data);
      toast.success(`Joining under ${response.data.referrer_name}'s network!`);
    } catch (error) {
      toast.error('Invalid referral link');
      setReferrerInfo(null);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    await login(loginData.mobile_number, loginData.password);
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(registerData);
      setIsLogin(true);
      setRegisterData({
        mobile_number: '',
        full_name: '',
        upi_address: '',
        password: '',
        referred_by_code: ''
      });
    } catch (error) {
      // Error already handled in register function
    }
    setLoading(false);
  };

  const initializeSystem = async () => {
    try {
      const response = await axios.post(`${API}/init`);
      toast.success(response.data.message);
    } catch (error) {
      toast.error('Failed to initialize system');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md backdrop-blur-lg bg-white/10 border-white/20">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center mb-4">
            <Network className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Life Line's MLM Portal
          </CardTitle>
          <p className="text-gray-200 text-sm">
            {isLogin ? 'Sign in to your account' : 'Create your MLM account'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2 mb-4">
            <Button 
              variant={isLogin ? "default" : "outline"}
              onClick={() => setIsLogin(true)}
              className="flex-1"
            >
              Login
            </Button>
            <Button 
              variant={!isLogin ? "default" : "outline"}
              onClick={() => setIsLogin(false)}
              className="flex-1"
            >
              Register
            </Button>
          </div>

          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobile" className="text-white">Mobile Number</Label>
                <Input
                  id="mobile"
                  type="tel"
                  placeholder="Enter mobile number"
                  value={loginData.mobile_number}
                  onChange={(e) => setLoginData({...loginData, mobile_number: e.target.value})}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-name" className="text-white">Full Name</Label>
                <Input
                  id="reg-name"
                  type="text"
                  placeholder="Enter full name"
                  value={registerData.full_name}
                  onChange={(e) => setRegisterData({...registerData, full_name: e.target.value})}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-mobile" className="text-white">Mobile Number</Label>
                <Input
                  id="reg-mobile"
                  type="tel"
                  placeholder="Enter mobile number"
                  value={registerData.mobile_number}
                  onChange={(e) => setRegisterData({...registerData, mobile_number: e.target.value})}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upi" className="text-white">UPI Address</Label>
                <Input
                  id="upi"
                  type="text"
                  placeholder="yourname@paytm"
                  value={registerData.upi_address}
                  onChange={(e) => setRegisterData({...registerData, upi_address: e.target.value})}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referral" className="text-white">Referral Code (Optional)</Label>
                <Input
                  id="referral"
                  type="text"
                  placeholder="Enter referral code"
                  value={registerData.referred_by_code}
                  onChange={(e) => {
                    setRegisterData({...registerData, referred_by_code: e.target.value});
                    if (e.target.value) {
                      validateReferralCode(e.target.value);
                    } else {
                      setReferrerInfo(null);
                    }
                  }}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                />
                {referrerInfo && (
                  <div className="bg-green-500/20 border border-green-500/30 rounded p-2 text-green-200 text-sm">
                    ✅ Joining under: <strong>{referrerInfo.referrer_name}</strong> ({referrerInfo.referrer_mobile})
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password" className="text-white">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="Create password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                disabled={loading}
              >
                {loading ? 'Registering...' : 'Register'}
              </Button>
            </form>
          )}
          
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

// Member Dashboard
function MemberDashboard() {
  const [stats, setStats] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [referralTree, setReferralTree] = useState([]);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, assignmentsRes, transactionsRes, treeRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/assignments`),
        axios.get(`${API}/transactions`),
        axios.get(`${API}/referral/tree`)
      ]);
      
      setStats(statsRes.data);
      setAssignments(assignmentsRes.data);
      setTransactions(transactionsRes.data);
      setReferralTree(treeRes.data);
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
    }
  };

  const handleWithdrawalRequest = async () => {
    try {
      await axios.post(`${API}/withdrawal/request`, new URLSearchParams({
        amount: withdrawalAmount
      }));
      toast.success('Withdrawal request submitted successfully');
      setShowWithdrawalDialog(false);
      setWithdrawalAmount('');
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to request withdrawal');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Life Line's MLM Portal</h1>
              <p className="text-sm text-gray-600">Member Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {user?.full_name}</span>
            <Button onClick={logout} variant="outline" size="sm">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Registration Status */}
        {!stats.registration_fee_paid && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-yellow-600" />
                <div>
                  <h3 className="font-medium text-yellow-800">Registration Fee Required</h3>
                  <p className="text-sm text-yellow-700">
                    Please pay registration fee to start earning. Contact admin.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-6 h-6 text-white" />
                <div>
                  <div className="text-2xl font-bold text-white">₹{stats.current_balance || 0}</div>
                  <div className="text-xs text-white/90">Current Balance</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xl font-bold text-blue-600">₹{stats.total_earnings || 0}</div>
                  <div className="text-xs text-gray-600">Total Earned</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-red-600" />
                <div>
                  <div className="text-xl font-bold text-red-600">₹{stats.total_withdrawn || 0}</div>
                  <div className="text-xs text-gray-600">Withdrawn</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="text-xl font-bold text-purple-600">{stats.direct_referrals || 0}/5</div>
                  <div className="text-xs text-gray-600">Referrals</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-orange-600" />
                <div>
                  <div className="text-xl font-bold text-orange-600">{stats.pending_submissions || 0}</div>
                  <div className="text-xs text-gray-600">Pending Work</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <Button 
            onClick={() => setShowWithdrawalDialog(true)}
            disabled={!stats.can_withdraw || (stats.current_balance || 0) < 100}
            className="bg-green-600 hover:bg-green-700"
          >
            Request Withdrawal
          </Button>
          
          <ReferralLinkCard referralCode={stats.referral_code} />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="work" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="work">Work Assignments</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="network">My Network</TabsTrigger>
            <TabsTrigger value="earnings">Daily Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="work" className="space-y-4">
            <h2 className="text-xl font-semibold">Available Work</h2>
            <div className="grid gap-4">
              {assignments.map((assignment) => (
                <MemberAssignmentCard key={assignment.id} assignment={assignment} onSubmit={fetchDashboardData} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <h2 className="text-xl font-semibold">Transaction History</h2>
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            <h2 className="text-xl font-semibold">My Referral Network</h2>
            <div className="space-y-4">
              {referralTree.map((tree) => (
                <ReferralTreeCard key={tree.id} tree={tree} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="earnings" className="space-y-4">
            <h2 className="text-xl font-semibold">Daily Earnings</h2>
            <div className="grid gap-2">
              {Object.entries(stats.daily_earnings || {}).map(([date, amount]) => (
                <Card key={date}>
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{date}</span>
                      <span className="font-medium text-green-600">₹{amount}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Withdrawal Dialog */}
        <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Withdrawal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Withdrawal Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="100"
                  max={stats.current_balance}
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  placeholder="Minimum ₹100"
                />
              </div>
              <div className="text-sm text-gray-600">
                <p>Available Balance: ₹{stats.current_balance || 0}</p>
                <p>UPI Address: {user?.upi_address}</p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowWithdrawalDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleWithdrawalRequest}>
                  Submit Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Admin Dashboard (will implement in next iteration)
function AdminDashboard() {
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [settings, setSettings] = useState({});
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [statsRes, usersRes, assignmentsRes, submissionsRes, withdrawalsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/assignments`),
        axios.get(`${API}/admin/submissions`),
        axios.get(`${API}/withdrawal/requests`),
        axios.get(`${API}/admin/settings`)
      ]);
      
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setAssignments(assignmentsRes.data);
      setSubmissions(submissionsRes.data);
      setWithdrawalRequests(withdrawalsRes.data);
      setSettings(settingsRes.data);
    } catch (error) {
      toast.error('Failed to fetch admin data');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Control Panel</h1>
              <p className="text-sm text-gray-600">Life Line's MLM Portal</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {user?.full_name}</span>
            <Button onClick={logout} variant="outline" size="sm">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold text-blue-600">{stats.total_users || 0}</div>
                  <div className="text-xs text-gray-600">Total Members</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-green-600">{stats.active_assignments || 0}</div>
                  <div className="text-xs text-gray-600">Active Work</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{stats.pending_submissions || 0}</div>
                  <div className="text-xs text-gray-600">Pending Reviews</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-red-600" />
                <div>
                  <div className="text-2xl font-bold text-red-600">{stats.pending_withdrawals || 0}</div>
                  <div className="text-xs text-gray-600">Withdrawal Requests</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Tabs - Basic implementation */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="users">Members</TabsTrigger>
            <TabsTrigger value="work">Work Management</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="network">Network View</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Member Management</h2>
            </div>
            <div className="grid gap-4">
              {users.map((member) => (
                <AdminMemberCard key={member.id} member={member} onUpdate={fetchAdminData} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="work" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Work Assignment Management</h2>
              <CreateWorkDialog onWorkCreated={fetchAdminData} />
            </div>
            <div className="grid gap-4">
              {assignments.map((assignment) => (
                <AdminAssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4">
            <h2 className="text-xl font-semibold">Work Submissions Review</h2>
            <div className="grid gap-4">
              {submissions.filter(s => s.status === 'pending').map((submission) => (
                <AdminSubmissionCard key={submission.id} submission={submission} onUpdate={fetchAdminData} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="withdrawals" className="space-y-4">
            <h2 className="text-xl font-semibold">Withdrawal Requests</h2>
            <div className="grid gap-4">
              {withdrawalRequests.map((request) => (
                <AdminWithdrawalCard key={request.id} request={request} onUpdate={fetchAdminData} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <h2 className="text-xl font-semibold">MLM Settings</h2>
            <AdminSettingsCard settings={settings} onUpdate={fetchAdminData} />
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            <h2 className="text-xl font-semibold">Network Overview</h2>
            <p className="text-gray-600">Network visualization will be implemented here</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Component implementations for Member Dashboard
function MemberAssignmentCard({ assignment, onSubmit }) {
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
      
      await axios.post(`${API}/assignments/${assignment.id}/submit`, formData);
      
      toast.success('Work submitted successfully!');
      setShowSubmissionDialog(false);
      setNotes('');
      setFile(null);
      onSubmit();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit work');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadAttachment = async () => {
    try {
      const response = await axios.get(`${API}/assignments/${assignment.id}/attachment`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', assignment.attachment_name || 'assignment_file');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to download attachment');
    }
  };

  const isOverdue = new Date(assignment.deadline) < new Date();
  const hasSubmitted = assignment.has_submitted;
  const submission = assignment.user_submission;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{assignment.title}</CardTitle>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-green-600">₹{assignment.amount}</span>
            {hasSubmitted && (
              <Badge 
                className={{
                  pending: 'bg-yellow-100 text-yellow-800',
                  approved: 'bg-green-100 text-green-800',
                  rejected: 'bg-red-100 text-red-800'
                }[submission?.status] || 'bg-gray-100 text-gray-800'}
              >
                {submission?.status || 'submitted'}
              </Badge>
            )}
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
            <Button size="sm" variant="outline" onClick={downloadAttachment}>
              <Download className="w-4 h-4 mr-1" />
              {assignment.attachment_name}
            </Button>
          )}
          
          {submission?.admin_comments && (
            <div className={`p-3 rounded ${
              submission.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-sm font-medium">Admin Feedback:</p>
              <p className="text-sm mt-1">{submission.admin_comments}</p>
            </div>
          )}
          
          {!hasSubmitted && !isOverdue && (
            <Dialog open={showSubmissionDialog} onOpenChange={setShowSubmissionDialog}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  Submit Work
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Work: {assignment.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add notes about your submission..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="file">Upload Work File</Label>
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
                      {submitting ? 'Submitting...' : 'Submit Work'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionCard({ transaction }) {
  const getTransactionColor = (type) => {
    switch (type) {
      case 'earning': return 'text-green-600';
      case 'commission': return 'text-blue-600';
      case 'withdrawal': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium">{transaction.description}</p>
            <p className="text-xs text-gray-500">
              {new Date(transaction.date).toLocaleString()}
            </p>
          </div>
          <div className={`text-right ${getTransactionColor(transaction.type)}`}>
            <p className="font-bold">
              {transaction.type === 'withdrawal' ? '-' : '+'}₹{Math.abs(transaction.amount)}
            </p>
            <p className="text-xs capitalize">{transaction.type}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReferralTreeCard({ tree }) {
  const renderTree = (node, level = 0) => {
    return (
      <div key={node.id} className={`ml-${level * 4}`}>
        <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded mb-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
            L{node.level}
          </div>
          <div className="flex-1">
            <p className="font-medium">{node.name}</p>
            <p className="text-xs text-gray-600">{node.mobile}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-green-600">₹{node.earnings}</p>
          </div>
        </div>
        {node.children && node.children.map(child => renderTree(child, level + 1))}
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="p-4">
        {renderTree(tree)}
      </CardContent>
    </Card>
  );
}

// Referral Link Card Component
function ReferralLinkCard({ referralCode }) {
  const [copied, setCopied] = useState(false);
  
  const referralLink = `${window.location.origin}?ref=${referralCode}`;
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Referral link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };
  
  return (
    <Card className="flex-1 max-w-sm">
      <CardContent className="p-4">
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600">Your Referral Code</p>
          <p className="text-xl font-bold text-blue-600">{referralCode}</p>
          <Button 
            onClick={copyToClipboard}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {copied ? 'Copied!' : 'Copy Referral Link'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Admin Component Stubs (basic implementations)
function AdminMemberCard({ member, onUpdate }) {
  const markRegistrationPaid = async () => {
    try {
      await axios.post(`${API}/admin/mark-registration-paid/${member.id}`);
      toast.success('Registration marked as paid');
      onUpdate();
    } catch (error) {
      toast.error('Failed to update registration status');
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">{member.full_name}</h3>
            <p className="text-sm text-gray-600">{member.mobile_number}</p>
            <p className="text-sm text-gray-500">{member.upi_address}</p>
            <p className="text-xs text-gray-400">Code: {member.referral_code}</p>
          </div>
          <div className="text-right space-y-2">
            <div className="space-y-1">
              <div className="text-sm">Balance: ₹{member.current_balance || 0}</div>
              <div className="text-xs text-gray-600">Referrals: {member.direct_referrals?.length || 0}</div>
            </div>
            <div className="space-x-2">
              <Badge variant={member.registration_fee_paid ? "default" : "destructive"}>
                {member.registration_fee_paid ? 'Paid' : 'Unpaid'}
              </Badge>
              {!member.registration_fee_paid && (
                <Button size="sm" onClick={markRegistrationPaid}>
                  Mark Paid
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateWorkDialog({ onWorkCreated }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    deadline: new Date(),
    assigned_to: ''
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open]);

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API}/admin/users`);
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('amount', formData.amount);
      submitData.append('deadline', formData.deadline.toISOString());
      submitData.append('assigned_to', formData.assigned_to);
      if (file) submitData.append('file', file);
      
      await axios.post(`${API}/assignments`, submitData);
      
      toast.success(response.data.message);
      setOpen(false);
      setFormData({ title: '', description: '', amount: '', deadline: new Date(), assigned_to: '' });
      setFile(null);
      onWorkCreated();
    } catch (error) {
      toast.error('Failed to create work assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Work Assignment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Work Assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="Enter work title"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Describe the work to be done"
            />
          </div>
          <div>
            <Label htmlFor="amount">Payment Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              placeholder="Enter payment amount"
            />
          </div>
          <div>
            <Label>Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
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
            <Label htmlFor="assigned_to">Assign To</Label>
            <Select value={formData.assigned_to} onValueChange={(value) => setFormData({...formData, assigned_to: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignment target" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_members" className="font-medium text-blue-600">
                  📢 All Members (Broadcast)
                </SelectItem>
                <div className="border-t my-1"></div>
                {members.filter(member => member.registration_fee_paid).map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name} ({member.mobile_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creating...' : 'Create Assignment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Placeholder components for admin functions
function AdminAssignmentCard({ assignment }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-medium">{assignment.title}</h3>
            <p className="text-sm text-gray-600">{assignment.description}</p>
            <p className="text-xs text-gray-500">Deadline: {new Date(assignment.deadline).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-green-600">₹{assignment.amount}</p>
            <Badge>{assignment.is_active ? 'Active' : 'Inactive'}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminSubmissionCard({ submission, onUpdate }) {
  const handleReview = async (action) => {
    try {
      const formData = new FormData();
      formData.append('action', action);
      
      await axios.post(`${API}/submissions/${submission.id}/review`, formData);
      toast.success(`Submission ${action}d successfully`);
      onUpdate();
    } catch (error) {
      toast.error('Failed to review submission');
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium">{submission.assignment_title}</h3>
              <p className="text-sm text-gray-600">By: {submission.user_name} ({submission.user_mobile})</p>
              <p className="text-xs text-gray-500">Submitted: {new Date(submission.submitted_at).toLocaleString()}</p>
            </div>
            <span className="font-bold text-green-600">₹{submission.assignment_amount}</span>
          </div>
          
          {submission.notes && (
            <div className="bg-gray-50 p-2 rounded">
              <p className="text-sm">{submission.notes}</p>
            </div>
          )}
          
          <div className="flex space-x-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleReview('approve')}>
              <CheckCircle className="w-4 h-4 mr-1" />
              Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleReview('reject')}>
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminWithdrawalCard({ request, onUpdate }) {
  const handleProcess = async (action) => {
    try {
      const formData = new FormData();
      formData.append('action', action);
      
      await axios.post(`${API}/withdrawal/${request.id}/process`, formData);
      toast.success(`Withdrawal ${action}d successfully`);
      onUpdate();
    } catch (error) {
      toast.error('Failed to process withdrawal');
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-medium">{request.user_name}</h3>
            <p className="text-sm text-gray-600">{request.user_mobile}</p>
            <p className="text-sm text-gray-600">UPI: {request.upi_address}</p>
            <p className="text-xs text-gray-500">Requested: {new Date(request.requested_at).toLocaleString()}</p>
          </div>
          <div className="text-right space-y-2">
            <p className="text-xl font-bold text-red-600">₹{request.amount}</p>
            <Badge className={{
              pending: 'bg-yellow-100 text-yellow-800',
              approved: 'bg-blue-100 text-blue-800',
              paid: 'bg-green-100 text-green-800',
              rejected: 'bg-red-100 text-red-800'
            }[request.status]}>
              {request.status}
            </Badge>
            {request.status === 'pending' && (
              <div className="space-x-2">
                <Button size="sm" onClick={() => handleProcess('approve')}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleProcess('reject')}>
                  Reject
                </Button>
              </div>
            )}
            {request.status === 'approved' && (
              <Button size="sm" className="bg-green-600" onClick={() => handleProcess('mark_paid')}>
                Mark Paid
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminSettingsCard({ settings, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(settings);

  const handleSave = async () => {
    try {
      const submitData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          submitData.append(key, value);
        }
      });
      
      await axios.post(`${API}/admin/settings`, submitData);
      toast.success('Settings updated successfully');
      setEditing(false);
      onUpdate();
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">System Settings</h3>
            <Button onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : 'Edit'}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Registration Fee (₹)</Label>
              {editing ? (
                <Input
                  type="number"
                  value={formData.registration_fee || ''}
                  onChange={(e) => setFormData({...formData, registration_fee: parseFloat(e.target.value)})}
                />
              ) : (
                <p className="font-medium">₹{settings.registration_fee || 0}</p>
              )}
            </div>
            
            <div>
              <Label>Minimum Withdrawal (₹)</Label>
              {editing ? (
                <Input
                  type="number"
                  value={formData.minimum_withdrawal || ''}
                  onChange={(e) => setFormData({...formData, minimum_withdrawal: parseFloat(e.target.value)})}
                />
              ) : (
                <p className="font-medium">₹{settings.minimum_withdrawal || 0}</p>
              )}
            </div>
          </div>
          
          <div>
            <Label>Commission Rates (%)</Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {[1,2,3,4,5].map(level => (
                <div key={level}>
                  <Label className="text-xs">Level {level}</Label>
                  {editing ? (
                    <Input
                      type="number"
                      step="0.1"
                      value={formData[`commission_l${level}`] || ''}
                      onChange={(e) => setFormData({...formData, [`commission_l${level}`]: parseFloat(e.target.value)})}
                    />
                  ) : (
                    <p className="font-medium">{settings[`commission_l${level}`] || 0}%</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {editing && (
            <div className="flex justify-end">
              <Button onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginRegister />;
  }

  return user.role === 'admin' ? <AdminDashboard /> : <MemberDashboard />;
}

export default App;