import { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  UploadCloud, 
  FileText, 
  Sparkles, 
  Download, 
  CheckCircle2, 
  Trash2, 
  History, 
  TrendingUp, 
  Layers, 
  Lightbulb, 
  Award, 
  Clock, 
  FileDown, 
  BookMarked,
  HelpCircle,
  AlertCircle,
  Check,
  ChevronRight,
  RefreshCw,
  Mail,
  Lock,
  User,
  LogOut,
  Key,
  Shield,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { BookAnalysisResult, UserProfile } from './types';

// Constants for categories and colors
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  'problem-solving': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'bg-emerald-500' },
  'decision making': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', accent: 'bg-indigo-500' },
  'time management': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', accent: 'bg-amber-500' },
  'default': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', accent: 'bg-blue-500' }
};

// Fun book-mentoring status messages shown during loading
const READING_PHASES = [
  'Skimming document layout and structure...',
  'Extracting core thesis and chapters...',
  'Analyzing text patterns for timeless wisdom...',
  'Distilling actionable work & life skills...',
  'Synthesizing practical systems and habit formulas...',
  'Evaluating competitive rankings in its book category...',
  'Polishing report elements...'
];

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // App state
  const [currentAnalysis, setCurrentAnalysis] = useState<BookAnalysisResult | null>(null);
  const [history, setHistory] = useState<BookAnalysisResult[]>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'insights' | 'blueprint' | 'evaluation'>('summary');
  
  // Habits check list (for interactive habits tracking)
  const [completedHabits, setCompletedHabits] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // User Profile configuration
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    email: 'scholar@gmail.com',
    name: 'Scholar',
    provider: 'email',
  });

  // Fetch usage history from server-side cache memory
  const fetchUserHistory = async (user: UserProfile) => {
    try {
      const identifier = user.email;
      const url = `/api/user/history?email=${encodeURIComponent(identifier)}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.history && data.history.length > 0) {
          setHistory(data.history);
          setCurrentAnalysis(data.history[0]);
          localStorage.setItem('book_analyzer_history', JSON.stringify(data.history));
        } else {
          // If no history on server, check local storage specific to this user
          const localHist = localStorage.getItem(`book_analyzer_history_${identifier}`);
          if (localHist) {
            const parsed = JSON.parse(localHist);
            setHistory(parsed);
            setCurrentAnalysis(parsed[0]);
            // Sync to server cache
            await syncHistoryWithServer(user, parsed);
          } else {
            setHistory([]);
            setCurrentAnalysis(null);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching user history from server cache:', err);
    }
  };

  // Sync usage history with server-side cache memory
  const syncHistoryWithServer = async (user: UserProfile, updatedHistory: BookAnalysisResult[]) => {
    try {
      const identifier = user.email;
      await fetch('/api/user/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: identifier,
          history: updatedHistory
        })
      });
      // Save specific user's history in local cache too
      localStorage.setItem(`book_analyzer_history_${identifier}`, JSON.stringify(updatedHistory));
    } catch (err) {
      console.error('Error syncing history with server cache:', err);
    }
  };

  // Check login session on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('book_analyzer_user');
      let user: UserProfile;
      if (savedUser) {
        user = JSON.parse(savedUser) as UserProfile;
        setCurrentUser(user);
      } else {
        user = {
          email: 'scholar@gmail.com',
          name: 'Scholar',
          provider: 'email',
        };
        localStorage.setItem('book_analyzer_user', JSON.stringify(user));
      }
      fetchUserHistory(user);
    } catch (e) {
      console.error('Failed to load user from localStorage', e);
    }
  }, []);

  // Reset session and clear analysis history from cache memory
  const handleResetSession = async () => {
    try {
      const identifier = currentUser.email;
      await fetch('/api/user/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: identifier,
          history: []
        })
      });
      localStorage.removeItem(`book_analyzer_history_${identifier}`);
    } catch (e) {
      console.error('Error clearing history on server:', e);
    }
    localStorage.removeItem('book_analyzer_history');
    setHistory([]);
    setCurrentAnalysis(null);
  };

  // Save history to local state and sync with cache memory
  const saveToHistory = (newAnalysis: BookAnalysisResult) => {
    try {
      const updatedHistory = [
        newAnalysis,
        ...history.filter(item => item.title.toLowerCase() !== newAnalysis.title.toLowerCase())
      ].slice(0, 10); // Keep top 10 items
      setHistory(updatedHistory);
      localStorage.setItem('book_analyzer_history', JSON.stringify(updatedHistory));
      
      if (currentUser) {
        syncHistoryWithServer(currentUser, updatedHistory);
      }
    } catch (e) {
      console.error('Failed to save to history', e);
    }
  };

  // Cycle loading phrases
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingPhaseIndex((prev) => (prev + 1) % READING_PHASES.length);
      }, 3500);
    } else {
      setLoadingPhaseIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Handle drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['pdf', 'txt', 'docx'];
    if (validExtensions.includes(extension || '')) {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Please upload a valid file format: .pdf, .txt, or .docx');
    }
  };

  // Submit book for analysis (Uploaded File)
  const handleAnalyzeUpload = async () => {
    if (!selectedFile) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/analyze-book', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Server error occurred during analysis.';
        try {
          const errData = await response.json();
          errorMessage = errData.error || errorMessage;
        } catch (_) {
          // Response is not JSON (probably HTML or raw text due to proxy timeout or crash)
          try {
            const rawText = await response.text();
            if (rawText.includes('<pre>')) {
              const preMatch = rawText.match(/<pre>([\s\S]*?)<\/pre>/);
              if (preMatch) errorMessage = preMatch[1].trim();
            } else if (rawText.includes('Gateway Timeout') || response.status === 504) {
              errorMessage = 'The analysis request timed out. We are optimizing our models to generate responses faster. Please try again.';
            } else if (rawText.length < 200 && rawText.trim()) {
              errorMessage = rawText.trim();
            }
          } catch (textErr) {
            console.error('Failed to parse text error body:', textErr);
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const finalResult: BookAnalysisResult = {
        ...result,
        analyzedAt: new Date().toISOString()
      };

      setCurrentAnalysis(finalResult);
      saveToHistory(finalResult);
      setActiveTab('summary');
      setSelectedFile(null); // Clear input
    } catch (err: any) {
      setError(err.message || 'An error occurred while uploading and analyzing the book.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit book for analysis (Sample Pre-Sets)
  const handleAnalyzeSample = async (sampleId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analyze-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleId }),
      });

      if (!response.ok) {
        let errorMessage = 'Server error occurred.';
        try {
          const errData = await response.json();
          errorMessage = errData.error || errorMessage;
        } catch (_) {
          // Response is not JSON (probably HTML or raw text due to proxy timeout or crash)
          try {
            const rawText = await response.text();
            if (rawText.includes('<pre>')) {
              const preMatch = rawText.match(/<pre>([\s\S]*?)<\/pre>/);
              if (preMatch) errorMessage = preMatch[1].trim();
            } else if (rawText.includes('Gateway Timeout') || response.status === 504) {
              errorMessage = 'The analysis request timed out. We are optimizing our models to generate responses faster. Please try again.';
            } else if (rawText.length < 200 && rawText.trim()) {
              errorMessage = rawText.trim();
            }
          } catch (textErr) {
            console.error('Failed to parse text error body:', textErr);
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const finalResult: BookAnalysisResult = {
        ...result,
        analyzedAt: new Date().toISOString()
      };

      setCurrentAnalysis(finalResult);
      saveToHistory(finalResult);
      setActiveTab('summary');
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading the sample book.');
    } finally {
      setIsLoading(false);
    }
  };

  // Select item from local history list
  const selectFromHistory = (item: BookAnalysisResult) => {
    setCurrentAnalysis(item);
    setActiveTab('summary');
  };

  // Delete item from local history list
  const deleteFromHistory = (e: React.MouseEvent, titleToDelete: string) => {
    e.stopPropagation();
    const updated = history.filter(item => item.title !== titleToDelete);
    setHistory(updated);
    localStorage.setItem('book_analyzer_history', JSON.stringify(updated));
    if (currentAnalysis?.title === titleToDelete) {
      setCurrentAnalysis(updated.length > 0 ? updated[0] : null);
    }
  };

  // Toggle habit checkbox (Interactive habits checklist)
  const toggleHabit = (habitText: string) => {
    setCompletedHabits(prev => ({
      ...prev,
      [habitText]: !prev[habitText]
    }));
  };

  // Helper to get matching category styling
  const getCategoryStyles = (categoryName?: string) => {
    const key = (categoryName || '').toLowerCase();
    if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
    
    // Check containing substring
    for (const colorKey of Object.keys(CATEGORY_COLORS)) {
      if (key.includes(colorKey)) return CATEGORY_COLORS[colorKey];
    }
    
    return CATEGORY_COLORS['default'];
  };

  // Download Report as formatted Markdown File (.md)
  const downloadReport = () => {
    if (!currentAnalysis) return;

    const { title, author, category, summary, timelessInsights, practicalApplication, top5Evaluation } = currentAnalysis;

    const markdownText = `# BOOK INSIGHT REPORT: ${title.toUpperCase()}
By ${author}
Category: ${category}
Analyzed on: ${new Date(currentAnalysis.analyzedAt).toLocaleDateString()}

---

## 📖 EXECUTIVE SUMMARY
${summary}

---

## 💡 TIMELESS INSIGHTS
${timelessInsights.map((ins, idx) => `
### Insight ${idx + 1}: ${ins.insight}
* **Wisdom**: ${ins.description}
* **Actionable Takeaway**: ${ins.actionableTakeaway}
`).join('\n')}

---

## 🛠️ PRACTICAL MASTER MASTER BLUEPRINT

### Daily/Weekly Habits
${practicalApplication.habits.map(h => `- [ ] ${h}`).join('\n')}

### Core Rituals
${practicalApplication.rituals.map(r => `- [ ] ${r}`).join('\n')}

### Systems & Trackers
${practicalApplication.systems.map(s => `- [ ] ${s}`).join('\n')}

### Guiding Decision Principles
${practicalApplication.principles.map(p => `- * ${p}`).join('\n')}

---

## 🏆 CATEGORY EVALUATION: TOP 5 ASSESSMENT
* **Is it a Top 5 Book in its category?**: ${top5Evaluation.isTop5 ? 'YES' : 'NO'}
* **Justification**:
${top5Evaluation.rankingJustification}

---
*Generated by Book Insight Analyzer. Powered by Google Gemini.*
`;

    const blob = new Blob([markdownText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_insights_report.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const catStyle = getCategoryStyles(currentAnalysis?.category);



  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-tight text-slate-900">
                Book Insight Analyzer
              </h1>
              <p className="text-xs text-slate-500 font-mono">DISTILL WISDOM • DEVELOP HABITS • MASTER SKILLS</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-200 p-1.5 pr-3 rounded-full">
              {currentUser.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name} 
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-indigo-200" 
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-200">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-800 leading-none">{currentUser.name}</p>
                <p className="text-[9px] text-slate-400 font-mono leading-none mt-1">{currentUser.email}</p>
              </div>
            </div>

            <button
              onClick={handleResetSession}
              className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-lg transition-colors cursor-pointer"
              title="Reset Workspace History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
        
        {/* LEFT PANEL: UPLOAD AND DEMO PRESETS */}
        <section className="w-full lg:w-[350px] shrink-0 flex flex-col gap-6">
          
          {/* UPLOAD CONTAINER CARD */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs" id="upload_box">
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center space-x-2">
              <UploadCloud className="w-4 h-4 text-indigo-600" />
              <span>Upload Book Document</span>
            </h2>
            
            {/* Drag Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors flex flex-col items-center justify-center ${
                isDragOver 
                  ? 'border-indigo-500 bg-indigo-50/50' 
                  : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <FileText className="w-10 h-10 text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-700">Drag & Drop Book File</p>
              <p className="text-[10px] text-slate-400 mt-1">Accepts PDF, TXT, or DOCX formats</p>
            </div>

            {/* Selected File Status */}
            {selectedFile && (
              <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate">
                  <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="text-xs text-slate-600 font-medium truncate">{selectedFile.name}</span>
                </div>
                <button 
                  onClick={() => setSelectedFile(null)} 
                  className="text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  <span className="text-sm font-bold">×</span>
                </button>
              </div>
            )}

            {/* Run Analysis Button */}
            <button
              onClick={handleAnalyzeUpload}
              disabled={!selectedFile || isLoading}
              className={`w-full mt-3.5 py-2.5 px-4 rounded-lg font-medium text-xs flex items-center justify-center space-x-2 transition-all ${
                selectedFile && !isLoading
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-98 shadow-sm cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? 'Analyzing File...' : 'Begin Mentorship Analysis'}</span>
            </button>
          </div>

          {/* QUICK DEMOS CARD */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900 mb-2.5 flex items-center space-x-2">
              <BookMarked className="w-4 h-4 text-emerald-600" />
              <span>Instant Sample Books</span>
            </h2>
            <p className="text-xs text-slate-500 mb-3.5">
              Select an industry-standard book to preview distillation results instantly:
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleAnalyzeSample('atomic-habits')}
                disabled={isLoading}
                className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 transition-all text-xs font-medium flex items-center justify-between group"
              >
                <div>
                  <p className="text-slate-800 font-semibold group-hover:text-indigo-700">Atomic Habits</p>
                  <p className="text-[10px] text-slate-400">James Clear • Time / Habit</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => handleAnalyzeSample('thinking-fast-and-slow')}
                disabled={isLoading}
                className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 transition-all text-xs font-medium flex items-center justify-between group"
              >
                <div>
                  <p className="text-slate-800 font-semibold group-hover:text-indigo-700">Thinking, Fast and Slow</p>
                  <p className="text-[10px] text-slate-400">Daniel Kahneman • Decision Making</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => handleAnalyzeSample('deep-work')}
                disabled={isLoading}
                className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 transition-all text-xs font-medium flex items-center justify-between group"
              >
                <div>
                  <p className="text-slate-800 font-semibold group-hover:text-indigo-700">Deep Work</p>
                  <p className="text-[10px] text-slate-400">Cal Newport • Time / Focus</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => handleAnalyzeSample('the-7-habits')}
                disabled={isLoading}
                className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 transition-all text-xs font-medium flex items-center justify-between group"
              >
                <div>
                  <p className="text-slate-800 font-semibold group-hover:text-indigo-700">The 7 Habits</p>
                  <p className="text-[10px] text-slate-400">Stephen Covey • Life Skills</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* ANALYSIS HISTORY */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <h2 className="text-sm font-semibold text-slate-900 mb-2.5 flex items-center space-x-2">
                <History className="w-4 h-4 text-indigo-500" />
                <span>Your Analysis History ({history.length})</span>
              </h2>
              <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {history.map((item, index) => {
                  const isCurrent = currentAnalysis?.title === item.title;
                  return (
                    <div
                      key={index}
                      onClick={() => selectFromHistory(item)}
                      className={`group p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                        isCurrent 
                          ? 'bg-indigo-50/70 border border-indigo-100 text-indigo-800' 
                          : 'hover:bg-slate-100/70 border border-transparent text-slate-600'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <p className="font-semibold truncate">{item.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{item.author}</p>
                      </div>
                      <button
                        onClick={(e) => deleteFromHistory(e, item.title)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors duration-150"
                        title="Delete from history"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </section>

        {/* RIGHT PANEL: DISPLAY VIEWPORTS / STATES */}
        <section className="flex-1 flex flex-col min-w-0">
          
          {/* ERROR BAR */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 text-red-800 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Analysis Issue</p>
                <p className="text-xs text-red-700/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* VIEWPORTS */}
          <div className="flex-1 flex flex-col">
            
            {/* 1. LOADING STATE */}
            {isLoading && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 flex-1 flex flex-col items-center justify-center text-center shadow-xs min-h-[450px]">
                <div className="relative w-16 h-16 mb-6">
                  {/* Outer spinning ring */}
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin"></div>
                  {/* Inner pulsing circle */}
                  <div className="absolute inset-2.5 rounded-full bg-indigo-50 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-indigo-600 animate-pulse" />
                  </div>
                </div>

                <h3 className="text-lg font-bold font-display text-slate-900 mb-1">
                  Mentor Reading in Progress...
                </h3>
                <p className="text-xs font-mono text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full font-medium mb-6">
                  {READING_PHASES[loadingPhaseIndex]}
                </p>

                {/* Simulated feedback */}
                <div className="max-w-md bg-slate-50 border border-slate-100 rounded-xl p-4 text-left">
                  <h4 className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 mr-1.5" />
                    How Gemini Analyzes Books
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    We process document text through advanced semantic mapping, extracting key arguments, categorizing the focus, mapping structured habit rituals, and benchmarking relevance against other major literature in the field. This distills hours of reading into an actionable career and life blueprint.
                  </p>
                </div>
              </div>
            )}

            {/* 2. EMPTY STATE */}
            {!isLoading && !currentAnalysis && (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 flex-1 flex flex-col items-center justify-center text-center shadow-xs min-h-[450px]">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-5">
                  <BookOpen className="w-8 h-8" />
                </div>
                
                <h3 className="text-xl font-bold font-display text-slate-900 mb-2">
                  No Book Selected
                </h3>
                <p className="text-slate-500 text-sm max-w-lg mb-8 leading-relaxed">
                  Upload a book file (.pdf, .txt, .docx) on the left panel or choose one of our preset classics to unlock complete executive summaries, timeless insights, customized habits, and rigorous evaluations.
                </p>

                {/* Guide Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl w-full">
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-left">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 mb-3">
                      <Lightbulb className="w-4.5 h-4.5" />
                    </div>
                    <h4 className="text-xs font-semibold text-slate-800 mb-1">Distill Insights</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed">Extract deep core lessons and eliminate fluff from voluminous readings.</p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-left">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 mb-3">
                      <Layers className="w-4.5 h-4.5" />
                    </div>
                    <h4 className="text-xs font-semibold text-slate-800 mb-1">Action Blueprint</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed">Convert theoretical wisdom into clear habits, morning rituals, and tracking systems.</p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-left">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-3">
                      <Award className="w-4.5 h-4.5" />
                    </div>
                    <h4 className="text-xs font-semibold text-slate-800 mb-1">Rigorous Evaluation</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed">Assess the book's value compared to other global canonical text categories.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. CORE RESULTS RENDER */}
            {!isLoading && currentAnalysis && (
              <div className="flex-1 flex flex-col gap-6 animate-fadeIn">
                
                {/* ACTIVE BOOK OVERVIEW CARD */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs relative overflow-hidden">
                  {/* Decorative background accent colored by category */}
                  <div className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-2xl opacity-10 ${catStyle?.accent}`}></div>
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2.5">
                        <span className={`text-[10px] font-mono tracking-wider uppercase font-semibold px-2.5 py-0.5 rounded-full border ${catStyle?.bg} ${catStyle?.text} ${catStyle?.border}`}>
                          {currentAnalysis.category}
                        </span>
                        {currentAnalysis.wasTruncated && (
                          <span className="text-[9px] font-mono bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                            Truncated for Context Optimization
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-bold font-display text-slate-900 tracking-tight leading-tight">
                        {currentAnalysis.title}
                      </h2>
                      <p className="text-sm text-slate-500">
                        Written by <strong className="text-slate-700 font-semibold">{currentAnalysis.author}</strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        onClick={downloadReport}
                        className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium inline-flex items-center space-x-1.5 transition-colors shadow-xs active:scale-98 cursor-pointer"
                        title="Download Markdown Report"
                      >
                        <FileDown className="w-4 h-4" />
                        <span>Download Insights</span>
                      </button>
                    </div>
                  </div>

                  {/* Tiny metadata strip */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-1.5 text-[10px] font-mono text-slate-400">
                    <span className="flex items-center">
                      <FileText className="w-3.5 h-3.5 mr-1" />
                      Analyzed: {currentAnalysis.fileAnalyzed}
                    </span>
                    {currentAnalysis.charCount && (
                      <span className="flex items-center">
                        <TrendingUp className="w-3.5 h-3.5 mr-1" />
                        Source Characters: {currentAnalysis.charCount.toLocaleString()}
                      </span>
                    )}
                    <span className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      Analyzed At: {new Date(currentAnalysis.analyzedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* TAB SELECTOR */}
                <div className="bg-slate-200/60 p-1 rounded-xl flex space-x-1">
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === 'summary'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
                    }`}
                  >
                    📖 Summary
                  </button>
                  <button
                    onClick={() => setActiveTab('insights')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === 'insights'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
                    }`}
                  >
                    💡 Timeless Insights
                  </button>
                  <button
                    onClick={() => setActiveTab('blueprint')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === 'blueprint'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
                    }`}
                  >
                    🛠️ Action Blueprint
                  </button>
                  <button
                    onClick={() => setActiveTab('evaluation')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === 'evaluation'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
                    }`}
                  >
                    🏆 Top 5 Rating
                  </button>
                </div>

                {/* ACTIVE TAB CONTENT WINDOW */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 flex-1 shadow-xs min-h-[350px]">
                  
                  {/* TAB A: SUMMARY */}
                  {activeTab === 'summary' && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 text-slate-800 border-b border-slate-100 pb-3">
                        <BookOpen className="w-5 h-5 text-indigo-500" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider font-mono">Executive Book Summary</h3>
                      </div>
                      <div className="markdown-body p-1 leading-relaxed">
                        <ReactMarkdown>{currentAnalysis.summary}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* TAB B: TIMELESS INSIGHTS */}
                  {activeTab === 'insights' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center space-x-2 text-slate-800">
                          <Lightbulb className="w-5 h-5 text-amber-500" />
                          <h3 className="text-sm font-semibold uppercase tracking-wider font-mono">Distilled Timeless Insights</h3>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {currentAnalysis.timelessInsights.length} actionable insights extracted
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-5">
                        {currentAnalysis.timelessInsights.map((ins, idx) => (
                          <div 
                            key={idx} 
                            className="p-5 border border-slate-150 rounded-xl bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-200 hover:shadow-xs transition-all relative overflow-hidden group"
                          >
                            <span className="absolute top-3 right-4 font-mono text-3xl font-bold text-slate-200/70 group-hover:text-indigo-100 transition-colors">
                              0{idx + 1}
                            </span>
                            
                            <h4 className="text-sm font-bold text-slate-950 pr-8 flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2 shrink-0"></span>
                              {ins.insight}
                            </h4>
                            
                            <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                              {ins.description}
                            </p>

                            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-start space-x-2 bg-indigo-50/40 p-2.5 rounded-lg">
                              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[10px] font-mono text-indigo-600 font-bold uppercase tracking-wider">Actionable Takeaway</span>
                                <p className="text-xs text-indigo-900 font-medium mt-0.5">{ins.actionableTakeaway}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB C: ACTION BLUEPRINT */}
                  {activeTab === 'blueprint' && (
                    <div className="space-y-6">
                      <div className="flex items-center space-x-2 text-slate-800 border-b border-slate-100 pb-3">
                        <Layers className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider font-mono">Mastery & Application Roadmap</h3>
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                        Translate theoretical concepts directly into daily living. Use this checklist to adopt newly discovered habits and systems derived from the book:
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Habits Checklist */}
                        <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                          <h4 className="text-xs font-bold font-mono text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 flex items-center justify-between">
                            <span>Daily Habits to cultivate</span>
                            <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-normal font-mono">Active Focus</span>
                          </h4>
                          <div className="space-y-2.5">
                            {currentAnalysis.practicalApplication.habits.map((habit, hIdx) => (
                              <div 
                                key={hIdx} 
                                onClick={() => toggleHabit(habit)}
                                className="flex items-start space-x-2.5 cursor-pointer select-none group"
                              >
                                <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-all ${
                                  completedHabits[habit] 
                                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                                    : 'border-slate-300 group-hover:border-indigo-400 bg-white'
                                }`}>
                                  {completedHabits[habit] && <Check className="w-3 h-3" />}
                                </div>
                                <span className={`text-xs leading-relaxed ${
                                  completedHabits[habit] ? 'line-through text-slate-400' : 'text-slate-600'
                                }`}>
                                  {habit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Rituals List */}
                        <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                          <h4 className="text-xs font-bold font-mono text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 flex items-center">
                            <span>Established Rituals</span>
                          </h4>
                          <div className="space-y-3">
                            {currentAnalysis.practicalApplication.rituals.map((ritual, rIdx) => (
                              <div key={rIdx} className="flex items-start space-x-2">
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5">R{rIdx + 1}</span>
                                <span className="text-xs text-slate-600 leading-relaxed">{ritual}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Systems & Trackers */}
                        <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                          <h4 className="text-xs font-bold font-mono text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 flex items-center">
                            <span>Process Systems</span>
                          </h4>
                          <div className="space-y-3">
                            {currentAnalysis.practicalApplication.systems.map((system, sIdx) => (
                              <div key={sIdx} className="flex items-start space-x-2">
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-mono font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5">S{sIdx + 1}</span>
                                <span className="text-xs text-slate-600 leading-relaxed">{system}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Guiding Principles */}
                        <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                          <h4 className="text-xs font-bold font-mono text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 flex items-center">
                            <span>Mindset Principles</span>
                          </h4>
                          <div className="space-y-3">
                            {currentAnalysis.practicalApplication.principles.map((principle, pIdx) => (
                              <div key={pIdx} className="flex items-start space-x-2.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
                                <span className="text-xs text-slate-600 leading-relaxed italic">"{principle}"</span>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* TAB D: EVALUATION */}
                  {activeTab === 'evaluation' && (
                    <div className="space-y-6">
                      <div className="flex items-center space-x-2 text-slate-800 border-b border-slate-100 pb-3">
                        <Award className="w-5 h-5 text-indigo-500" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider font-mono">Top 5 Category Assessment</h3>
                      </div>

                      <div className="flex flex-col md:flex-row gap-6 items-start">
                        
                        {/* Rating Badge */}
                        <div className={`p-5 rounded-2xl border text-center shrink-0 w-full md:w-48 flex flex-col items-center justify-center ${
                          currentAnalysis.top5Evaluation.isTop5 
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800' 
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                            currentAnalysis.top5Evaluation.isTop5 
                              ? 'bg-emerald-500 text-white shadow-sm' 
                              : 'bg-slate-200 text-slate-500'
                          }`}>
                            <Award className="w-6 h-6" />
                          </div>
                          
                          <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Category Rank</span>
                          <span className="text-xl font-bold mt-1">
                            {currentAnalysis.top5Evaluation.isTop5 ? 'Top 5 Elite' : 'Honorable Mention'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 mt-1 capitalize">In {currentAnalysis.category}</span>
                        </div>

                        {/* Ranking Justification text */}
                        <div className="flex-1 bg-slate-50/60 rounded-xl p-5 border border-slate-100 leading-relaxed">
                          <h4 className="text-xs font-bold font-mono text-slate-700 uppercase tracking-wider mb-2.5">Justification and Literary Benchmarking</h4>
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                            {currentAnalysis.top5Evaluation.rankingJustification}
                          </p>
                        </div>

                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-mono">
          <p>© {new Date().getFullYear()} Book Insight Analyzer. All rights reserved.</p>
          <div className="flex space-x-4">
            <span>Powered by Gemini 3.5 Flash</span>
            <span>•</span>
            <span>Made with React & Express</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
