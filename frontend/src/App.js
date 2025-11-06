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
import { Download, Eye, Clock, DollarSign, Users, FileText, CheckCircle, XCircle, Network, TreePine, CreditCard, Upload, Settings, ChevronDown, ChevronRight, UserPlus, Copy, Check } from 'lucide-react';

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
      const { access_token, user: userData, must_change_password } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('must_change_password', must_change_password ? 'true' : 'false');
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(userData);
      
      if (must_change_password) {
        toast.warning('Please change your password to continue');
      } else {
        toast.success('Login successful!');
      }
      return { success: true, must_change_password };
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
      return { success: false, must_change_password: false };
    }
  };

  const register = async (formData) => {
    try {
      const response = await axios.post(`${API}/auth/register`, formData);
      const { default_password, mobile_number } = response.data;
      toast.success(`Registration successful! Your default password is your mobile number: ${default_password}. Please change it after first login.`, {
        duration: 8000
      });
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
  const [loading, setLoading] = useState({
    stats: true,
    assignments: true,
    transactions: true,
    tree: true
  });
  const [activeTab, setActiveTab] = useState('work');
  const [advertisements, setAdvertisements] = useState([]);
  const [adSettings, setAdSettings] = useState(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchDashboardData();
    fetchAdSettings();
  }, []);

  const fetchAdSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings/public`);
      setAdSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch ad settings');
    }
  };

  const fetchDashboardData = async () => {
    // Fetch stats
    try {
      const statsRes = await axios.get(`${API}/dashboard/stats`);
      setStats(statsRes.data);
      setLoading(prev => ({ ...prev, stats: false }));
    } catch (error) {
      toast.error('Failed to fetch stats');
      setLoading(prev => ({ ...prev, stats: false }));
    }

    // Fetch assignments
    try {
      const assignmentsRes = await axios.get(`${API}/assignments`);
      setAssignments(assignmentsRes.data);
      setLoading(prev => ({ ...prev, assignments: false }));
    } catch (error) {
      toast.error('Failed to fetch assignments');
      setLoading(prev => ({ ...prev, assignments: false }));
    }

    // Fetch transactions
    try {
      const transactionsRes = await axios.get(`${API}/transactions`);
      setTransactions(transactionsRes.data);
      setLoading(prev => ({ ...prev, transactions: false }));
    } catch (error) {
      toast.error('Failed to fetch transactions');
      setLoading(prev => ({ ...prev, transactions: false }));
    }

    // Fetch tree
    try {
      const treeRes = await axios.get(`${API}/referral/tree`);
      setReferralTree(treeRes.data);
      setLoading(prev => ({ ...prev, tree: false }));
    } catch (error) {
      toast.error('Failed to fetch referral tree');
      setLoading(prev => ({ ...prev, tree: false }));
    }

    // Fetch advertisements
    try {
      const adsRes = await axios.get(`${API}/advertisements`);
      setAdvertisements(adsRes.data);
    } catch (error) {
      console.error('Failed to fetch advertisements');
    }
  };

  const isInitialLoading = loading.stats;

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
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 md:px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-3 md:space-x-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Network className="w-4 h-4 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-gray-900">Life Line's MLM Portal</h1>
              <p className="text-xs md:text-sm text-gray-600 hidden md:block">Member Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <span className="text-xs md:text-sm text-gray-600">Welcome, {user?.full_name}</span>
            <Button onClick={logout} variant="outline" size="sm" className="text-xs md:text-sm">
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Initial Loading Spinner */}
      {isInitialLoading ? (
        <div className="flex items-center justify-center min-h-screen pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <div className="pt-20 md:pt-24 px-4 md:px-6 pb-6 max-w-7xl mx-auto space-y-6">
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
          <Card className="bg-gradient-to-r from-blue-500 to-indigo-600">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-6 h-6 text-white" />
                <div>
                  <div className="text-2xl font-bold text-white">₹{stats.total_installments_paid || 0}</div>
                  <div className="text-xs text-white/90">My Contribution</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-6 h-6 text-white" />
                <div>
                  <div className="text-2xl font-bold text-white">₹{stats.current_balance || 0}</div>
                  <div className="text-xs text-white/90">Account Balance</div>
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
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <Button 
            onClick={() => setShowWithdrawalDialog(true)}
            disabled={!stats.can_withdraw || (stats.current_balance || 0) < 100}
            className="bg-green-600 hover:bg-green-700"
            title={!stats.can_withdraw ? `You need ${5 - (stats.direct_referrals || 0)} more joiner${5 - (stats.direct_referrals || 0) !== 1 ? 's' : ''} to request withdrawal` : ''}
          >
            Request Withdrawal
          </Button>
          
          <Card className="flex-1 max-w-lg">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Your Referral Code</p>
                  <p className="text-xl font-bold text-blue-600">{stats.referral_code}</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Share this link to earn commissions:</Label>
                  <div className="flex space-x-2">
                    <Input 
                      value={`${window.location.origin}?ref=${stats.referral_code}`}
                      readOnly 
                      className="text-xs bg-gray-50"
                    />
                    <Button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}?ref=${stats.referral_code}`);
                        toast.success('Referral link copied!');
                      }}
                      size="sm"
                      className="bg-blue-600"
                    >
                      Copy Link
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin UPI Payment Info Card */}
        {stats.admin_upi && (
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-5 h-5" />
                    <h3 className="font-semibold">Payment Information</h3>
                  </div>
                  <p className="text-sm text-white/90 mb-3">
                    Use this UPI address to deposit your registration fee
                  </p>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/80 mb-1">Admin UPI Address</p>
                      <p className="font-mono font-bold text-lg">{stats.admin_upi}</p>
                    </div>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(stats.admin_upi);
                        toast.success('UPI address copied!');
                      }}
                      size="sm"
                      variant="secondary"
                      className="ml-3"
                    >
                      Copy UPI
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upline Info Card */}
        {stats.upline && (
          <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-10 h-10" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Your Upline (Referrer)</h3>
                  <p className="text-lg font-bold">{stats.upline.name}</p>
                  <p className="text-sm text-white/90">📞 {stats.upline.mobile}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Advertisement Video Section */}
        {adSettings && (adSettings.advertisement_video_url || adSettings.advertisement_video_file) && (
          <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Important Announcement
              </h3>
              {adSettings.advertisement_video_type === 'url' && adSettings.advertisement_video_url ? (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
                  {(() => {
                    const url = adSettings.advertisement_video_url;
                    // Check if it's a YouTube URL
                    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
                    const match = url.match(youtubeRegex);
                    
                    if (match && match[1]) {
                      // YouTube video - use iframe with embed URL
                      const videoId = match[1];
                      return (
                        <iframe
                          className="w-full rounded-lg"
                          style={{ height: '300px' }}
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title="Advertisement Video"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      );
                    } else {
                      // Direct video URL - use video tag
                      return (
                        <video 
                          controls 
                          className="w-full rounded-lg"
                          style={{ maxHeight: '300px' }}
                        >
                          <source src={url} />
                          Your browser does not support the video tag.
                        </video>
                      );
                    }
                  })()}
                </div>
              ) : adSettings.advertisement_video_type === 'file' && adSettings.advertisement_video_file ? (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
                  <video 
                    controls 
                    className="w-full rounded-lg"
                    style={{ maxHeight: '300px' }}
                  >
                    <source src={adSettings.advertisement_video_file} />
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 hidden md:grid">
            <TabsTrigger value="work">Work Assignments</TabsTrigger>
            <TabsTrigger value="dailywork">Daily Work Report</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="network">My Network</TabsTrigger>
            <TabsTrigger value="earnings">Daily Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="work" className="space-y-4">
            <h2 className="text-xl font-semibold">Available Work</h2>
            {loading.assignments ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : assignments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No work assignments available</p>
            ) : (
              <div className="grid gap-4">
                {assignments.map((assignment) => (
                  <MemberAssignmentCard key={assignment.id} assignment={assignment} onSubmit={fetchDashboardData} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="dailywork" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Daily Work Report</h2>
              <DailyWorkReportDialog onReportSubmitted={fetchDashboardData} />
            </div>
            <DailyWorkReports />
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <h2 className="text-xl font-semibold">Transaction History</h2>
            {loading.transactions ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction) => (
                  <TransactionCard key={transaction.id} transaction={transaction} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            <h2 className="text-xl font-semibold">My Referral Network</h2>
            {loading.tree ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : referralTree.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No referrals yet. Start building your network!</p>
            ) : (
              <div className="space-y-4">
                {referralTree.map((tree) => (
                  <ReferralTreeCard key={tree.id} tree={tree} />
                ))}
              </div>
            )}
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
        
        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="grid grid-cols-5 gap-1 p-2">
            <button
              onClick={() => setActiveTab('work')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'work' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
            >
              <FileText className="w-5 h-5 mb-1" />
              <span className="text-xs">Work</span>
            </button>
            <button
              onClick={() => setActiveTab('dailywork')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'dailywork' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
            >
              <FileText className="w-5 h-5 mb-1" />
              <span className="text-xs">Daily</span>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'transactions' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
            >
              <DollarSign className="w-5 h-5 mb-1" />
              <span className="text-xs">Money</span>
            </button>
            <button
              onClick={() => setActiveTab('network')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'network' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
            >
              <Users className="w-5 h-5 mb-1" />
              <span className="text-xs">Network</span>
            </button>
            <button
              onClick={() => setActiveTab('earnings')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'earnings' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
            >
              <DollarSign className="w-5 h-5 mb-1" />
              <span className="text-xs">Earnings</span>
            </button>
          </div>
        </div>

        {/* Scrolling Text Banner - Fixed at bottom above mobile nav on small screens, just at bottom on desktop */}
        {adSettings && adSettings.scrolling_text && (
          <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white py-2 z-40 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap">
              <span className="text-sm font-medium mx-4">✨ {adSettings.scrolling_text} ✨</span>
              <span className="text-sm font-medium mx-4">✨ {adSettings.scrolling_text} ✨</span>
              <span className="text-sm font-medium mx-4">✨ {adSettings.scrolling_text} ✨</span>
              <span className="text-sm font-medium mx-4">✨ {adSettings.scrolling_text} ✨</span>
            </div>
          </div>
        )}
      </div>
      )}
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
  const [loading, setLoading] = useState({
    stats: true,
    users: true,
    assignments: true,
    submissions: true,
    withdrawals: true,
    settings: true
  });
  const [activeTab, setActiveTab] = useState('users');
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    // Fetch stats
    try {
      const statsRes = await axios.get(`${API}/dashboard/stats`);
      setStats(statsRes.data);
      setLoading(prev => ({ ...prev, stats: false }));
    } catch (error) {
      toast.error('Failed to fetch stats');
      setLoading(prev => ({ ...prev, stats: false }));
    }

    // Fetch users
    try {
      const usersRes = await axios.get(`${API}/admin/users`);
      setUsers(usersRes.data);
      setLoading(prev => ({ ...prev, users: false }));
    } catch (error) {
      toast.error('Failed to fetch users');
      setLoading(prev => ({ ...prev, users: false }));
    }

    // Fetch assignments
    try {
      const assignmentsRes = await axios.get(`${API}/assignments`);
      setAssignments(assignmentsRes.data);
      setLoading(prev => ({ ...prev, assignments: false }));
    } catch (error) {
      toast.error('Failed to fetch assignments');
      setLoading(prev => ({ ...prev, assignments: false }));
    }

    // Fetch submissions
    try {
      const submissionsRes = await axios.get(`${API}/admin/submissions`);
      setSubmissions(submissionsRes.data);
      setLoading(prev => ({ ...prev, submissions: false }));
    } catch (error) {
      toast.error('Failed to fetch submissions');
      setLoading(prev => ({ ...prev, submissions: false }));
    }

    // Fetch withdrawals
    try {
      const withdrawalsRes = await axios.get(`${API}/withdrawal/requests`);
      setWithdrawalRequests(withdrawalsRes.data);
      setLoading(prev => ({ ...prev, withdrawals: false }));
    } catch (error) {
      toast.error('Failed to fetch withdrawals');
      setLoading(prev => ({ ...prev, withdrawals: false }));
    }

    // Fetch settings
    try {
      const settingsRes = await axios.get(`${API}/admin/settings`);
      setSettings(settingsRes.data);
      setLoading(prev => ({ ...prev, settings: false }));
    } catch (error) {
      toast.error('Failed to fetch settings');
      setLoading(prev => ({ ...prev, settings: false }));
    }
  };

  const isInitialLoading = loading.stats;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 md:px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-3 md:space-x-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg flex items-center justify-center">
              <Network className="w-4 h-4 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-gray-900">Admin Control Panel</h1>
              <p className="text-xs md:text-sm text-gray-600 hidden md:block">Life Line's MLM Portal</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <span className="text-xs md:text-sm text-gray-600">Welcome, {user?.full_name}</span>
            <Button onClick={logout} variant="outline" size="sm" className="text-xs md:text-sm">
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Initial Loading Spinner */}
      {isInitialLoading ? (
        <div className="flex items-center justify-center min-h-screen pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading admin dashboard...</p>
          </div>
        </div>
      ) : (
        <div className="pt-20 md:pt-24 px-4 md:px-6 pb-6 max-w-7xl mx-auto space-y-6">
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7 hidden md:grid">
            <TabsTrigger value="users">Members</TabsTrigger>
            <TabsTrigger value="work">Work Management</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="dailyreports">Daily Reports</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="network">Network View</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Member Management</h2>
              <CreateMemberDialog users={users} onMemberCreated={fetchAdminData} />
            </div>
            {loading.users ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : users.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No members yet</p>
            ) : (
              <div className="grid gap-4">
                {users.map((member) => (
                  <AdminMemberCard key={member.id} member={member} settings={settings} onUpdate={fetchAdminData} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="work" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Work Assignment Management</h2>
              <CreateWorkDialog onWorkCreated={fetchAdminData} />
            </div>
            {loading.assignments ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : assignments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No assignments created yet</p>
            ) : (
              <div className="grid gap-4">
                {assignments.map((assignment) => (
                  <AdminAssignmentCard key={assignment.id} assignment={assignment} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4">
            <h2 className="text-xl font-semibold">Work Submissions Review</h2>
            {loading.submissions ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : submissions.filter(s => s.status === 'pending').length === 0 ? (
              <p className="text-gray-500 text-center py-8">No pending submissions</p>
            ) : (
              <div className="grid gap-4">
                {submissions.filter(s => s.status === 'pending').map((submission) => (
                  <AdminSubmissionCard key={submission.id} submission={submission} onUpdate={fetchAdminData} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="withdrawals" className="space-y-4">
            <h2 className="text-xl font-semibold">Withdrawal Requests</h2>
            {loading.withdrawals ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : withdrawalRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No withdrawal requests</p>
            ) : (
              <div className="grid gap-4">
                {withdrawalRequests.map((request) => (
                  <AdminWithdrawalCard key={request.id} request={request} onUpdate={fetchAdminData} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <h2 className="text-xl font-semibold">MLM Settings</h2>
            {loading.settings ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : (
              <AdminSettingsCard settings={settings} onUpdate={fetchAdminData} />
            )}
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            <h2 className="text-xl font-semibold">Network Overview - All Members</h2>
            {loading.users ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    📊 Complete network visualization showing all members and their referral trees across 5 levels.
                  </p>
                </div>
                {users.filter(u => u.role !== 'admin').map((member) => (
                  <div key={member.id} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b">
                      <div>
                        <h3 className="font-semibold text-lg">{member.full_name}</h3>
                        <p className="text-sm text-gray-600">{member.mobile_number} • Code: {member.referral_code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total Earnings</p>
                        <p className="text-xl font-bold text-green-600">₹{member.total_earnings || 0}</p>
                      </div>
                    </div>
                    <NetworkTreeView userId={member.id} userName={member.full_name} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="dailyreports" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Daily Work Reports</h2>
              <Button onClick={async () => {
                try {
                  const response = await axios.get(`${API}/admin/daily-work-reports/export`, {
                    responseType: 'blob'
                  });
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', 'daily_work_reports.xlsx');
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(url);
                  toast.success('Daily reports downloaded successfully');
                } catch (error) {
                  toast.error('Failed to download reports');
                }
              }}>
                <Download className="w-4 h-4 mr-2" />
                Download Excel
              </Button>
            </div>
            <DailyWorkReports />
          </TabsContent>
        </Tabs>
        
        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="grid grid-cols-7 gap-1 p-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'users' ? 'bg-red-50 text-red-600' : 'text-gray-600'}`}
            >
              <Users className="w-5 h-5 mb-1" />
              <span className="text-xs">Users</span>
            </button>
            <button
              onClick={() => setActiveTab('work')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'work' ? 'bg-red-50 text-red-600' : 'text-gray-600'}`}
            >
              <FileText className="w-5 h-5 mb-1" />
              <span className="text-xs">Work</span>
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'submissions' ? 'bg-red-50 text-red-600' : 'text-gray-600'}`}
            >
              <Upload className="w-5 h-5 mb-1" />
              <span className="text-xs">Submit</span>
            </button>
            <button
              onClick={() => setActiveTab('withdrawals')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'withdrawals' ? 'bg-red-50 text-red-600' : 'text-gray-600'}`}
            >
              <DollarSign className="w-5 h-5 mb-1" />
              <span className="text-xs">Money</span>
            </button>
            <button
              onClick={() => setActiveTab('dailyreports')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'dailyreports' ? 'bg-red-50 text-red-600' : 'text-gray-600'}`}
            >
              <FileText className="w-5 h-5 mb-1" />
              <span className="text-xs">Daily</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'settings' ? 'bg-red-50 text-red-600' : 'text-gray-600'}`}
            >
              <Settings className="w-5 h-5 mb-1" />
              <span className="text-xs">Config</span>
            </button>
            <button
              onClick={() => setActiveTab('network')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg ${activeTab === 'network' ? 'bg-red-50 text-red-600' : 'text-gray-600'}`}
            >
              <Network className="w-5 h-5 mb-1" />
              <span className="text-xs">Tree</span>
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// Component implementations for Member Dashboard
function MemberAssignmentCard({ assignment, onSubmit }) {
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Please upload a file before submitting');
      return;
    }

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

  const postToWhatsAppStatus = async () => {
    try {
      // First download the image
      const response = await axios.get(`${API}/assignments/${assignment.id}/attachment`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', assignment.attachment_name || 'whatsapp_status_image');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      // Wait a bit for download to start
      setTimeout(() => {
        // Open WhatsApp
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
          // On mobile, open WhatsApp app
          window.location.href = 'whatsapp://send';
        } else {
          // On desktop, open WhatsApp Web
          window.open('https://web.whatsapp.com/', '_blank');
        }
        
        // Show instructions
        toast.success(
          '✅ Image downloaded! Now:\n1. Open WhatsApp Status\n2. Select the downloaded image\n3. Post to your Status\n4. Return here and click "Submit Work"',
          { duration: 10000 }
        );
      }, 1000);
      
    } catch (error) {
      toast.error('Failed to download image for WhatsApp');
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
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={downloadAttachment} className="flex-1">
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
              <Button 
                size="sm" 
                onClick={postToWhatsAppStatus}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Post to Status
              </Button>
            </div>
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
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl">Submit Your Work</DialogTitle>
                  <p className="text-sm text-gray-600">{assignment.title}</p>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  {/* File Upload Area */}
                  <div>
                    <Label className="text-base font-medium mb-3 block">Upload Your Work File *</Label>
                    
                    {!file ? (
                      <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                          dragActive 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('file-upload-input').click()}
                      >
                        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-lg font-medium text-gray-700 mb-2">
                          Drop your file here or click to browse
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          Supports: Images, PDFs, Videos, Documents, Excel files
                        </p>
                        <Button type="button" variant="outline" size="sm">
                          Choose File
                        </Button>
                        <input
                          id="file-upload-input"
                          type="file"
                          className="hidden"
                          onChange={handleFileChange}
                          accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                        />
                      </div>
                    ) : (
                      <div className="border-2 border-green-300 bg-green-50 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="w-6 h-6 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{file.name}</p>
                              <p className="text-sm text-gray-600">{formatFileSize(file.size)}</p>
                              <div className="mt-2 flex items-center text-sm text-green-600">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                File selected and ready to upload
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeFile}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes Section */}
                  <div>
                    <Label htmlFor="notes" className="text-base font-medium mb-2 block">
                      Additional Notes <span className="text-gray-400 font-normal">(Optional)</span>
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any comments or notes about your submission..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Describe your work or add any relevant information
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => {
                        setShowSubmissionDialog(false);
                        setFile(null);
                        setNotes('');
                      }}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmit} 
                      disabled={submitting || !file}
                      className="bg-green-600 hover:bg-green-700 min-w-[120px]"
                    >
                      {submitting ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Submit Work
                        </>
                      )}
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
  const [expandedNodes, setExpandedNodes] = useState({});

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const getLevelColor = (level) => {
    const colors = {
      1: 'bg-blue-500',
      2: 'bg-green-500',
      3: 'bg-yellow-500',
      4: 'bg-orange-500',
      5: 'bg-red-500'
    };
    return colors[level] || 'bg-gray-500';
  };

  const getLevelBorder = (level) => {
    const colors = {
      1: 'border-blue-200',
      2: 'border-green-200',
      3: 'border-yellow-200',
      4: 'border-orange-200',
      5: 'border-red-200'
    };
    return colors[level] || 'border-gray-200';
  };

  const renderTree = (node, level = 0, isLast = true) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node.id] !== false; // Default to expanded

    return (
      <div key={node.id} className="relative">
        {/* Vertical line connector */}
        {level > 0 && (
          <div className="absolute left-0 top-0 w-8 h-8 border-l-2 border-b-2 border-gray-300 rounded-bl-lg" 
               style={{ marginLeft: `${(level - 1) * 2}rem` }} />
        )}
        
        {/* Node card */}
        <div 
          className={`mb-3 ${level > 0 ? 'ml-8' : ''}`}
          style={{ marginLeft: level > 0 ? `${level * 2}rem` : '0' }}
        >
          <div className={`border-2 ${getLevelBorder(node.level)} rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center gap-3">
              {/* Level badge */}
              <div className={`w-10 h-10 ${getLevelColor(node.level)} rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                L{node.level}
              </div>
              
              {/* Member info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900 truncate">{node.name}</p>
                  <Badge variant="outline" className="text-xs">
                    {node.mobile}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {node.children?.length || 0} referrals
                  </span>
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <DollarSign className="w-3 h-3" />
                    ₹{node.earnings || 0}
                  </span>
                </div>
              </div>

              {/* Expand/Collapse button */}
              {hasChildren && (
                <button
                  onClick={() => toggleNode(node.id)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Children nodes */}
          {hasChildren && isExpanded && (
            <div className="mt-2 relative">
              {node.children.map((child, index) => 
                renderTree(child, level + 1, index === node.children.length - 1)
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5" />
          Referral Network Tree
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {tree ? (
          <div className="space-y-2">
            {renderTree(tree)}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Network className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No referral network yet</p>
            <p className="text-sm mt-1">Share your referral link to start building your network</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Network Tree View Component (for admin to see individual member's network)
function NetworkTreeView({ userId, userName }) {
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded) {
      fetchTree();
    }
  }, [expanded, userId]);

  const fetchTree = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/referral/tree`, {
        params: { user_id: userId }
      });
      setTrees(response.data); // Get all trees (direct referrals)
    } catch (error) {
      console.error('Failed to fetch tree:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="mb-3"
      >
        <TreePine className="w-4 h-4 mr-2" />
        {expanded ? 'Hide' : 'Show'} Network Tree
      </Button>

      {expanded && (
        <div className="pl-4 border-l-2 border-gray-200">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : trees.length > 0 ? (
            <div className="space-y-3">
              {trees.map((tree, index) => (
                <ReferralTreeCard key={tree.id || index} tree={tree} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4">No referrals yet for {userName}</p>
          )}
        </div>
      )}
    </div>
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
          <div className="space-y-3 pt-3">
            <Button onClick={copyToClipboard} variant="outline" className="w-full">
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Referral Link'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Create Member Dialog Component
function CreateMemberDialog({ users, onMemberCreated }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    mobile_number: '',
    upi_address: '',
    parent_user_id: 'none'  // Default to 'none' instead of empty string
  });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!formData.full_name || !formData.mobile_number || !formData.upi_address) {
      toast.error('Please fill all required fields');
      return;
    }

    if (formData.mobile_number.length !== 10 || !/^\d+$/.test(formData.mobile_number)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    setCreating(true);
    try {
      const submitData = new FormData();
      submitData.append('full_name', formData.full_name);
      submitData.append('mobile_number', formData.mobile_number);
      submitData.append('upi_address', formData.upi_address);
      if (formData.parent_user_id && formData.parent_user_id !== 'none') {
        submitData.append('parent_user_id', formData.parent_user_id);
      }

      const response = await axios.post(`${API}/admin/create-member`, submitData);
      
      toast.success(
        `Member created successfully! Default password: ${response.data.default_password}`,
        { duration: 8000 }
      );
      
      // Reset form
      setFormData({
        full_name: '',
        mobile_number: '',
        upi_address: '',
        parent_user_id: 'none'
      });
      setOpen(false);
      onMemberCreated();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create member');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700">
          <UserPlus className="w-4 h-4 mr-2" />
          Add New Member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Member</DialogTitle>
          <p className="text-sm text-gray-600">Add a member and place them under any existing member</p>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              placeholder="Enter full name"
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile_number">Mobile Number *</Label>
            <Input
              id="mobile_number"
              placeholder="Enter 10-digit mobile number"
              value={formData.mobile_number}
              onChange={(e) => setFormData({...formData, mobile_number: e.target.value})}
              maxLength={10}
            />
            <p className="text-xs text-gray-500">
              This will be used as username and default password
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="upi_address">UPI Address *</Label>
            <Input
              id="upi_address"
              placeholder="user@paytm or user@upi"
              value={formData.upi_address}
              onChange={(e) => setFormData({...formData, upi_address: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent_user_id">Place Under (Parent Member)</Label>
            <Select 
              value={formData.parent_user_id} 
              onValueChange={(value) => setFormData({...formData, parent_user_id: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select parent member (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Parent (Root Level)</SelectItem>
                {users.filter(u => u.role !== 'admin').map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} ({user.mobile_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Member will be placed under selected parent in MLM hierarchy
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              ℹ️ The new member will receive their mobile number as default password and must change it on first login.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="flex-1"
              disabled={creating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={creating}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {creating ? 'Creating...' : 'Create Member'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Force Change Password Dialog Component
function ForceChangePasswordDialog({ open, onPasswordChanged }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill all fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (oldPassword === newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('old_password', oldPassword);
      formData.append('new_password', newPassword);

      await axios.post(`${API}/auth/change-password`, formData);
      
      // Update localStorage to remove must_change_password flag
      localStorage.setItem('must_change_password', 'false');
      
      toast.success('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Notify parent component
      if (onPasswordChanged) {
        onPasswordChanged();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-red-600">⚠️ Password Change Required</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              You are using a default password (your mobile number). For security reasons, you must change your password before accessing your dashboard.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="old-password">Current Password</Label>
            <Input
              id="old-password"
              type="password"
              placeholder="Enter your current password (mobile number)"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Enter new password (min 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleChangePassword} 
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Changing Password...' : 'Change Password'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Admin Component Stubs (basic implementations)
function AdminMemberCard({ member, settings, onUpdate }) {
  const [showNetwork, setShowNetwork] = useState(false);
  const [showInstallmentDialog, setShowInstallmentDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [installmentNumber, setInstallmentNumber] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const registrationFee = settings?.registration_fee || 1000; // Default to 1000 if settings not loaded

  const markRegistrationPaid = async () => {
    try {
      await axios.post(`${API}/admin/mark-registration-paid/${member.id}`);
      toast.success('Registration marked as paid');
      onUpdate();
    } catch (error) {
      toast.error('Failed to update registration status');
    }
  };

  const removeMember = async () => {
    setRemoving(true);
    try {
      await axios.delete(`${API}/admin/remove-member/${member.id}`);
      toast.success('Member removed successfully');
      setShowRemoveDialog(false);
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove member');
    } finally {
      setRemoving(false);
    }
  };

  const resetPassword = async () => {
    try {
      const response = await axios.post(`${API}/admin/reset-password/${member.id}`);
      toast.success(`Password reset to mobile number: ${response.data.default_password}`, {
        duration: 5000
      });
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset password');
    }
  };

  const recordInstallment = async () => {
    if (!installmentNumber || !installmentAmount) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/installment-payment/${member.id}`, {
        user_id: member.id,
        installment_number: parseInt(installmentNumber),
        amount: parseFloat(installmentAmount)
      });
      toast.success('Installment recorded successfully');
      setShowInstallmentDialog(false);
      setInstallmentNumber('');
      setInstallmentAmount('');
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record installment');
    } finally {
      setSubmitting(false);
    }
  };

  const totalInstallments = member.registration_installments?.length || 0;
  const totalPaid = member.total_installments_paid || 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
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
                <div className="text-xs text-gray-600">Direct Referrals: {member.downline_count || 0}</div>
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

          {/* Installment Payment Section */}
          <div className="border-t pt-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm">
                <span className="font-medium">Installments:</span> {totalInstallments}/10
                <span className="text-gray-500 ml-2">
                  (₹{totalPaid.toFixed(2)} paid)
                </span>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowInstallmentDialog(true)}
              >
                <CreditCard className="w-4 h-4 mr-1" />
                Add Installment
              </Button>
            </div>
            
            {totalInstallments > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {member.registration_installments?.map((amount, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    #{idx + 1}: ₹{amount}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Show downline members */}
          {member.downline_count > 0 && (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNetwork(!showNetwork)}
                className="w-full"
              >
                <TreePine className="w-4 h-4 mr-1" />
                {showNetwork ? 'Hide' : 'View'} Network ({member.downline_count} joiners)
              </Button>
              
              {showNetwork && (
                <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200">
                  {member.downline_members?.map((joiner) => (
                    <div key={joiner.id} className="bg-gray-50 p-2 rounded text-sm">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{joiner.full_name}</p>
                          <p className="text-xs text-gray-600">{joiner.mobile_number}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-green-600">₹{joiner.total_earnings || 0}</p>
                          <Badge size="sm" variant={joiner.registration_fee_paid ? "default" : "destructive"}>
                            {joiner.registration_fee_paid ? 'Active' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Member Actions */}
          <div className="border-t pt-3 grid grid-cols-3 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowCredentialsDialog(true)}
              className="w-full"
            >
              <Eye className="w-4 h-4 mr-1" />
              Credentials
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={resetPassword}
              className="w-full text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              <Settings className="w-4 h-4 mr-1" />
              Reset Pass
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setShowRemoveDialog(true)}
              className="w-full"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      </CardContent>

      {/* View Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Member Login Credentials</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-2">
                🔐 Share these credentials with the member if they forget
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm text-gray-600">Member Name</Label>
                <div className="p-3 bg-gray-50 rounded border">
                  <p className="font-medium">{member.full_name}</p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm text-gray-600">User ID / Mobile Number</Label>
                <div className="p-3 bg-gray-50 rounded border flex justify-between items-center">
                  <p className="font-mono font-medium">{member.mobile_number}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(member.mobile_number);
                      toast.success('Mobile number copied!');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm text-gray-600">Password</Label>
                <div className="p-3 bg-gray-50 rounded border flex justify-between items-center">
                  <p className="font-mono font-medium">{member.mobile_number}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(member.mobile_number);
                      toast.success('Password copied!');
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Note: Default password is same as mobile number
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-sm text-gray-600">Referral Code</Label>
                <div className="p-3 bg-gray-50 rounded border">
                  <p className="font-mono font-medium">{member.referral_code}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={() => setShowCredentialsDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ Remove Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium mb-2">Warning: This action cannot be undone!</p>
              <p className="text-sm text-red-700">
                Removing this member will permanently delete:
              </p>
              <ul className="text-sm text-red-700 list-disc list-inside mt-2 space-y-1">
                <li>Member account and profile</li>
                <li>All work assignments and submissions</li>
                <li>All transactions and payment history</li>
                <li>Daily work reports</li>
                <li>Withdrawal requests</li>
                <li>Member will be removed from referrer's downline</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Member Details:</p>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm"><strong>Name:</strong> {member.full_name}</p>
                <p className="text-sm"><strong>Mobile:</strong> {member.mobile_number}</p>
                <p className="text-sm"><strong>Referral Code:</strong> {member.referral_code}</p>
                <p className="text-sm"><strong>Balance:</strong> ₹{member.current_balance || 0}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowRemoveDialog(false)}
                className="flex-1"
                disabled={removing}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={removeMember} 
                disabled={removing}
                className="flex-1"
              >
                {removing ? 'Removing...' : 'Yes, Remove Member'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Installment Payment Dialog */}
      <Dialog open={showInstallmentDialog} onOpenChange={setShowInstallmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Installment Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="installmentNumber">Installment Number (1-10)</Label>
              <Input
                id="installmentNumber"
                type="number"
                min="1"
                max="10"
                value={installmentNumber}
                onChange={(e) => setInstallmentNumber(e.target.value)}
                placeholder="Enter installment number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="installmentAmount">Amount (₹)</Label>
              <Input
                id="installmentAmount"
                type="number"
                step="0.01"
                value={installmentAmount}
                onChange={(e) => setInstallmentAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            <div className="text-sm text-gray-600">
              <p>Current total: ₹{totalPaid.toFixed(2)}</p>
              <p>Remaining: ₹{(registrationFee - totalPaid).toFixed(2)}</p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowInstallmentDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={recordInstallment} 
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
      
      const response = await axios.post(`${API}/assignments`, submitData);
      
      toast.success(response.data.message || 'Work assignment created successfully');
      setOpen(false);
      setFormData({ title: '', description: '', amount: '', deadline: new Date(), assigned_to: '' });
      setFile(null);
      onWorkCreated();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create work assignment');
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
                {members.filter(member => member.can_work).map((member) => (
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
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-medium">{assignment.title}</h3>
            <p className="text-sm text-gray-600">{assignment.description}</p>
            <p className="text-xs text-gray-500">Deadline: {new Date(assignment.deadline).toLocaleDateString()}</p>
            {assignment.member_name && (
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded px-2 py-1 inline-block">
                <p className="text-xs text-blue-800">
                  <span className="font-medium">Assigned to:</span> {assignment.member_name} ({assignment.member_mobile})
                </p>
              </div>
            )}
            {!assignment.member_name && assignment.assigned_to && (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded px-2 py-1 inline-block">
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Assigned to:</span> Member ID: {assignment.assigned_to}
                </p>
              </div>
            )}
            {!assignment.assigned_to && (
              <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 inline-block">
                <p className="text-xs text-yellow-800">
                  <span className="font-medium">Status:</span> Unassigned
                </p>
              </div>
            )}
          </div>
          <div className="text-right ml-4">
            <p className="font-bold text-green-600">₹{assignment.amount}</p>
            <Badge>{assignment.is_active ? 'Active' : 'Inactive'}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminSubmissionCard({ submission, onUpdate }) {
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approving, setApproving] = useState(false);

  const totalAmount = submission.assignment_amount || 0;

  const handleDownload = () => {
    if (submission.file_data && submission.file_name) {
      try {
        // Get file extension to determine MIME type
        const extension = submission.file_name.split('.').pop().toLowerCase();
        
        // Map extensions to MIME types
        const mimeTypes = {
          // Images
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'bmp': 'image/bmp',
          'svg': 'image/svg+xml',
          
          // Documents
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          
          // Spreadsheets
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'csv': 'text/csv',
          
          // Presentations
          'ppt': 'application/vnd.ms-powerpoint',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          
          // Videos
          'mp4': 'video/mp4',
          'avi': 'video/x-msvideo',
          'mov': 'video/quicktime',
          'wmv': 'video/x-ms-wmv',
          'flv': 'video/x-flv',
          'webm': 'video/webm',
          'mkv': 'video/x-matroska',
          
          // Audio
          'mp3': 'audio/mpeg',
          'wav': 'audio/wav',
          'ogg': 'audio/ogg',
          
          // Archives
          'zip': 'application/zip',
          'rar': 'application/x-rar-compressed',
          
          // Text
          'txt': 'text/plain',
          'json': 'application/json',
          'xml': 'application/xml'
        };
        
        const mimeType = mimeTypes[extension] || 'application/octet-stream';
        
        // If file_data already has data: prefix, use it directly
        let downloadData = submission.file_data;
        
        // If it doesn't have data: prefix, add it with correct MIME type
        if (!downloadData.startsWith('data:')) {
          downloadData = `data:${mimeType};base64,${downloadData}`;
        }
        
        // Create download link
        const link = document.createElement('a');
        link.href = downloadData;
        link.download = submission.file_name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        toast.success(`${submission.file_name} downloaded successfully`);
      } catch (error) {
        console.error('Download error:', error);
        toast.error('Failed to download file. Please try again.');
      }
    } else {
      toast.error('No file attached to this submission');
    }
  };

  const handleReject = async () => {
    try {
      const formData = new FormData();
      formData.append('action', 'reject');
      
      await axios.post(`${API}/submissions/${submission.id}/review`, formData);
      toast.success('Submission rejected');
      onUpdate();
    } catch (error) {
      toast.error('Failed to reject submission');
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const formData = new FormData();
      formData.append('action', 'approve');
      formData.append('payment_destination', 'wallet'); // Always to wallet
      
      await axios.post(`${API}/submissions/${submission.id}/review`, formData);
      toast.success('Submission approved and amount credited to wallet!');
      setShowApproveDialog(false);
      onUpdate();
    } catch (error) {
      toast.error('Failed to approve submission');
    } finally {
      setApproving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
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
          
          {/* Download Button with File Type Icon */}
          {submission.file_name && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {(() => {
                  const extension = submission.file_name.split('.').pop().toLowerCase();
                  // Return appropriate icon based on file type
                  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
                    return <span className="text-2xl">🖼️</span>;
                  } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
                    return <span className="text-2xl">🎥</span>;
                  } else if (['pdf'].includes(extension)) {
                    return <span className="text-2xl">📄</span>;
                  } else if (['doc', 'docx'].includes(extension)) {
                    return <span className="text-2xl">📝</span>;
                  } else if (['xls', 'xlsx', 'csv'].includes(extension)) {
                    return <span className="text-2xl">📊</span>;
                  } else if (['ppt', 'pptx'].includes(extension)) {
                    return <span className="text-2xl">📽️</span>;
                  } else if (['zip', 'rar'].includes(extension)) {
                    return <span className="text-2xl">📦</span>;
                  } else {
                    return <FileText className="w-5 h-5 text-blue-600" />;
                  }
                })()}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-blue-800 block truncate">{submission.file_name}</span>
                  <span className="text-xs text-blue-600">
                    {submission.file_name.split('.').pop().toUpperCase()} File
                  </span>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleDownload} className="ml-2 flex-shrink-0">
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </div>
          )}
          
          <div className="flex space-x-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setShowApproveDialog(true)}>
              <CheckCircle className="w-4 h-4 mr-1" />
              Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={handleReject}>
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Approve Dialog with Payment Destination */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approve Submission - Payment Allocation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-1">
                Submission: {submission.assignment_title}
              </p>
              <p className="text-lg text-blue-900 font-bold">
                Amount: ₹{totalAmount}
              </p>
              <p className="text-sm text-blue-700">
                Member: {submission.user_name}
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                ✅ This amount will be credited to member's <span className="font-bold">Wallet</span> (withdrawable balance)
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowApproveDialog(false)}
                className="flex-1"
                disabled={approving}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {approving ? 'Approving...' : `Approve ₹${totalAmount}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AdminWithdrawalCard({ request, onUpdate }) {
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [paymentMode, setPaymentMode] = useState('full'); // 'full' or 'split'
  const [withdrawalAmount, setWithdrawalAmount] = useState(request.amount);
  const [contributionAmount, setContributionAmount] = useState(0);
  const [processing, setProcessing] = useState(false);

  const totalAmount = request.amount;

  const handleProcess = async (action) => {
    if (action === 'approve') {
      // Show split dialog instead of direct approval
      setShowSplitDialog(true);
      return;
    }

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

  const handleApproveWithSplit = async () => {
    if (paymentMode === 'split') {
      const total = parseFloat(withdrawalAmount) + parseFloat(contributionAmount);
      if (Math.abs(total - totalAmount) > 0.01) {
        toast.error(`Split amounts must equal total: ₹${totalAmount}`);
        return;
      }
      if (withdrawalAmount < 0 || contributionAmount < 0) {
        toast.error('Amounts cannot be negative');
        return;
      }
    }

    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('action', 'approve');
      
      if (paymentMode === 'full') {
        formData.append('payment_destination', 'withdrawal');
      } else {
        formData.append('payment_destination', 'split');
        formData.append('withdrawal_amount', withdrawalAmount.toString());
        formData.append('contribution_amount', contributionAmount.toString());
      }
      
      await axios.post(`${API}/withdrawal/${request.id}/process`, formData);
      toast.success('Withdrawal approved!');
      setShowSplitDialog(false);
      onUpdate();
    } catch (error) {
      toast.error('Failed to approve withdrawal');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
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
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleProcess('approve')} className="bg-green-600 hover:bg-green-700">
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

      {/* Split Payment Dialog */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Withdrawal - ₹{totalAmount}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 font-medium">
                Member: {request.user_name}
              </p>
              <p className="text-lg text-blue-900 font-bold">
                Requested: ₹{totalAmount}
              </p>
            </div>

            {/* Payment Mode Selection */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Approve As:</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setPaymentMode('full');
                    setWithdrawalAmount(totalAmount);
                    setContributionAmount(0);
                  }}
                  className={`p-3 border-2 rounded-lg transition-all ${
                    paymentMode === 'full' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">Full Withdrawal</div>
                  <div className="text-xs text-gray-600">₹{totalAmount}</div>
                </button>
                <button
                  onClick={() => {
                    setPaymentMode('split');
                    setWithdrawalAmount(totalAmount / 2);
                    setContributionAmount(totalAmount / 2);
                  }}
                  className={`p-3 border-2 rounded-lg transition-all ${
                    paymentMode === 'split' 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">Split Payment</div>
                  <div className="text-xs text-gray-600">Partial + Fee</div>
                </button>
              </div>
            </div>

            {/* Split Payment Options */}
            {paymentMode === 'split' && (
              <div className="space-y-3 border-t pt-3">
                <Label className="text-base font-medium">Split Amounts:</Label>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>💸 Actual Withdrawal (to member's UPI)</Label>
                    <Input
                      type="number"
                      value={withdrawalAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setWithdrawalAmount(val);
                        setContributionAmount(totalAmount - val);
                      }}
                      step="0.01"
                      min="0"
                      max={totalAmount}
                      className="text-lg font-semibold"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>🎯 To My Contribution (registration fee)</Label>
                    <Input
                      type="number"
                      value={contributionAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setContributionAmount(val);
                        setWithdrawalAmount(totalAmount - val);
                      }}
                      step="0.01"
                      min="0"
                      max={totalAmount}
                      className="text-lg font-semibold"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm font-medium">
                    Total: ₹{(parseFloat(withdrawalAmount) + parseFloat(contributionAmount)).toFixed(2)} / ₹{totalAmount}
                  </p>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800 font-medium mb-1">Approval Summary:</p>
              {paymentMode === 'full' ? (
                <p className="text-sm text-green-700">
                  ✅ Full amount ₹{totalAmount} will be withdrawn to member's UPI
                </p>
              ) : (
                <div className="text-sm text-green-700">
                  <p>✅ Withdrawal: ₹{withdrawalAmount} to UPI</p>
                  <p>✅ Contribution: ₹{contributionAmount} to registration fee</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowSplitDialog(false)}
                className="flex-1"
                disabled={processing}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleApproveWithSplit}
                disabled={processing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {processing ? 'Processing...' : 'Approve'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AdminSettingsCard({ settings, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(settings);

  const handleSave = async () => {
    try {
      const submitData = new FormData();
      
      // Add all form fields except video_file
      Object.entries(formData).forEach(([key, value]) => {
        if (key !== 'video_file' && value !== undefined && value !== null) {
          submitData.append(key, value);
        }
      });
      
      // Handle video file separately if it exists
      if (formData.advertisement_video_type === 'file' && formData.video_file) {
        submitData.append('video_file', formData.video_file);
      }
      
      await axios.post(`${API}/admin/settings`, submitData);
      toast.success('Settings updated successfully');
      setEditing(false);
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update settings');
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
            <Label>Admin UPI Address (for member payments)</Label>
            {editing ? (
              <Input
                type="text"
                value={formData.admin_upi || ''}
                onChange={(e) => setFormData({...formData, admin_upi: e.target.value})}
                placeholder="e.g., admin@paytm or 9999999999@upi"
              />
            ) : (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded border mt-1">
                <p className="font-mono font-medium">{settings.admin_upi || 'Not set'}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(settings.admin_upi || '');
                    toast.success('UPI address copied!');
                  }}
                >
                  Copy
                </Button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Members will see this UPI address to deposit their registration fee
            </p>
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
          
          {/* Advertisement Video Section */}
          <div className="border-t pt-4">
            <Label className="text-base font-medium">Advertisement Video</Label>
            <p className="text-xs text-gray-500 mb-3">Upload video or provide YouTube/external URL. Max 20MB for uploaded videos.</p>
            
            {editing ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.advertisement_video_type === 'url' ? 'default' : 'outline'}
                    onClick={() => setFormData({...formData, advertisement_video_type: 'url'})}
                  >
                    Video URL
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.advertisement_video_type === 'file' ? 'default' : 'outline'}
                    onClick={() => setFormData({...formData, advertisement_video_type: 'file'})}
                  >
                    Upload Video
                  </Button>
                </div>
                
                {formData.advertisement_video_type === 'url' ? (
                  <Input
                    type="text"
                    placeholder="Enter YouTube or video URL"
                    value={formData.advertisement_video_url || ''}
                    onChange={(e) => setFormData({...formData, advertisement_video_url: e.target.value})}
                  />
                ) : (
                  <Input
                    type="file"
                    accept="video/mp4,video/avi,video/mov,video/webm"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        // Store file in formData for later upload
                        setFormData({...formData, video_file: file});
                      }
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="text-sm">
                {settings.advertisement_video_type === 'url' ? (
                  <p className="text-gray-600">
                    {settings.advertisement_video_url ? (
                      <span>URL: <a href={settings.advertisement_video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{settings.advertisement_video_url}</a></span>
                    ) : (
                      <span>No video URL set</span>
                    )}
                  </p>
                ) : (
                  <p className="text-gray-600">
                    {settings.advertisement_video_name ? `Uploaded: ${settings.advertisement_video_name}` : 'No video uploaded'}
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Scrolling Text Section */}
          <div className="border-t pt-4">
            <Label className="text-base font-medium">Scrolling Text Banner</Label>
            <p className="text-xs text-gray-500 mb-2">Text shown at bottom of member screens</p>
            
            {editing ? (
              <Input
                type="text"
                placeholder="Enter scrolling text"
                value={formData.scrolling_text || ''}
                onChange={(e) => setFormData({...formData, scrolling_text: e.target.value})}
              />
            ) : (
              <div className="p-3 bg-gradient-to-r from-blue-100 to-purple-100 rounded border border-blue-200">
                <p className="text-sm font-medium text-gray-800">{settings.scrolling_text || 'You are in the best platform where earning is easy'}</p>
              </div>
            )}
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

// Daily Work Report Dialog Component
function DailyWorkReportDialog({ onReportSubmitted }) {
  const [open, setOpen] = useState(false);
  const [reportFormat, setReportFormat] = useState('tabular'); // 'tabular' or 'paragraph'
  
  // Tabular format fields
  const [date, setDate] = useState(new Date());
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  
  // Paragraph format fields
  const [paragraphName, setParagraphName] = useState('');
  const [paragraphUpdate, setParagraphUpdate] = useState('');
  
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitTabular = async () => {
    if (!className || !subject || !details) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new URLSearchParams();
      formData.append('date', format(date, 'yyyy-MM-dd'));
      formData.append('class_name', className);
      formData.append('subject', subject);
      formData.append('details', details);

      await axios.post(`${API}/daily-work-report`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      toast.success('Daily work report submitted successfully');
      setOpen(false);
      setClassName('');
      setSubject('');
      setDetails('');
      if (onReportSubmitted) onReportSubmitted();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitParagraph = async () => {
    if (!paragraphName || !paragraphUpdate) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new URLSearchParams();
      formData.append('date', format(date, 'yyyy-MM-dd'));
      formData.append('name', paragraphName);
      formData.append('update', paragraphUpdate);

      await axios.post(`${API}/daily-work-report-paragraph`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      toast.success('Daily work report submitted successfully');
      setOpen(false);
      setParagraphName('');
      setParagraphUpdate('');
      if (onReportSubmitted) onReportSubmitted();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FileText className="w-4 h-4 mr-2" />
          Submit Daily Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Daily Work Report</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {/* Format Selection */}
          <div className="mb-6">
            <Label className="mb-2 block">Select Report Format:</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setReportFormat('tabular')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  reportFormat === 'tabular' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium mb-1">Tabular Format</div>
                <div className="text-xs text-gray-600">Class, Subject & Details</div>
              </button>
              <button
                onClick={() => setReportFormat('paragraph')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  reportFormat === 'paragraph' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium mb-1">Paragraph Format</div>
                <div className="text-xs text-gray-600">Name & Today's Update</div>
              </button>
            </div>
          </div>

          {/* Date Picker - Common for both formats */}
          <div className="space-y-2 mb-4">
            <Label htmlFor="date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tabular Format Fields */}
          {reportFormat === 'tabular' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="className">Class</Label>
                <Input
                  id="className"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g., Grade 10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="details">Work Details</Label>
                <Textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Describe the work completed today..."
                  rows={4}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmitTabular} disabled={submitting} className="flex-1">
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </Button>
              </div>
            </div>
          )}

          {/* Paragraph Format Fields */}
          {reportFormat === 'paragraph' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paragraphName">Your Name</Label>
                <Input
                  id="paragraphName"
                  value={paragraphName}
                  onChange={(e) => setParagraphName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paragraphUpdate">Today's Update</Label>
                <Textarea
                  id="paragraphUpdate"
                  value={paragraphUpdate}
                  onChange={(e) => setParagraphUpdate(e.target.value)}
                  placeholder="Write your daily work update in paragraph format..."
                  rows={8}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  Tip: Include what you worked on, tasks completed, and any important notes
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmitParagraph} disabled={submitting} className="flex-1">
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Daily Work Reports List Component
function DailyWorkReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${API}/daily-work-reports`);
      setReports(response.data);
    } catch (error) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading reports...</div>;
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          No daily work reports submitted yet
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <Card key={report.id}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{report.date}</Badge>
                  <span className="font-medium">{report.class_name}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Subject:</strong> {report.subject}
                </div>
                <div className="text-sm text-gray-700 mt-2">
                  <strong>Details:</strong> {report.details}
                </div>
                {report.user_name && (
                  <div className="text-xs text-gray-500 mt-2">
                    Submitted by: {report.user_name} ({report.user_mobile})
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
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
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    const mustChange = localStorage.getItem('must_change_password') === 'true';
    setMustChangePassword(mustChange);
  }, [user]);

  const handlePasswordChanged = () => {
    setMustChangePassword(false);
  };

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

  // Show force change password dialog if required
  if (mustChangePassword) {
    return (
      <>
        <ForceChangePasswordDialog 
          open={mustChangePassword} 
          onPasswordChanged={handlePasswordChanged}
        />
        {/* Show a blocking overlay */}
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
          <Card className="max-w-md p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Password Change Required</h2>
            <p className="text-gray-600">Please change your password to continue.</p>
          </Card>
        </div>
      </>
    );
  }

  return user.role === 'admin' ? <AdminDashboard /> : <MemberDashboard />;
}

export default App;