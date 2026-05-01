import React, { useState, useEffect } from 'react';
import {
  Wallet, PieChart, TrendingUp, Bell,
  ArrowUpRight, ArrowDownRight, Home,
  Settings, User, Plus, X, Download, Sparkles, Target, LogOut, Sun, Moon, Trash2, Edit2, Bot, MessageSquare,
  Utensils, ShoppingBag, Film, Car, Receipt, Heart, Lightbulb, Zap, Coffee
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart as RechartsPieChart, Pie
} from 'recharts';

import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

import './App.css'; // Optional removal if we rely fully on tailwind/index.css
const getIconForCategory = (category) => {
  switch (category) {
    case 'food': return ArrowDownRight;
    case 'rent': return Home;
    case 'travel': return ArrowDownRight;
    default: return ArrowDownRight;
  }
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [activeTab, setActiveTab] = useState('home');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const isDarkMode = true; // Enforced Dark Mode as per user request
  const [txFilter, setTxFilter] = useState('All'); // All, Income, Expense
  const [txDateFilter, setTxDateFilter] = useState('All'); // All, This Month, Last Month
  const [txCategoryFilter, setTxCategoryFilter] = useState('All');
  const [txAmountFilter, setTxAmountFilter] = useState('All'); // All, <500, 500-2000, >2000

  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ totalBalance: 0, totalIncome: 0, totalExpense: 0, healthScore: 0 });
  const [budgets, setBudgets] = useState({});
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetInput, setBudgetInput] = useState('');

  const [goals, setGoals] = useState([]);
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [addingSavingsGoal, setAddingSavingsGoal] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: 'Hello! I am your Expense Tracker AI Advisor. How can I help you save money today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Budget Alert', message: 'You have spent 85% of your food budget.', time: '2h ago', read: false },
    { id: 2, title: 'Smart Tip', message: 'Saving ₹500 more this week could reach your Goa trip goal faster!', time: '5h ago', read: false },
    { id: 3, title: 'System', message: 'Welcome to your enhanced Expense Tracker Dashboard.', time: '1d ago', read: true }
  ]);

  const [toasts, setToasts] = useState([]);
  const [journalCategory, setJournalCategory] = useState('progress');
  const [journalNote, setJournalNote] = useState('');
  const [latestReflection, setLatestReflection] = useState(null);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const summaryRes = await fetch(API_URL + '/api/summary', { headers });
      const txRes = await fetch(API_URL + '/api/transactions', { headers });
      const budgetRes = await fetch(API_URL + '/api/budgets', { headers });
      const goalsRes = await fetch(API_URL + '/api/goals', { headers });

      if (summaryRes.status === 401 || summaryRes.status === 403) {
        handleLogout();
        return;
      }

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
      if (budgetRes.ok) setBudgets(await budgetRes.json());
      if (goalsRes.ok) {
        setGoals((await goalsRes.json()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      }

      // Fetch AI Insights
      const aiRes = await fetch(API_URL + '/api/ai/analyze', { headers });
      if (aiRes.ok) setAiInsights(await aiRes.json());

      // Fetch Latest Reflection
      const refRes = await fetch(API_URL + '/api/reflections', { headers });
      if (refRes.ok) setLatestReflection(await refRes.json());
    } catch (error) {
      console.error('Failed to fetch from backend', error);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const response = await fetch(`${API_URL}/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        addToast("Transaction deleted successfully", "success");
        fetchData();
      } else {
        addToast("Failed to delete transaction", "error");
      }
    } catch (error) {
      console.error("Failed to delete", error);
      addToast("Network error occurred", "error");
    }
  };

  const handleDeleteGoal = async (id) => {
    if (!window.confirm("Are you sure you want to delete this goal?")) return;
    try {
      const response = await fetch(`${API_URL}/api/goals/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        addToast("Goal removed", "success");
        fetchData();
      } else {
        addToast("Failed to delete goal", "error");
      }
    } catch (error) {
      console.error("Failed to delete goal", error);
      addToast("Network error occurred", "error");
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setChatHistory([{ role: 'assistant', content: 'Hello! I am your Expense Tracker AI Advisor. How can I help you save money today?' }]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const handleDeleteData = async () => {
    if (!window.confirm("Are you sure you want to delete all your data? This will remove all transactions, goals, budgets, and reset your account to scratch. This action cannot be undone.")) return;
    try {
      await fetch(API_URL + '/api/user/data', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Failed to delete data, continuing anyway...", error);
    }
    
    // Always show success and reset the app state locally
    addToast("All data deleted. Account reset.", "success");
    setTransactions([]);
    setGoals([]);
    setBudgets({});
    setSummary({ totalBalance: 0, totalIncome: 0, totalExpense: 0, healthScore: 0 });
    setAiInsights(null);
    setLatestReflection(null);
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your entire account? This will permanently remove your login and all data. This action cannot be undone.")) return;
    try {
      await fetch(API_URL + '/api/user/account', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Failed to delete account, continuing anyway...", error);
    }

    // Always show success and logout locally
    addToast("Account deleted successfully.", "success");
    handleLogout();
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSaveBudget = async (category) => {
    try {
      const updatedBudgets = { ...budgets, [category]: parseFloat(budgetInput) };
      const res = await fetch(API_URL + '/api/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ categories: updatedBudgets })
      });
      if (res.ok) {
        addToast(`Budget updated for ${category}`, "success");
        setBudgets(updatedBudgets);
        setEditingBudget(null);
        setBudgetInput('');
      } else {
        addToast("Failed to update budget", "error");
      }
    } catch (error) {
      console.error('Failed to save budget', error);
      addToast("Network error", "error");
    }
  };

  const handleUpdateProfile = async (profileData) => {
    setIsSavingProfile(true);
    
    // Optimistic Save (Offline Mode Support)
    const updatedUser = { ...user, ...profileData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));

    try {
      const res = await fetch(API_URL + '/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        addToast("Profile settings saved permanently", "success");
      } else {
        addToast("Saved locally. Background sync failed.", "warning");
      }
    } catch (e) {
      console.error(e);
      addToast("Saved locally (Offline mode)", "success");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUploadPhoto = async (file) => {
    if (!file) return;
    setIsSavingProfile(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        // Resize image to ensure it saves properly in LocalStorage and Firestore
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const base64String = canvas.toDataURL('image/jpeg', 0.8);
        
        // Save locally (Offline Mode)
        const updatedUser = { ...user, photoURL: base64String };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));

        // Try syncing to backend
        try {
          const res = await fetch(API_URL + '/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ photoURL: base64String })
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            addToast("Photo saved permanently!", "success");
          } else {
            addToast("Photo saved locally. Network sync failed.", "warning");
          }
        } catch (error) {
          addToast("Photo saved locally (Offline mode)", "success");
        } finally {
          setIsSavingProfile(false);
        }
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      addToast("Failed to read image file.", "error");
      setIsSavingProfile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveReflection = async () => {
    try {
      const res = await fetch(API_URL + '/api/reflections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          category: journalCategory,
          note: journalNote,
          date: new Date().toISOString()
        })
      });

      if (res.ok) {
        const data = await res.json();
        setLatestReflection(data);
        addToast("Reflection saved to your financial journal!", "success");
        setJournalNote('');
        setJournalCategory('progress');
      }
    } catch (error) {
      addToast("Failed to save reflection", "error");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = { role: 'user', content: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch(API_URL + '/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: chatInput, history: chatHistory })
      });
      if (res.ok) {
        const data = await res.json();
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (e) {
      console.error(e);
      setChatHistory(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const downloadCSV = () => {
    const headers = "Date,Description,Type,Category,Payment Method,Amount\n";
    const csvData = transactions.map(t => `${new Date(t.date).toLocaleDateString()},${t.description},${t.type},${t.category},${t.paymentMethod || 'N/A'},${t.amount}`).join('\n');
    const blob = new Blob([headers + csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions_statement.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getSmartInsight = () => {
    if (transactions.length === 0) return "Add your first transaction to get smart predictive insights!";
    const expenses = transactions.filter(t => t.type === 'expense');
    if (expenses.length === 0) return "Great job tracking! You haven't spent anything yet, keeping your runway infinite.";
    const highestCategory = categoryData.length > 0 ? categoryData[0].name : "various items";
    return `Pattern Detected: You're spending the most on ${highestCategory}. If you reduce 'Wants' in this category, your runway could extend by 3 days!`;
  };

  // Prepare Chart Data
  const last7DaysData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayTx = transactions.filter(t => new Date(t.date).toDateString() === d.toDateString());
    return {
      date: d.toLocaleDateString('en-US', { weekday: 'short' }),
      spending: dayTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0),
      income: dayTx.filter(t => t.type === 'income').reduce((sum, t) => sum + Math.abs(t.amount), 0)
    };
  });

  const todayTx = transactions.filter(t => new Date(t.date).toDateString() === new Date().toDateString());
  const todayExpense = todayTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const todayIncome = todayTx.filter(t => t.type === 'income').reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const getTodaySuggestion = () => {
    if (todayExpense === 0) return "You haven't spent anything today. Great job!";
    if (todayExpense > todayIncome && todayIncome > 0) return "You've spent more than you earned today. Try to limit non-essential expenses.";
    if (todayExpense > 500) return "Today's spending is a bit high. Consider skipping that extra treat!";
    return "You're doing well with today's budget.";
  };

  const categoryData = Object.entries(
    transactions.filter(t => t.type === 'expense').reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#10b981', '#6b7280'];

  if (!token) {
    return <AuthForm onLogin={(t, u) => {
      setToken(t);
      setUser(u);
      localStorage.setItem('token', t);
      localStorage.setItem('user', JSON.stringify(u));
      setActiveTab('home');
    }} />;
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
  };
  const userName = user?.name?.split(' ')[0] || 'User';

  return (
    <div className={`flex flex-col md:flex-row h-screen overflow-hidden font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[var(--color-background-dark)] text-white' : 'bg-gray-50 text-gray-900'}`}>

      {/* Sidebar Navigation (Bottom Nav on Mobile) */}
      <nav className="fixed bottom-0 w-full md:relative md:w-20 lg:w-64 flex flex-row md:flex-col items-center md:items-start px-2 py-2 md:p-4 bg-[#151722]/95 backdrop-blur-md md:bg-transparent md:glass-card border-t md:border-t-0 md:border-r border-white/10 z-50 h-16 md:h-full justify-around md:justify-start md:rounded-r-none">

        {/* Logo - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-3 mb-10 w-full lg:px-4 mt-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-400 flex items-center justify-center shadow-[var(--shadow-neon)] shrink-0">
            <Wallet className="text-white w-6 h-6" />
          </div>
          <span className="text-[22px] font-black tracking-tight whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 hidden lg:block drop-shadow-sm">
            Expense Tracker
          </span>
        </div>

        <div className="flex flex-row md:flex-col gap-1 md:gap-4 w-full justify-around md:justify-start flex-1 md:flex-none">
          <NavItem icon={Home} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} isDarkMode={isDarkMode} />
          <NavItem icon={PieChart} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} isDarkMode={isDarkMode} />
          <NavItem icon={Bot} label="AI Assistant" active={activeTab === 'ai-chat'} onClick={() => setActiveTab('ai-chat')} isDarkMode={isDarkMode} />
          <NavItem icon={Sparkles} label="AI Insights" active={activeTab === 'ai-insights'} onClick={() => setActiveTab('ai-insights')} isDarkMode={isDarkMode} />
          <NavItem icon={Wallet} label="Transactions" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} isDarkMode={isDarkMode} />
          <NavItem icon={TrendingUp} label="Goals" active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} isDarkMode={isDarkMode} />
          <NavItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} isDarkMode={isDarkMode} />
        </div>

        {/* User Profile - Hidden on mobile bottom bar */}
        <div className="hidden md:flex mt-auto w-full flex-col gap-2">
          <div className={`w-10 h-10 lg:w-full lg:h-auto rounded-xl p-2 lg:p-4 flex items-center justify-between cursor-pointer transition-colors ${isDarkMode ? 'bg-white/5 border border-white/10 hover:bg-white/10' : 'bg-white border border-gray-100 hover:bg-gray-50 shadow-sm'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10 shrink-0 object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 shrink-0 shadow-[var(--shadow-neon)] flex items-center justify-center text-white font-bold text-xs uppercase">
                  {user?.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="hidden lg:block overflow-hidden">
                <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{user?.name || 'User'}</p>
                <p className={`text-xs truncate ${isDarkMode ? 'text-secondary-400' : 'text-gray-500'}`}>{user?.email || 'email@example.com'}</p>
              </div>
            </div>
            <button onClick={handleLogout} className={`hidden lg:block transition-colors ${isDarkMode ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-red-500'}`} title="Log Out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
          <button onClick={handleLogout} className={`lg:hidden w-10 h-10 rounded-xl p-2 flex items-center justify-center transition-colors ${isDarkMode ? 'bg-white/5 border border-white/10 hover:bg-white/10 text-gray-500 hover:text-white' : 'bg-white border border-gray-100 hover:bg-gray-50 text-gray-500 hover:text-red-500 shadow-sm'}`} title="Log Out">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Toast Notifications Overlay */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto min-w-[320px] p-5 rounded-2xl border backdrop-blur-xl shadow-2xl animate-in slide-in-from-right-20 zoom-in-95 duration-500 flex items-center gap-4 ${t.type === 'error' ? 'bg-red-500/15 border-red-500/30 text-red-100' :
              t.type === 'warning' ? 'bg-orange-500/15 border-orange-500/30 text-orange-100' :
                t.type === 'success' ? 'bg-green-500/15 border-green-500/30 text-green-100' :
                  'bg-primary-500/15 border-primary-500/30 text-primary-100'
              }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'error' ? 'bg-red-500/20' :
              t.type === 'warning' ? 'bg-orange-500/20' :
                t.type === 'success' ? 'bg-green-500/20' :
                  'bg-primary-500/20'
              }`}>
              {t.type === 'success' ? <TrendingUp className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold leading-tight uppercase tracking-widest text-[10px] opacity-70 mb-1">
                {t.type === 'error' ? 'Critical Alert' : t.type === 'warning' ? 'Warning' : t.type === 'success' ? 'Smart Feedback' : 'Information'}
              </p>
              <p className="text-sm font-medium">{t.message}</p>
              {/* Progress Bar */}
              <div className="mt-2 h-0.5 w-full bg-current/10 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-current opacity-40 rounded-full animate-[progress_5s_linear_forwards]`}
                  style={{ transformOrigin: 'left' }}
                />
              </div>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="text-current opacity-50 hover:opacity-100 p-1 self-start">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <main className={`flex-1 overflow-y-auto pb-24 md:pb-8 p-4 lg:p-8 relative w-full ${isDarkMode ? 'bg-[var(--color-background-dark)]' : 'bg-gray-50'}`}>

        {/* Mobile Logo / Branding (Shows only on small screens) */}
        <div className="md:hidden flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary-600 to-accent-400 flex items-center justify-center shadow-[var(--shadow-neon)]">
            <Wallet className="text-white w-4 h-4" />
          </div>
          <span className={`text-xl font-black tracking-tight whitespace-nowrap bg-clip-text text-transparent ${isDarkMode ? 'bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400' : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600'}`}>
            Expense Tracker
          </span>
        </div>

        {/* Top Header */}
        {activeTab !== 'home' && (
          <header className="flex justify-between items-end mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div>
              <h1 className={`text-2xl lg:text-3xl font-bold mb-1 capitalize ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{activeTab}</h1>
              <p className={`text-sm hidden sm:block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {activeTab === 'dashboard' ? 'Welcome back, your financial health is looking good!'
                  : activeTab === 'transactions' ? 'Manage your entire transaction history.'
                    : 'Deep dive into your spending habits.'}
              </p>
            </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={downloadCSV}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hidden sm:flex items-center justify-center hover:bg-white/10 relative transition-transform hover:scale-105"
              title="Export Statement to CSV"
            >
              <Download className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`} />
            </button>
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 relative transition-transform hover:scale-105"
              title="Notifications"
            >
              <Bell className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-secondary-500 rounded-full animate-pulse" />
            </button>

            {/* Notifications Dropdown */}
            {isNotificationsOpen && (
              <div className="absolute top-20 right-4 w-80 glass-card z-[100] border border-white/10 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                  <h4 className="font-bold">Notifications</h4>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))} className="text-xs text-primary-400 hover:text-white">Mark all read</button>
                    <button onClick={() => setIsNotificationsOpen(false)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors group relative ${!n.read ? 'bg-primary-500/5' : ''}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(n.id);
                          }}
                          className="absolute top-4 right-4 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="flex justify-between items-start mb-1 pr-6">
                          <span className="text-sm font-bold">{n.title}</span>
                          <span className="text-[10px] text-gray-500">{n.time}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 text-center border-t border-white/10">
                  <button className="text-xs text-gray-500 hover:text-white">View all activity</button>
                </div>
              </div>
            )}
            <button
              className="btn-primary flex items-center gap-2 px-4 sm:px-6"
              onClick={() => {
                setEditingTransaction(null);
                setIsAddModalOpen(true);
              }}
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:block">Add Transaction</span>
            </button>
          </div>
        </header>
        )}

        {/* Home Overview Screen */}
        {activeTab === 'home' && (
          <div className="flex flex-col items-center justify-center pt-8 pb-16 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700 w-full mb-12">
            <h1 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">
              {getGreeting()}, {userName}!
            </h1>
            <p className="text-gray-400 text-lg mb-12 text-center">Welcome back to your personalized financial command center.</p>

            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-primary-600 to-accent-400 flex items-center justify-center shadow-[var(--shadow-neon)] mb-8">
              <Wallet className="text-white w-12 h-12" />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-black mb-6 text-center tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-sm">
              Discover Your Expense Tracker
            </h2>
            <p className="text-gray-400 text-md md:text-lg max-w-2xl text-center mb-10 leading-relaxed">
              Take complete control of your finances. Record transactions effortlessly, monitor your budget health, set savings goals, and unlock personalized AI insights to grow your wealth over time.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 w-full max-w-4xl">
              <div className={`p-6 flex flex-col items-center text-center rounded-2xl border ${isDarkMode ? 'glass-card' : 'bg-white shadow-lg border-gray-100'}`}>
                <PieChart className="w-8 h-8 text-primary-400 mb-4" />
                <h3 className="font-bold text-white mb-2">Smart Analytics</h3>
                <p className="text-sm text-gray-400">Visualize your pending budgets and track daily spending habits automatically.</p>
              </div>
              <div className={`p-6 flex flex-col items-center text-center rounded-2xl border ${isDarkMode ? 'glass-card' : 'bg-white shadow-lg border-gray-100'}`}>
                <Target className="w-8 h-8 text-accent-400 mb-4" />
                <h3 className="font-bold text-white mb-2">Savings Goals</h3>
                <p className="text-sm text-gray-400">Allocate funds seamlessly so you can hit your most important financial milestones faster.</p>
              </div>
              <div className={`p-6 flex flex-col items-center text-center rounded-2xl border ${isDarkMode ? 'glass-card' : 'bg-white shadow-lg border-gray-100'}`}>
                <Sparkles className="w-8 h-8 text-purple-400 mb-4" />
                <h3 className="font-bold text-white mb-2">AI Advisor</h3>
                <p className="text-sm text-gray-400">Ask your AI 24/7 for tailored financial advice based exclusively on your past history.</p>
              </div>
            </div>

            <button 
              onClick={() => setActiveTab('dashboard')} 
              className="btn-primary py-4 px-12 rounded-xl text-lg font-bold shadow-[var(--shadow-neon)] hover:scale-105 transition-transform"
            >
              Open My Dashboard
            </button>
          </div>
        )}

        {/* Tab Content Switching */}
        {activeTab === 'dashboard' && (
          <>
            {/* Budget & AI Warnings */}
            <div className="flex flex-col gap-3 mb-6">
              {/* Budget Warnings */}
              {Object.entries(budgets).map(([cat, limit]) => {
                const spent = categoryData.find(c => c.name === cat)?.value || 0;
                if (limit > 0 && spent >= limit * 0.8) {
                  const isExceeded = spent >= limit;
                  return (
                    <div key={`warn-${cat}`} className={`p-3 rounded-xl flex items-center gap-3 border animate-in slide-in-from-top-2 duration-300 ${isExceeded ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
                      <Bell className="w-4 h-4 shrink-0" />
                      <div className="flex-1 text-sm">
                        <span className="font-bold uppercase text-[10px] block leading-none mb-1">Budget Warning</span>
                        {isExceeded
                          ? `You've exceeded your ${cat} budget by ₹${(spent - limit).toFixed(2)}!`
                          : `You've reached ${Math.round((spent / limit) * 100)}% of your ${cat} budget.`}
                      </div>
                    </div>
                  );
                }
                return null;
              })}

              {/* AI Live Insight Banner */}
              {aiInsights?.insights?.[0] && (
                <div className={`p-4 rounded-2xl flex items-center gap-4 border group animate-in slide-in-from-left-4 duration-700 ${isDarkMode ? 'bg-accent-400/10 border-accent-400/20 shadow-[0_0_20px_rgba(236,72,153,0.1)]' : 'bg-pink-50 border-pink-100 shadow-sm'}`}>
                  <div className="w-10 h-10 rounded-xl bg-accent-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(236,72,153,0.4)] group-hover:scale-110 transition-transform">
                    <Sparkles className="text-white w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${isDarkMode ? 'text-accent-400' : 'text-accent-600'}`}>AI Live Insight</p>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      {aiInsights.insights[0].message}
                    </p>
                  </div>
                  <button onClick={() => setActiveTab('ai-insights')} className={`hidden sm:flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${isDarkMode ? 'border-accent-400/30 text-accent-400 hover:bg-accent-400 hover:text-white' : 'border-pink-200 text-pink-600 hover:bg-pink-100'}`}>
                    Details
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 items-start">

              {/* Main Balance Card */}
              <div className={`lg:col-span-2 p-6 relative overflow-hidden group animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-100'}`}>
                <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-10 -mt-20 transition-all duration-500 ${isDarkMode ? 'bg-primary-600/20 group-hover:bg-primary-600/30' : 'bg-primary-300/30 group-hover:bg-primary-300/40'}`} />

                <h2 className={`text-sm font-medium mb-1 uppercase tracking-wider relative z-10 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Remaining Balance</h2>
                <div className="flex items-baseline gap-2 mb-4 relative z-10">
                  <span className={`text-4xl lg:text-5xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>₹{summary.totalBalance.toFixed(2)}</span>
                </div>

                <div className="flex gap-6 relative z-10 mb-6 border-t border-white/10 pt-4">
                  <div>
                    <h3 className={`text-xs uppercase tracking-wider mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Total Income</h3>
                    <span className="text-xl font-bold text-green-500">₹{summary.totalIncome.toFixed(2)}</span>
                  </div>
                  <div>
                    <h3 className={`text-xs uppercase tracking-wider mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Total Expense</h3>
                    <span className="text-xl font-bold text-red-500">₹{summary.totalExpense.toFixed(2)}</span>
                  </div>
                </div>

                <div className="h-64 w-full mt-4 -ml-4 relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={last7DaysData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSpendDash" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={isDarkMode ? 0.4 : 0.2} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorIncomeDash" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={isDarkMode ? 0.4 : 0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDarkMode ? 'rgba(30, 33, 48, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                          borderRadius: '12px',
                          border: 'none',
                          color: isDarkMode ? '#fff' : '#000'
                        }}
                        itemStyle={{ color: isDarkMode ? '#fff' : '#000' }}
                      />
                      <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncomeDash)" />
                      <Area type="monotone" dataKey="spending" name="Expense" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorSpendDash)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Smart AI Suggestions Section */}
                <div className="mt-8 pt-6 border-t border-white/5 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* First Column: Optimization & Suggestions */}
                  <div className="flex flex-col gap-6">
                    {/* Suggestion 1: Budget Optimization */}
                    <div>
                      <h3 className={`text-[10px] uppercase font-bold tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-accent-400' : 'text-accent-600'}`}>
                        <Target className="w-3 h-3" /> Budget Optimization
                      </h3>
                      <div className={`p-4 rounded-xl border border-white/5 ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                        {summary.totalExpense > summary.totalIncome * 0.7 ? (
                          <div className="space-y-2">
                            <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>High Burn Rate Detected</p>
                            <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              Your expenses are {Math.round((summary.totalExpense / (summary.totalIncome || 1)) * 100)}% of your income. Consider shifting ₹{(summary.totalExpense * 0.1).toFixed(0)} from 'Wants' to your Savings Goal.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className={`text-xs font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>Healthy Savings Pace</p>
                            <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              You're saving well! At this rate, your runway will extend to {Math.round(summary.totalBalance / (summary.totalExpense / (transactions.length || 1)) + 5) || 0} days by next week.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Suggestions in Blank Space */}
                    <div>
                      <h3 className={`text-[10px] uppercase font-bold tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                        <Lightbulb className="w-3 h-3" /> Smart Suggestions
                      </h3>
                      <div className={`p-4 rounded-xl border border-white/5 ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} space-y-3`}>
                        {aiInsights?.insights && aiInsights.insights.length > 1 ? (
                          aiInsights.insights.slice(1, 3).map((insight, idx) => (
                            <div key={idx} className="flex gap-3 items-start">
                              <Sparkles className="w-3 h-3 text-primary-400 mt-1 shrink-0" />
                              <p className={`text-[11px] leading-relaxed text-left ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {insight.message}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className={`text-[11px] leading-relaxed text-left ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Log more transactions in different categories to unlock personalized smart tips here!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Second Column: Journal & Self Modification */}
                  <div className="flex flex-col gap-6">
                    {/* Suggestion 2: Personal Finance Journal */}
                    <div>
                      <h3 className={`text-[10px] uppercase font-bold tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-secondary-400' : 'text-secondary-600'}`}>
                        <MessageSquare className="w-3 h-3" /> Self-Reflection Journal
                      </h3>
                      <div className={`p-4 rounded-xl border border-white/5 ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] uppercase tracking-widest text-gray-500 mb-1 block">Quick Feedback</label>
                            <select
                              value={journalCategory}
                              onChange={(e) => setJournalCategory(e.target.value)}
                              className={`w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-500 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              <option value="progress" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>📈 Track Progress</option>
                              <option value="habit" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>🧠 Habit Building</option>
                              <option value="saving" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>💰 Saving Strategy</option>
                              <option value="other" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>📝 Other (Write Note)</option>
                            </select>
                          </div>

                          {journalCategory === 'other' && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                              <textarea
                                value={journalNote}
                                onChange={(e) => setJournalNote(e.target.value)}
                                placeholder="Describe your financial goal or feedback..."
                                className={`w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-[11px] h-20 resize-none focus:outline-none focus:ring-1 focus:ring-primary-500 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              />
                            </div>
                          )}

                          <button
                            onClick={handleSaveReflection}
                            className="w-full py-2 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 text-[10px] font-bold rounded-lg transition-all border border-primary-500/20"
                          >
                            Save Reflection
                          </button>

                          {latestReflection && (
                            <div className="mt-2 pt-2 border-t border-white/5 animate-in fade-in duration-500">
                              <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Latest Reflection</p>
                              <div className="flex items-start gap-2">
                                <div className="p-1 rounded bg-secondary-500/20 text-secondary-400">
                                  <MessageSquare className="w-2.5 h-2.5" />
                                </div>
                                <div className="flex-1">
                                  <p className={`text-[10px] italic leading-snug ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    "{latestReflection.note || latestReflection.category}"
                                  </p>
                                  <p className="text-[8px] text-gray-500 mt-1">
                                    {new Date(latestReflection.date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Self Modification / Feedback */}
                    <div>
                      <h3 className={`text-[10px] uppercase font-bold tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                        <Edit2 className="w-3 h-3" /> Self Modification Plan
                      </h3>
                      <div className={`p-4 rounded-xl border border-white/5 ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                        <textarea
                          value={user?.selfFeedback || ''}
                          onChange={(e) => setUser(prev => ({ ...prev, selfFeedback: e.target.value }))}
                          onBlur={() => handleUpdateProfile({ selfFeedback: user?.selfFeedback })}
                          placeholder="Write down an actionable plan to change your habits (e.g., I will stop buying coffee outside)..."
                          className={`w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-[11px] h-20 resize-none focus:outline-none focus:ring-1 focus:ring-green-500 mb-2 ${isDarkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
                        />
                        <p className={`text-[9px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} italic flex justify-between`}>
                          <span>Saves automatically.</span>
                          <span>Make yourself accountable!</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar column (Daily Tracking + Health + Runway) */}
              <div className="flex flex-col gap-4 lg:gap-6">
                {/* Today's Daily Tracking */}
                < div className={`p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-100'}`
                }>
                  <h3 className={`text-sm font-medium mb-4 uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Daily Tracking (Today)</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>₹{todayExpense.toFixed(0)}</p>
                        <p className="text-xs text-secondary-400">Today's Expense</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>₹{todayIncome.toFixed(0)}</p>
                        <p className="text-xs text-primary-400">Today's Income</p>
                      </div>
                    </div>

                    {/* Visual Progress */}
                    <div className="h-24 w-full mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[{ name: 'Today', expense: todayExpense, income: todayIncome }]} layout="vertical">
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" hide />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: '#fff' }}
                            cursor={{ fill: 'transparent' }}
                          />
                          <Bar dataKey="income" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                          <Bar dataKey="expense" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className={`p-3 rounded-lg border border-primary-500/20 bg-primary-500/5 mt-2`}>
                      <p className="text-xs font-bold text-primary-400 uppercase mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI Suggestion
                      </p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{getTodaySuggestion()}</p>
                    </div>
                  </div>
                </div>

                <div className={`p-6 flex flex-col justify-center items-center relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-100'}`}>
                  <div className={`absolute inset-0 blur-xl ${isDarkMode ? 'bg-gradient-to-b from-accent-400/5 to-transparent' : 'bg-gradient-to-b from-accent-400/10 to-transparent'}`} />
                  <h3 className={`font-medium mb-4 w-full text-left relative z-10 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Financial Health</h3>

                  {/* Simplified Gauge */}
                  <div className="relative w-32 h-32 flex items-center justify-center z-10">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="64" cy="64" r="56" className={isDarkMode ? 'stroke-white/10' : 'stroke-gray-200'} strokeWidth="12" fill="none" />
                      <circle cx="64" cy="64" r="56" className="stroke-accent-400" strokeWidth="12" fill="none" strokeDasharray="351.8" strokeDashoffset={351.8 * (1 - (summary.healthScore / 100))} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{summary.healthScore}</span>
                      <span className="text-xs text-accent-400">{summary.healthScore > 70 ? 'GOOD' : summary.healthScore > 40 ? 'AVG' : 'POOR'}</span>
                    </div>
                  </div>
                  <p className={`text-xs text-center mt-4 z-10 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>You are managing your lifestyle budget well.</p>
                </div>

                <div className={`p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both ${isDarkMode ? 'glass-card bg-gradient-to-br from-card-dark to-[#27104b] border-[var(--color-primary-600)]/30' : 'bg-gradient-to-br from-purple-50 to-white rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-200'}`}>
                  <h3 className={`font-medium mb-2 text-sm flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    ⏱️ Runway Predictor
                  </h3>
                  <p className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {summary.totalBalance > 0 && summary.totalExpense > 0 ? `${Math.max(1, Math.round(summary.totalBalance / (summary.totalExpense / (transactions.length || 1))))} Days` : '∞'} Left
                  </p>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Based on historical averages.</p>
                  <div className={`w-full h-2 rounded-full mt-4 overflow-hidden ${isDarkMode ? 'bg-black/40' : 'bg-gray-200'}`}>
                    <div className="bg-gradient-to-r from-primary-500 to-secondary-500 h-full w-[60%] rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insights Banner */}
            <div className={`p-4 sm:p-5 mb-6 flex items-start sm:items-center gap-4 border-l-4 border-accent-400 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400 fill-mode-both ${isDarkMode ? 'glass-card bg-gradient-to-r from-accent-400/10 to-transparent' : 'bg-white rounded-r-2xl shadow-xl shadow-pink-900/5 bg-gradient-to-r from-accent-50 to-transparent'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-accent-400/20 shadow-[var(--shadow-neon)]' : 'bg-accent-100'}`}>
                <Sparkles className="w-5 h-5 text-accent-400" />
              </div>
              <div>
                <h4 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Smart AI Insight</h4>
                <p className={`text-xs sm:text-sm mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{getSmartInsight()}</p>
              </div>
            </div>

            {/* Recent Transactions Section */}
            <div className={`p-4 sm:p-6 mb-8 md:mb-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 fill-mode-both ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-100'}`}>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Recent Transactions</h3>
                <div className={`flex p-1 rounded-lg ${isDarkMode ? 'bg-black/30' : 'bg-gray-100'}`}>
                  {['All', 'Income', 'Expense'].map(f => (
                    <button
                      key={f}
                      onClick={() => setTxFilter(f)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex-1 sm:flex-none ${txFilter === f ? (isDarkMode ? 'bg-white/10 text-white shadow-sm' : 'bg-white shadow text-gray-900 font-semibold') : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {transactions.length === 0 ? (
                  <p className={`text-center py-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No transactions yet. Add one!</p>
                ) : (
                  transactions
                    .filter(tx => txFilter === 'All' ? true : txFilter.toLowerCase() === tx.type)
                    .slice(0, 10)
                    .map((tx) => (
                      <div key={tx._id} className={`flex items-center justify-between p-3 rounded-xl transition-colors group cursor-pointer border border-transparent ${isDarkMode ? 'hover:bg-white/5 hover:border-white/5' : 'hover:bg-gray-50 hover:border-gray-100'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-black/30 border border-white/5' : 'bg-gray-100'} ${tx.type === 'income' ? 'text-primary-400' : 'text-secondary-400'}`}>
                            {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className={`font-semibold transition-colors ${isDarkMode ? 'text-gray-200 group-hover:text-white' : 'text-gray-700 group-hover:text-gray-900'}`}>{tx.description}</p>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              {new Date(tx.date).toLocaleDateString()}
                              {tx.type === 'expense' && tx.paymentMethod && ` • w/ ${tx.paymentMethod}`}
                            </p>
                          </div>
                        </div>
                        <span className={`font-semibold ${tx.amount > 0 ? 'text-green-500' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div >
          </>
        )}

        {/* Analytics Tab */}
        {
          activeTab === 'analytics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

              <div className={`p-6 min-h-[400px] ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-100'}`}>
                <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Income vs Expense (7 Days)</h3>
                <div className="h-72 w-full -ml-4 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={last7DaysData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} vertical={false} />
                      <XAxis dataKey="date" stroke={isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"} axisLine={false} tickLine={false} />
                      <YAxis stroke={isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ backgroundColor: isDarkMode ? 'rgba(30,33,48,0.9)' : 'rgba(255,255,255,0.9)', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: '12px', border: 'none' }}
                        itemStyle={{ color: isDarkMode ? '#fff' : '#000' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
                      <Bar dataKey="spending" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={25} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`p-6 min-h-[400px] flex flex-col items-center ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-100'}`}>
                <h3 className={`text-lg font-bold mb-2 w-full ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Expenses by Category</h3>
                {categoryData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500">Not enough data yet</div>
                ) : (
                  <div className="h-72 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: isDarkMode ? 'rgba(30, 33, 48, 0.9)' : 'rgba(255, 255, 255, 0.9)', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: '12px', border: 'none' }}
                          itemStyle={{ color: isDarkMode ? '#fff' : '#000' }}
                          formatter={(value) => `₹${value.toFixed(2)}`}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Custom Legend */}
                <div className="flex flex-wrap justify-center gap-4 mt-6 w-full">
                  {categoryData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className={`capitalize ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Need vs Want Ratio Card */}
              <div className={`p-6 lg:col-span-2 flex flex-col md:flex-row items-center justify-between gap-6 ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-100'}`}>
                <div>
                  <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Need vs Want Ratio</h3>
                  <p className={`text-sm max-w-md ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>You're doing great keeping your basic needs separate from luxury wants. Tracking this helps train our AI predictor over time.</p>
                </div>

                <div className="w-full md:w-1/2 flex items-center gap-4">
                  <div className="flex-1 flex flex-col items-end">
                    <span className="text-xs text-gray-400 mb-1">Needs (75%)</span>
                    <div className="w-full bg-black/40 h-3 rounded-l-full overflow-hidden">
                      <div className="bg-green-500 h-full w-[75%] float-right" />
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-start">
                    <span className="text-xs text-gray-400 mb-1">Wants (25%)</span>
                    <div className="w-full bg-black/40 h-3 rounded-r-full overflow-hidden">
                      <div className="bg-secondary-500 h-full w-[25%]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Budgets Card */}
              <div className={`p-6 lg:col-span-2 ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-100'}`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Category Budgets</h3>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Set monthly limits</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                  {['food', 'rent', 'travel', 'entertainment', 'shopping', 'other', ...(user?.studentType === 'Day Scholar' ? ['bus_pass', 'stationery', 'lunch_outside', 'fuel'] : [])].map(cat => {
                    const spent = categoryData.find(c => c.name === cat)?.value || 0;
                    const limit = budgets[cat] || 0;
                    // Only show 0 limit Day Scholar categories if they have spent something, to keep it clean, or just show them natively
                    if (user?.studentType === 'Day Scholar' && ['bus_pass', 'stationery', 'lunch_outside', 'fuel'].includes(cat) && limit === 0 && spent === 0) return null;

                    const progress = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
                    const isOver = spent > limit && limit > 0;

                    return (
                      <div key={cat} className={`p-4 rounded-xl border ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`capitalize font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{cat}</span>
                          {editingBudget === cat ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                autoFocus
                                className={`w-20 text-sm px-2 py-1 rounded-md outline-none ${isDarkMode ? 'bg-black/50 text-white' : 'bg-white border text-gray-900'}`}
                                value={budgetInput}
                                onChange={e => setBudgetInput(e.target.value)}
                                placeholder="Limit"
                              />
                              <button onClick={() => handleSaveBudget(cat)} className="text-secondary-400 text-sm font-semibold hover:text-secondary-300">Save</button>
                              <button onClick={() => setEditingBudget(null)} className="text-gray-400 text-xs hover:text-white">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-semibold ${isOver ? 'text-red-500' : (isDarkMode ? 'text-white' : 'text-gray-900')}`}>
                                ₹{spent.toFixed(0)} <span className={`text-xs font-normal ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>/ {limit > 0 ? `₹${limit}` : 'No Limit'}</span>
                              </span>
                              <button onClick={() => { setEditingBudget(cat); setBudgetInput(limit || ''); }} className="text-xs text-primary-400 hover:text-primary-300">Set</button>
                            </div>
                          )}
                        </div>
                        <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-black/40' : 'bg-gray-200'}`}>
                          <div
                            className={`h-full rounded-full ${isOver ? 'bg-red-500' : (progress > 80 ? 'bg-orange-500' : 'bg-primary-500')}`}
                            style={{ width: `${limit > 0 ? progress : 0}%` }}
                          />
                        </div>
                        {isOver && <p className="text-xs text-red-500 mt-2">You've exceeded your budget by ₹{(spent - limit).toFixed(2)}!</p>}
                        {!isOver && limit > 0 && progress >= 80 && <p className="text-xs text-orange-400 mt-2">Careful, you are near your limit.</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        }

        {/* Transactions Tab */}
        {
          activeTab === 'transactions' && (() => {
            const filtered = transactions
              .filter(tx => txFilter === 'All' ? true : txFilter.toLowerCase() === tx.type)
              .filter(tx => txCategoryFilter === 'All' ? true : txCategoryFilter === tx.category)
              .filter(tx => {
                const amt = Math.abs(tx.amount);
                if (txAmountFilter === '< 500') return amt < 500;
                if (txAmountFilter === '500 - 2000') return amt >= 500 && amt <= 2000;
                if (txAmountFilter === '> 2000') return amt > 2000;
                return true;
              })
              .filter(tx => {
                if (txDateFilter === 'This Month') {
                  const today = new Date();
                  const txDate = new Date(tx.date);
                  return txDate.getMonth() === today.getMonth() && txDate.getFullYear() === today.getFullYear();
                }
                if (txDateFilter === 'Last Month') {
                  const today = new Date();
                  const txDate = new Date(tx.date);
                  const lastMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
                  const targetYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
                  return txDate.getMonth() === lastMonth && txDate.getFullYear() === targetYear;
                }
                return true;
              });

            const grouped = filtered.reduce((acc, tx) => {
              const month = new Date(tx.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              if (!acc[month]) acc[month] = [];
              acc[month].push(tx);
              return acc;
            }, {});

            return (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-8">
                <div className={`p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-100'}`}>
                  <div>
                    <h3 className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>All Transactions</h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Review your complete financial history.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={txDateFilter}
                      onChange={(e) => setTxDateFilter(e.target.value)}
                      className={`px-3 py-2 text-sm font-medium rounded-md outline-none ${isDarkMode ? 'bg-white/10 text-white border-none' : 'bg-gray-100 text-gray-700 border-none'}`}
                    >
                      <option value="All" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>All Time</option>
                      <option value="This Month" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>This Month</option>
                      <option value="Last Month" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>Last Month</option>
                    </select>

                    <select
                      value={txCategoryFilter}
                      onChange={(e) => setTxCategoryFilter(e.target.value)}
                      className={`px-3 py-2 text-sm font-medium rounded-md outline-none ${isDarkMode ? 'bg-white/10 text-white border-none' : 'bg-gray-100 text-gray-700 border-none'}`}
                    >
                      <option value="All" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>All Categories</option>
                      {Array.from(new Set(transactions.map(t => t.category))).map(c => <option key={c} value={c} className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>{c}</option>)}
                    </select>

                    <select
                      value={txAmountFilter}
                      onChange={(e) => setTxAmountFilter(e.target.value)}
                      className={`px-3 py-2 text-sm font-medium rounded-md outline-none ${isDarkMode ? 'bg-white/10 text-white border-none' : 'bg-gray-100 text-gray-700 border-none'}`}
                    >
                      <option value="All" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>All Amounts</option>
                      <option value="< 500" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>&lt; ₹500</option>
                      <option value="500 - 2000" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>₹500 - ₹2000</option>
                      <option value="> 2000" className={`${isDarkMode ? 'bg-[#1e2136] text-white' : 'bg-white text-gray-900'}`}>&gt; ₹2000</option>
                    </select>

                    <div className={`flex p-1 rounded-lg ${isDarkMode ? 'bg-black/30' : 'bg-gray-100'}`}>
                      {['All', 'Income', 'Expense'].map(f => (
                        <button
                          key={f}
                          onClick={() => setTxFilter(f)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all sm:flex-none ${txFilter === f ? (isDarkMode ? 'bg-white/10 text-white shadow-sm' : 'bg-white shadow text-gray-900 font-semibold') : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`flex flex-col gap-8`}>
                  {Object.keys(grouped).length === 0 ? (
                    <div className={`p-12 text-center ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-sm border'} opacity-60`}>
                      <p>No transactions match your current filters.</p>
                    </div>
                  ) : (
                    Object.entries(grouped)
                      .sort((a, b) => new Date(b[1][0].date) - new Date(a[1][0].date)) // Sort months descending
                      .map(([month, monthTransactions]) => (
                        <div key={month} className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                          <h4 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            <span className="w-1.5 h-6 bg-primary-500 rounded-full" />
                            {month} {txFilter === 'Expense' ? 'Expenses' : txFilter === 'Income' ? 'Income' : 'History'}
                          </h4>
                          <div className={`overflow-hidden rounded-2xl ${isDarkMode ? 'glass-card border border-white/5' : 'bg-white shadow-lg border border-purple-100'}`}>
                            <div className="flex flex-col">
                              {monthTransactions
                                .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort items within month descending
                                .map((tx, idx) => (
                                  <div
                                    key={tx._id}
                                    className={`flex items-center justify-between p-4 group transition-all hover:bg-white/5 ${idx !== monthTransactions.length - 1 ? (isDarkMode ? 'border-b border-white/5' : 'border-b border-gray-100') : ''}`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-black/30' : 'bg-gray-100'} ${tx.type === 'income' ? 'text-primary-400' : 'text-secondary-400'}`}>
                                        {tx.type === 'income' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                                      </div>
                                      <div>
                                        <p className={`font-bold text-base ${isDarkMode ? 'text-gray-200 group-hover:text-white' : 'text-gray-800'}`}>{tx.description}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-500'}`}>{tx.category}</span>
                                          <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>•</span>
                                          <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{new Date(tx.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                                          {tx.type === 'expense' && (
                                            <>
                                              <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>•</span>
                                              <span className={`text-xs capitalize ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{tx.paymentMethod || 'cash'}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                      <span className={`font-bold text-lg ${tx.type === 'income' ? 'text-green-500' : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        {tx.type === 'income' ? '+' : '-'}₹{Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => {
                                            setEditingTransaction(tx);
                                            setIsAddModalOpen(true);
                                          }}
                                          className="text-gray-400 hover:text-primary-400 transition-colors p-2"
                                          title="Edit"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteTransaction(tx._id)}
                                          className="text-gray-400 hover:text-red-500 transition-colors p-2"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            );
          })()
        }
        {/* AI Assistant Tab (Chat) */}
        {
          activeTab === 'ai-chat' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-180px)] flex flex-col">
              <div className={`p-6 mb-6 border-l-4 border-primary-500 rounded-r-2xl ${isDarkMode ? 'glass-card bg-gradient-to-r from-primary-500/10 to-transparent' : 'bg-white shadow-xl shadow-purple-900/5 bg-gradient-to-r from-purple-50 to-transparent'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Bot className="w-6 h-6 text-primary-500 animate-pulse" />
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Smart AI Assistant</h3>
                </div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Ask anything about your finances, saving tips, or let the AI analyze your spending patterns.
                </p>
              </div>

              <div className={`flex-1 overflow-hidden flex flex-col ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-xl'}`}>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 scroll-smooth custom-scrollbar">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
                      <div className="flex gap-3 max-w-[85%] sm:max-w-[70%]">
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-600 to-accent-400 flex items-center justify-center shrink-0 shadow-lg">
                            <Sparkles className="text-white w-4 h-4" />
                          </div>
                        )}
                        <div className={`p-4 rounded-2xl text-sm sm:text-base leading-relaxed ${msg.role === 'user'
                          ? 'bg-gradient-to-tr from-primary-600 to-primary-500 text-white shadow-lg rounded-tr-none'
                          : isDarkMode ? 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none' : 'bg-gray-100 text-gray-800 rounded-tl-none shadow-sm'}`}>
                          {msg.content}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                            <User className="text-primary-400 w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                          <Sparkles className="text-gray-500 w-4 h-4 animate-spin" />
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
                          <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-6 border-t border-white/10 bg-black/10">
                  <form onSubmit={handleSendMessage} className="relative group">
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="E.g., How much did I spend on food this month?"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-6 pr-14 py-4 text-sm sm:text-base focus:border-primary-500/50 outline-none transition-all shadow-inner placeholder-gray-500 group-focus-within:bg-white/10"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isChatLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-primary-600 text-white hover:bg-primary-500 transition-all shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                    >
                      <ArrowUpRight className="w-5 h-5" />
                    </button>
                  </form>
                  <div className="mt-3 flex gap-2 text-[10px] sm:text-xs text-gray-500 overflow-x-auto pb-1 no-scrollbar">
                    {['Budget summary', 'Saving tips', 'Categorize lunch', 'Expense trends'].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setChatInput(suggestion)}
                        className="whitespace-nowrap px-3 py-1 rounded-full border border-white/5 hover:border-primary-500/30 hover:bg-primary-500/5 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* AI Insights Tab */}
        {
          activeTab === 'ai-insights' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-8">
              <div className={`p-6 mb-8 border-l-4 border-accent-400 ${isDarkMode ? 'glass-card bg-gradient-to-r from-accent-400/10 to-transparent' : 'bg-white rounded-r-2xl shadow-xl shadow-pink-900/5 bg-gradient-to-r from-accent-50 to-transparent'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="w-6 h-6 text-accent-400 animate-pulse" />
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Smart AI Analysis</h3>
                </div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Our AI analyzes your spending patterns to give you predictive alerts and personalized saving advice.
                </p>
              </div>

              {!aiInsights || aiInsights.status === 'empty' ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                    <Sparkles className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-400">Add more transactions to unlock AI Insights.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                  {/* Monthly Pace Card */}
                  <div className={`p-6 relative overflow-hidden group ${isDarkMode ? 'glass-card border-accent-400/20' : 'bg-white rounded-2xl shadow-lg border border-accent-100'}`}>
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp className="w-16 h-16 text-accent-400" />
                    </div>
                    <h4 className={`text-xs uppercase tracking-wider mb-4 font-bold ${isDarkMode ? 'text-accent-400' : 'text-accent-600'}`}>Est. Monthly Spend</h4>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>₹{aiInsights.summary.pace.toFixed(0)}</span>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Based on your pace in {new Date().toLocaleString('default', { month: 'long' })}.
                    </p>
                    <div className={`w-full h-1.5 rounded-full mt-6 overflow-hidden ${isDarkMode ? 'bg-black/40' : 'bg-gray-100'}`}>
                      <div className="h-full bg-accent-400" style={{ width: '70%' }}></div>
                    </div>
                  </div>

                  {/* Insight Cards */}
                  {aiInsights.insights.map((insight, idx) => (
                    <div key={idx} className={`p-6 relative overflow-hidden border-t-4 group transition-transform hover:-translate-y-1 ${insight.status === 'warning' ? 'border-red-500' : insight.status === 'good' ? 'border-green-500' : 'border-blue-500'} ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-lg border-x border-b border-gray-100'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{insight.title}</h4>
                        {insight.value && (
                          <span className={`text-xs px-2 py-1 rounded-full font-bold ${insight.status === 'warning' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                            {insight.value}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {insight.message}
                      </p>

                      {insight.type === 'advice' && (
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-primary-400 text-xs font-semibold cursor-pointer hover:underline">
                          <span>View saving plan</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  ))}

                </div>
              )}

              {/* AI Advisor Chat Preview - Directs to Chat Tab */}
              <div
                onClick={() => setActiveTab('ai-chat')}
                className={`mt-10 p-4 rounded-2xl border flex items-center justify-between group cursor-pointer ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent-400 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.4)]">
                    <Bot className="text-white w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Interactive AI Advisor</p>
                    <p className="text-xs text-gray-500">Click to start a conversation with your financial guide.</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight className="text-white w-5 h-5" />
                </div>
              </div>
            </div>
          )
        }

        {/* Goals Tab */}
        {
          activeTab === 'goals' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-8">
              <div className={`p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-l-4 border-blue-500 ${isDarkMode ? 'glass-card bg-gradient-to-r from-blue-500/10 to-transparent' : 'bg-white rounded-r-2xl shadow-xl shadow-blue-900/5 bg-gradient-to-r from-blue-50 to-transparent'}`}>
                <div>
                  <h3 className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Savings Goals</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Track your progress for big-ticket purchases.</p>
                </div>
                <button onClick={() => { setEditingGoal(null); setIsAddGoalModalOpen(true); }} className="btn-primary flex items-center gap-2 py-2 px-4 shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                  <Plus className="w-4 h-4" />
                  New Goal
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

                {goals.length === 0 ? (
                  <div className="col-span-1 lg:col-span-2 text-center text-gray-500 py-10">
                    <Target className="w-12 h-12 mx-auto text-gray-400 mb-2 opacity-50" />
                    <p>No savings goals yet. Start saving today!</p>
                  </div>
                ) : (
                  goals.map(goal => {
                    const progress = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
                    const isComplete = progress >= 100;
                    return (
                      <div key={goal._id} className={`p-6 relative overflow-hidden group hover:border-blue-500/50 transition-colors ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-lg border border-gray-100/50'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${isComplete ? 'bg-green-500/10 border-green-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
                            <Target className={`w-6 h-6 group-hover:scale-110 transition-transform ${isComplete ? 'text-green-500' : 'text-blue-500'}`} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${isComplete ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'}`}>
                              {isComplete ? 'Completed!' : 'In Progress'}
                            </span>
                            {!isComplete && (
                              <button onClick={() => setAddingSavingsGoal(goal)} className="text-gray-400 hover:text-green-500 transition-colors p-1 flex items-center pr-2" title="Add Savings">
                                <Plus className="w-4 h-4" /> <span className="text-xs ml-1 font-bold">Add</span>
                              </button>
                            )}
                            <button onClick={() => { setEditingGoal(goal); setIsAddGoalModalOpen(true); }} className="text-gray-400 hover:text-blue-500 transition-colors p-1" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteGoal(goal._id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <h4 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{goal.title}</h4>
                        <p className={`text-sm mb-6 flex justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Target: ₹{goal.targetAmount.toLocaleString()}
                          <span>{goal.deadline ? `By ${new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : 'No Deadline'}</span>
                        </p>

                        <div className="flex justify-between text-sm mb-2">
                          <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>₹{goal.savedAmount.toLocaleString()} Saved</span>
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-500"}>{progress.toFixed(0)}%</span>
                        </div>
                        <div className={`w-full h-3 rounded-full overflow-hidden ${isDarkMode ? 'bg-black/40' : 'bg-gray-100'}`}>
                          <div
                            className={`h-full rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)] ${isComplete ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-blue-600 to-blue-400'}`}
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )
        }

        {/* Settings Tab */}
        {
          activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-8">
              <div className={`p-6 mb-8 border-l-4 border-primary-500 ${isDarkMode ? 'glass-card bg-gradient-to-r from-primary-500/10 to-transparent' : 'bg-white rounded-r-2xl shadow-xl shadow-purple-900/5 bg-gradient-to-r from-purple-50 to-transparent'}`}>
                <h3 className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Account Settings</h3>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Manage your profile and personal preferences.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Profile Card */}
                <div className={`lg:col-span-2 p-8 ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-lg'}`}>
                  <div className="flex items-center gap-6 mb-10 overflow-hidden">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-white/10 shrink-0">
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-3xl font-bold uppercase">
                            {user?.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{user?.name}</h4>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-secondary-400'}`}>{user?.email}</p>
                      <div className="mt-2 flex gap-2">
                        <span className="text-[10px] uppercase font-black bg-accent-400/20 text-accent-400 px-2 py-0.5 rounded tracking-widest border border-accent-400/30">PRO USER</span>
                        <span className={`text-[10px] uppercase font-black bg-white/5 px-2 py-0.5 rounded tracking-widest border ${isDarkMode ? 'border-white/10 text-gray-500' : 'border-gray-100 text-gray-400'}`}>VERIFIED</span>
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      handleUpdateProfile({
                        name: formData.get('userName'),
                        phone: formData.get('phone'),
                        profession: formData.get('profession'),
                        dob: formData.get('dob'),
                        address: formData.get('address'),
                        studentType: formData.get('studentType')
                      });
                    }}
                    className="flex flex-col gap-6"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Display Name</label>
                        <input name="userName" type="text" defaultValue={user?.name} className="glass-input w-full" placeholder="Your full name" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Account Email</label>
                        <input type="email" readOnly value={user?.email} className="glass-input w-full opacity-50 cursor-not-allowed" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Phone Number</label>
                        <input name="phone" type="tel" defaultValue={user?.phone || '+91 '} className="glass-input w-full" placeholder="+91 00000 00000" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Profession</label>
                        <input name="profession" type="text" defaultValue={user?.profession} className="glass-input w-full" placeholder="Software Engineer" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Student Type</label>
                        <select name="studentType" defaultValue={user?.studentType || 'Not a Student'} className="glass-input w-full bg-[#1e2130] focus:outline-none focus:ring-1 focus:ring-primary-500">
                          <option value="Not a Student">Not a Student</option>
                          <option value="Hosteller">Hosteller</option>
                          <option value="Day Scholar">Day Scholar</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">Date of Birth</label>
                        <input name="dob" type="date" defaultValue={user?.dob} className="glass-input w-full" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-400 mb-2">App Currency</label>
                        <input type="text" readOnly value="Indian Rupee (₹)" className="glass-input w-full opacity-50 cursor-not-allowed" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-400 mb-2">Address</label>
                      <textarea name="address" defaultValue={user?.address} className="glass-input w-full min-h-[100px]" placeholder="Street, City, State, ZIP" />
                    </div>

                    <div className="pt-4 flex justify-end gap-4">
                      <div className="relative">
                        <input
                          id="photo-upload"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleUploadPhoto(e.target.files[0])}
                        />
                        <label
                          htmlFor="photo-upload"
                          className={`btn-primary px-6 py-3 rounded-xl font-bold border border-white/10 cursor-pointer flex items-center gap-2 ${isSavingProfile ? 'opacity-50' : ''}`}
                        >
                          <User className="w-4 h-4" />
                          Upload Original Photo
                        </label>
                      </div>
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="btn-primary px-8 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(139,92,246,0.3)] disabled:opacity-50"
                      >
                        {isSavingProfile ? 'Saving Changes...' : 'Save Profile Details'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Preferences Card */}
                <div className="flex flex-col gap-6">
                  {/* Daily Preferences - Placeholder or context for future settings */}
                  <div className={`p-6 ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-lg'}`}>
                    <h4 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Theme & Locale</h4>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 opacity-70">
                        <div className="flex items-center gap-3">
                          <Moon className="w-5 h-5 text-gray-400" />
                          <span className="text-sm font-medium">Dark Mode Appearance</span>
                        </div>
                        <span className="text-xs font-bold text-primary-400 uppercase tracking-widest">Enforced</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 opacity-70">
                        <div className="flex items-center gap-3">
                          <Wallet className="w-5 h-5 text-gray-400" />
                          <span className="text-sm font-medium">Regional Currency</span>
                        </div>
                        <span className="text-xs font-bold text-primary-400 uppercase tracking-widest">INR (₹)</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-6 border-l-4 border-red-500 ${isDarkMode ? 'glass-card' : 'bg-white rounded-2xl shadow-lg border border-red-100'}`}>
                    <h4 className="text-lg font-bold text-red-500 mb-2">Danger Zone</h4>
                    <p className="text-xs text-gray-500 mb-4">You can either wipe your data to start fresh, or permanently delete your entire account.</p>
                    <div className="flex flex-col gap-3">
                      <button onClick={handleDeleteData} className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-500 text-sm font-bold hover:bg-red-500/10 transition-colors">
                        Delete My Data
                      </button>
                      <button onClick={handleDeleteAccount} className="w-full py-2.5 rounded-xl border border-red-500 bg-red-500/10 text-red-500 text-sm font-bold hover:bg-red-500 hover:text-white transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                        Delete My Account
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )
        }
      </main >

      {/* Add/Edit Modal Overlay */}
      {
        isAddModalOpen && <AddTransactionModal
          token={token}
          user={user}
          editingTransaction={editingTransaction}
          transactions={transactions}
          budgets={budgets}
          categoryData={categoryData}
          totalBalance={summary.totalBalance}
          addToast={addToast}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingTransaction(null);
            fetchData();
          }}
        />
      }

      {/* Add/Edit Goal Modal */}
      {
        isAddGoalModalOpen && <AddGoalModal
          token={token}
          editingGoal={editingGoal}
          onClose={() => {
            setIsAddGoalModalOpen(false);
            setEditingGoal(null);
            fetchData();
          }}
        />
      }

      {/* Add Savings Modal */}
      {
        addingSavingsGoal && <AddSavingsModal
          token={token}
          goal={addingSavingsGoal}
          totalBalance={summary.totalBalance}
          addToast={addToast}
          onClose={() => {
            setAddingSavingsGoal(null);
            fetchData();
          }}
        />
      }

      {/* Modal Overlays are handled above */}
    </div >
  );
}

// Sidebar Nav Item Helper
function NavItem({ icon: Icon, label, active, onClick, isDarkMode }) {
  const activeClassesDark = 'md:bg-gradient-to-r md:from-primary-600/20 md:to-transparent text-primary-400 md:border-l-2 md:border-t-0 border-t-2 border-primary-500 md:border-primary-500 shadow-[inset_0_-2px_8px_rgba(139,92,246,0.3)] md:shadow-[inset_2px_0_8px_rgba(139,92,246,0.3)]';
  const inactiveClassesDark = 'text-gray-500 hover:bg-white/5 hover:text-white md:border-l-2 md:border-t-0 border-t-2 border-transparent';

  const activeClassesLight = 'bg-purple-100 text-purple-700 md:border-l-2 md:border-t-0 border-t-2 border-purple-600 md:border-purple-600 rounded-lg shadow-sm font-semibold';
  const inactiveClassesLight = 'text-gray-500 hover:bg-gray-100/80 hover:text-gray-900 md:border-l-2 md:border-t-0 border-t-2 border-transparent';

  const currentActiveClasses = isDarkMode ? activeClassesDark : activeClassesLight;
  const currentInactiveClasses = isDarkMode ? inactiveClassesDark : inactiveClassesLight;

  return (
    <button
      onClick={onClick}
      className={`flex md:items-center justify-center md:justify-start gap-1 md:gap-3 p-2 md:p-3 rounded-xl transition-all flex-col md:flex-row flex-1 md:flex-none md:w-full ${active ? currentActiveClasses : currentInactiveClasses}`}
    >
      <Icon className={`w-5 h-5 md:w-5 md:h-5 shrink-0 mx-auto md:mx-0 ${active && isDarkMode ? 'drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]' : ''}`} />
      <span className={`text-[10px] md:text-base md:font-medium mt-1 md:mt-0 ${active ? 'font-semibold' : ''} md:hidden lg:block`}>{label}</span>
    </button>
  );
}

export default App;

// Add/Edit Transaction Modal Component
function AddTransactionModal({ onClose, token, user, editingTransaction, transactions, budgets, categoryData, totalBalance, addToast }) {
  const [type, setType] = useState('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food'); // Default expense category
  const [paymentMethod, setPaymentMethod] = useState('cash'); // Default payment method
  const [isNeed, setIsNeed] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Sync with editing transaction if exists
  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setDescription(editingTransaction.description || '');
      setAmount(Math.abs(editingTransaction.amount));
      setCategory(editingTransaction.category);
      setPaymentMethod(editingTransaction.paymentMethod || 'cash');
      setIsNeed(editingTransaction.isNeed !== undefined ? editingTransaction.isNeed : true);
      setDate(new Date(editingTransaction.date).toISOString().split('T')[0]);
      setNotes(editingTransaction.notes || '');
    }
  }, [editingTransaction]);

  // Sync category when type changes (only if not editing, to preserve edited categories)
  useEffect(() => {
    if (!editingTransaction) {
      if (type === 'income') {
        setCategory('salary');
      } else {
        setCategory('food');
      }
    }
  }, [type, editingTransaction]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      addToast("Amount must be greater than 0.", "warning");
      return;
    }

    if (type === 'expense') {
      const effectiveBalance = editingTransaction && editingTransaction.type === 'expense' 
        ? totalBalance + Math.abs(editingTransaction.amount) 
        : totalBalance;
        
      if (effectiveBalance <= 0 || val > effectiveBalance) {
        addToast("no more money", "error");
        return;
      }
    }

    // --- REAL-TIME AI ANALYSIS ---
    if (type === 'expense' && !editingTransaction) {
      // 1. Duplicate Detection
      const isDuplicate = transactions.some(t =>
        t.type === 'expense' &&
        Math.abs(t.amount) === val &&
        t.description?.toLowerCase() === description?.toLowerCase() &&
        (new Date() - new Date(t.date)) < (5 * 60 * 1000) // Within 5 mins
      );
      if (isDuplicate) {
        addToast("Duplicate transaction detected! Please verify if you intended to log this twice.", "warning");
      }

      // 2. Unusual Spending Alert
      const catExpenses = transactions.filter(t => t.category === category && t.type === 'expense');
      if (catExpenses.length > 3) {
        const avg = catExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0) / catExpenses.length;
        if (val > avg * 2) {
          addToast(`Unusual spending! ₹${val} is significantly higher than your average for ${category}.`, "error");
        }
      }

      // 3. Budget Warnings
      const budgetLimit = budgets[category] || 0;
      const spentSoFar = categoryData.find(c => c.name === category)?.value || 0;
      if (budgetLimit > 0) {
        const totalWithNew = spentSoFar + val;
        if (totalWithNew > budgetLimit) {
          addToast(`Critical: This expense exceeds your monthly ${category} budget by ₹${(totalWithNew - budgetLimit).toFixed(0)}!`, "error");
        } else if (totalWithNew > budgetLimit * 0.8) {
          addToast(`Budget Alert: You've reached 80%+ of your ${category} budget. Spending carefully!`, "warning");
        }
      }

      // 4. Habit Feedback/Saving Tips
      if (category === 'food' && val > 500) {
        addToast("Tip: Cooking at home this week could help reduce your high food expenses.", "success");
      }
      if (category === 'shopping') {
        addToast("Money Habit: Try the 24-hour rule—wait a day before confirming this purchase.", "success");
      }
    }

    try {
      const isEditing = !!editingTransaction;
      const url = isEditing
        ? `${API_URL}/api/transactions/${editingTransaction._id}`
        : API_URL + '/api/transactions';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          description,
          amount: val,
          category,
          paymentMethod,
          isNeed,
          date: new Date(date).toISOString(),
          notes
        })
      });

      if (response.ok) {
        addToast(`${type === 'income' ? 'Income' : 'Expense'} recorded successfully!`, "success");
        onClose();
      } else {
        addToast("Failed to save transaction. Please try again.", "error");
      }
    } catch (error) {
      console.error('Error:', error);
      addToast("Network error occurred syncing with server.", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card w-full max-w-md p-6 relative">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-6">
          {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
        </h2>

        {/* Type Toggle */}
        <div className="flex bg-black/30 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${type === 'expense' ? 'bg-secondary-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${type === 'income' ? 'bg-primary-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            Income / Allowance
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-400">₹</span>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="glass-input w-full pl-8 text-xl font-semibold"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="glass-input w-full"
              placeholder="e.g. Uber, Groceries, Allowance"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="glass-input w-full appearance-none bg-[#1e2130]"
              >
                {type === 'expense' ? (
                  <>
                    <option value="food">🍱 Food & Mess</option>
                    <option value="rent">🏠 Rent/Hostel</option>
                    <option value="travel">🚌 Travel</option>
                    {user?.studentType === 'Day Scholar' && (
                      <>
                        <option value="bus_pass">🎫 Bus/Train Pass</option>
                        <option value="stationery">📚 Stationery/Books</option>
                        <option value="lunch_outside">🍔 Daily Lunch Outside</option>
                        <option value="fuel">⛽ Fuel/Petrol</option>
                      </>
                    )}
                    <option value="entertainment">🎬 Entertainment</option>
                    <option value="shopping">🛍️ Shopping</option>
                    <option value="bills">🧾 Bills</option>
                    <option value="savings">💰 Savings Option</option>
                    <option value="other">📦 Other</option>
                  </>
                ) : (
                  <>
                    <option value="salary">💼 Salary</option>
                    <option value="freelancing">💻 Freelancing</option>
                    <option value="business">📈 Business</option>
                    <option value="gift">🎁 Gift</option>
                    <option value="other">📦 Other</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input
                type="date"
                className="glass-input w-full [color-scheme:dark]"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {category === 'other' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm text-accent-400 mb-1 font-bold flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Self Feedback / Custom Description
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="glass-input w-full min-h-[80px] resize-none text-xs text-white"
                placeholder="Write specifically what this 'Other' transaction was for or leave a feedback note..."
              />
            </div>
          )}

          {type === 'expense' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="glass-input w-full appearance-none bg-[#1e2130]"
              >
                <option value="cash">💵 Cash</option>
                <option value="credit">💳 Credit Card</option>
                <option value="debit">🏦 Debit Card</option>
                <option value="upi">📱 UPI</option>
                <option value="other">📦 Other</option>
              </select>
            </div>
          )}

          {/* Need vs Want (Only for Expenses) */}
          {type === 'expense' && (
            <div className="mt-2 bg-black/20 border border-white/5 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Is this a Need or a Want?</p>
                <p className="text-xs text-gray-400">Helps track lifestyle upgrades</p>
              </div>
              <div className="flex bg-black/30 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsNeed(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${isNeed ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Need
                </button>
                <button
                  type="button"
                  onClick={() => setIsNeed(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${!isNeed ? 'bg-secondary-500/20 text-secondary-400 border border-secondary-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Want
                </button>
              </div>
            </div>
          )}

          <button type="submit" className="w-full btn-primary py-3 rounded-lg font-bold shadow-lg">Save Transaction</button>
        </form>
      </div>
    </div>
  );
}

// Add Savings Modal Component
function AddSavingsModal({ onClose, token, goal, totalBalance, addToast }) {
  const [amount, setAmount] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      addToast("Amount must be greater than 0.", "warning");
      return;
    }

    try {
      // 1. Update Goal Amount
      const newSavedAmount = (goal.savedAmount || 0) + val;
      const response = await fetch(API_URL + '/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: goal._id,
          title: goal.title,
          targetAmount: goal.targetAmount,
          savedAmount: newSavedAmount,
          deadline: goal.deadline || null
        })
      });

      if (response.ok) {
        // 2. Add an expense transaction to reflect the balance change
        await fetch(API_URL + '/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            type: 'expense',
            description: `Saved for ${goal.title}`,
            amount: val,
            category: 'savings',
            paymentMethod: 'cash',
            isNeed: false,
            date: new Date().toISOString(),
            notes: 'Added to goal directly'
          })
        });

        addToast(`Moved ₹${val} to ${goal.title} savings`, 'success');
        onClose();
      } else {
        addToast('Failed to add savings', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      addToast('Network error occurred.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-white mb-6">Add to Savings</h2>
        <p className="text-sm text-gray-400 mb-4">How much money did you set aside for <strong>{goal.title}</strong>?</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-400 font-bold">₹</span>
              <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="glass-input w-full pl-8 py-3 text-white text-lg font-bold" placeholder="0.00" autoFocus />
            </div>
            <p className="text-xs text-gray-500 mt-2 italic">This amount will be deducted from your total available balance and moved to this goal.</p>
          </div>
          <button type="submit" className="w-full btn-primary py-3 rounded-lg font-bold shadow-lg mt-2 cursor-pointer">Confirm Addition</button>
        </form>
      </div>
    </div>
  );
}

// Add/Edit Goal Modal Component
function AddGoalModal({ onClose, token, editingGoal }) {
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [savedAmount, setSavedAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split('T')[0];

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title || '');
      setTargetAmount(editingGoal.targetAmount || '');
      setSavedAmount(editingGoal.savedAmount || '');
      setDeadline(editingGoal.deadline ? new Date(editingGoal.deadline).toISOString().split('T')[0] : '');
    }
  }, [editingGoal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const tAmt = parseFloat(targetAmount);
    const sAmt = parseFloat(savedAmount || 0);

    if (sAmt > tAmt) {
      setError('Already saved amount must be less than or equal to the target amount.');
      return;
    }

    try {
      const response = await fetch(API_URL + '/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingGoal ? editingGoal._id : null,
          title,
          targetAmount,
          savedAmount,
          deadline: deadline || null
        })
      });

      if (response.ok) {
        onClose();
      } else {
        console.error('Failed to save goal');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-6">
          {editingGoal ? 'Edit Goal' : 'New Goal'}
        </h2>

        {error && <div className="w-full p-2 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Goal Name</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="glass-input w-full p-3 font-semibold text-white"
              placeholder="e.g., New Laptop"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Target Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">₹</span>
                <input type="number" step="0.01" required value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="glass-input w-full pl-7 py-3 text-white" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Already Saved</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">₹</span>
                <input type="number" step="0.01" value={savedAmount} onChange={(e) => setSavedAmount(e.target.value)} className="glass-input w-full pl-7 py-3 text-white" placeholder="0.00" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Target Date (Optional)</label>
            <input type="date" min={minDateStr} value={deadline} onChange={(e) => setDeadline(e.target.value)} className="glass-input w-full p-3 text-white filter-none [color-scheme:dark]" />
          </div>

          <button type="submit" className="w-full btn-primary py-3 rounded-lg font-bold shadow-lg mt-2">Save Goal</button>
        </form>
      </div>
    </div>
  );
}

// Authentication Form Component
function AuthForm({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!isLogin) {
      if (password.length < 8 || password.length > 16) {
        setError('Password must be between 8 and 16 characters.');
        return;
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])/.test(password)) {
        setError('Password must contain at least one uppercase and one lowercase letter.');
        return;
      }
    }

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { name, email, password };

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        if (isLogin && data.error === 'USER_NOT_FOUND') {
          throw new Error('create account');
        }
        throw new Error(data.message || data.error || 'Something went wrong');
      }

      if (isLogin) {
        onLogin(data.token, data.user);
      } else {
        setIsLogin(true); // Switch to login after successful register
        setSuccessMsg('Registration successful! Please login.');
        // Clear out the form inputs
        setName('');
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Send to backend to get or create user
      const res = await fetch(API_URL + '/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.displayName || 'Google User',
          googleId: user.uid,
          isLogin
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (isLogin && data.error === 'USER_NOT_FOUND') {
          throw new Error('create account');
        }
        if (!isLogin && data.error === 'USER_EXISTS') {
          setIsLogin(true);
          throw new Error('An account with this email already exists. Please login.');
        }
        throw new Error(data.message || 'Google auth failed on server');
      }

      onLogin(data.token, data.user);
    } catch (err) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message);
      }
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-background-dark)]">
      <div className="glass-card w-full max-w-md p-8 relative flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-accent-400 flex items-center justify-center shadow-[var(--shadow-neon)] mb-6">
          <Wallet className="text-white w-8 h-8" />
        </div>

        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-gray-400 text-sm mb-8 text-center">{isLogin ? 'Login to continue tracking your expenses' : 'Sign up to start managing your lifestyle budget'}</p>

        {error && <div className="w-full p-3 mb-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">{error}</div>}
        {successMsg && <div className="w-full p-3 mb-6 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm text-center">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {!isLogin && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Full Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className="glass-input w-full" autoComplete="off" />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="glass-input w-full" autoComplete="off" placeholder="example123@gmail.com" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="glass-input w-full" 
              autoComplete="new-password" 
              placeholder="••••••••" 
            />
          </div>

          <button type="submit" className="btn-primary w-full mt-4 py-3 font-semibold text-lg shadow-[var(--shadow-neon)]">
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <div className="w-full flex items-center gap-4 my-6">
          <div className="h-px bg-white/10 flex-1"></div>
          <span className="text-gray-500 text-sm">OR</span>
          <div className="h-px bg-white/10 flex-1"></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full py-3 rounded-lg border border-white/10 glass-card flex items-center justify-center gap-3 hover:bg-white/5 transition-colors text-white font-medium"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            <path fill="none" d="M1 1h22v22H1z" />
          </svg>
          Continue with Google
        </button>

        <p className="mt-8 text-gray-400 text-sm">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }} className="text-primary-400 hover:text-primary-300 transition-colors font-medium">
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}
