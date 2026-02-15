import React, { useState, useEffect } from 'react';
import { AppStep, Segment, AppTab, Article } from './types';
import { transcribeAudio } from './services/geminiService';
import { saveArticle, updateArticleProgress } from './services/storageService';
import StepUpload from './components/StepUpload';
import StepReview from './components/StepReview';
import StepPractice from './components/StepPractice';
import Dashboard from './components/Dashboard';
import VocabularyList from './components/VocabularyList';
import { Headphones, CheckCircle, Home, PlusCircle, Book, Settings, X, Key } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.DASHBOARD);
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.UPLOAD); // For "New Practice" flow
  
  // State for the active session
  const [segments, setSegments] = useState<Segment[]>([]);
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentArticleId, setCurrentArticleId] = useState<string | null>(null);
  const [resumeIndex, setResumeIndex] = useState(0); // Add state for resuming
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // API Key Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    // Load stored key on mount
    const storedKey = localStorage.getItem('GEMINI_API_KEY');
    if (storedKey) setApiKey(storedKey);

    // Cleanup object URL
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleSaveKey = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    setShowSettings(false);
    setErrorMsg(null); // Clear errors if any
    alert("API Key saved successfully!");
  };

  const handleTabChange = (tab: AppTab) => {
    // Reset practice state if leaving practice tabs
    if (tab === AppTab.DASHBOARD || tab === AppTab.VOCABULARY) {
        setAudioFile(null);
        setSegments([]);
        setCurrentArticleId(null);
        setResumeIndex(0);
        setCurrentStep(AppStep.UPLOAD);
    }
    setActiveTab(tab);
  };

  const handleFileSelect = async (file: File) => {
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setIsProcessing(true);
    setErrorMsg(null);

    try {
        const result = await transcribeAudio(file);
        setSegments(result);
        setCurrentStep(AppStep.REVIEW);
    } catch (err: any) {
      const msg = err.message || "An unexpected error occurred.";
      setErrorMsg(msg);
      // Auto-open settings for specific error types
      if (msg.includes("API Key") || msg.includes("429") || msg.includes("Quota")) {
          setShowSettings(true); 
      }
      setAudioFile(null); 
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReviewConfirm = async (updatedSegments: Segment[]) => {
    setSegments(updatedSegments);
    
    // Create new Article Record
    if (audioFile) {
        const newArticle: Article = {
            id: crypto.randomUUID(),
            title: audioFile.name.replace(/\.[^/.]+$/, ""), // remove extension
            createdAt: Date.now(),
            lastPracticed: null,
            nextReview: Date.now(), // Due immediately
            stage: 0,
            segments: updatedSegments,
            currentSegmentIndex: 0, // Initialize progress
            audioBlob: audioFile // Store the raw file in IndexedDB
        };
        
        await saveArticle(newArticle);
        setCurrentArticleId(newArticle.id);
        setResumeIndex(0);
    }

    setCurrentStep(AppStep.PRACTICE);
  };

  const handleSelectArticle = async (article: Article) => {
    // Load article for practice
    if (article.audioBlob) {
        const url = URL.createObjectURL(article.audioBlob);
        setAudioUrl(url);
    } else {
        // Fallback if audio missing (shouldn't happen with IDB)
        alert("Audio file not found in storage.");
        return;
    }
    
    setCurrentArticleId(article.id);
    setResumeIndex(article.currentSegmentIndex || 0); // Resume where left off
    setSegments(article.segments);
    
    setActiveTab(AppTab.PRACTICE_SESSION);
  };

  const handlePracticeComplete = async () => {
    if (currentArticleId) {
        await updateArticleProgress(currentArticleId);
    }
    setCurrentStep(AppStep.COMPLETED);
  };

  const resetPractice = () => {
    setActiveTab(AppTab.DASHBOARD);
    setAudioFile(null);
    setSegments([]);
    setCurrentStep(AppStep.UPLOAD);
    setResumeIndex(0);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 relative">
      
      {/* API Key Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        <Key className="w-5 h-5 mr-2 text-indigo-600" />
                        Settings
                    </h3>
                    <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <p className="text-sm text-gray-500 mb-4">
                    To use the AI features (transcription, translation), you need a Google Gemini API Key. 
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline ml-1 font-medium">
                        Get one here for free.
                    </a>
                </p>

                <div className="mb-6">
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Gemini API Key</label>
                    <input 
                        type="password" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Paste your key here..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-2">
                        Your key is saved locally in your browser. If you get a 429 Error, your key has exceeded the free quota limits. Please wait a minute or use a different Google account.
                    </p>
                </div>

                <div className="flex justify-end space-x-3">
                     <button 
                        onClick={() => setShowSettings(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                     >
                        Cancel
                     </button>
                     <button 
                        onClick={handleSaveKey}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                     >
                        Save Key
                     </button>
                </div>
            </div>
        </div>
      )}

      {/* Header & Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => handleTabChange(AppTab.DASHBOARD)}>
            <div className="bg-indigo-600 p-2 rounded-lg shadow-sm">
                <Headphones className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 hidden md:block">
              Dictation Master
            </h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <nav className="flex space-x-1 overflow-x-auto mr-2">
                <button 
                    onClick={() => handleTabChange(AppTab.DASHBOARD)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === AppTab.DASHBOARD ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <Home className="w-4 h-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                </button>
                <button 
                    onClick={() => handleTabChange(AppTab.VOCABULARY)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === AppTab.VOCABULARY ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <Book className="w-4 h-4" />
                    <span className="hidden sm:inline">Vocabulary</span>
                </button>
                <button 
                    onClick={() => handleTabChange(AppTab.PRACTICE_NEW)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === AppTab.PRACTICE_NEW ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <PlusCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">New Upload</span>
                </button>
            </nav>

            <div className="h-6 w-px bg-gray-200 mx-2"></div>

            <button 
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="API Key Settings"
            >
                <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-start p-6">
        <div className="w-full max-w-6xl">
          
          {errorMsg && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg shadow-sm max-w-4xl mx-auto flex justify-between items-start">
               <div>
                  <h4 className="font-bold text-red-800 text-sm mb-1">Error Occurred</h4>
                  <p className="text-sm text-red-700">{errorMsg}</p>
               </div>
               <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600">
                   <X className="w-4 h-4" />
               </button>
            </div>
          )}

          {/* DASHBOARD TAB */}
          {activeTab === AppTab.DASHBOARD && (
             <Dashboard 
                onSelectArticle={handleSelectArticle} 
                onNewUpload={() => setActiveTab(AppTab.PRACTICE_NEW)}
             />
          )}

          {/* VOCABULARY TAB */}
          {activeTab === AppTab.VOCABULARY && (
             <VocabularyList />
          )}

          {/* UPLOAD / NEW PRACTICE TAB */}
          {activeTab === AppTab.PRACTICE_NEW && (
              <div className="max-w-4xl mx-auto">
                 {/* Progress Steps for Upload Flow */}
                 <div className="flex items-center justify-center space-x-8 text-sm font-medium text-gray-400 mb-8">
                     <div className={`flex items-center space-x-2 ${currentStep === AppStep.UPLOAD ? 'text-indigo-600' : ''}`}>
                        <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">1</span>
                        <span>Upload</span>
                     </div>
                     <div className="w-8 h-px bg-gray-200"></div>
                     <div className={`flex items-center space-x-2 ${currentStep === AppStep.REVIEW ? 'text-indigo-600' : ''}`}>
                        <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">2</span>
                        <span>Review</span>
                     </div>
                     <div className="w-8 h-px bg-gray-200"></div>
                     <div className={`flex items-center space-x-2 ${currentStep === AppStep.PRACTICE ? 'text-indigo-600' : ''}`}>
                        <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">3</span>
                        <span>Practice</span>
                     </div>
                  </div>

                  {currentStep === AppStep.UPLOAD && (
                    <div className="max-w-lg mx-auto">
                        <StepUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
                    </div>
                  )}

                  {currentStep === AppStep.REVIEW && (
                    <StepReview 
                        segments={segments} 
                        audioUrl={audioUrl} 
                        onConfirm={handleReviewConfirm} 
                    />
                  )}

                  {currentStep === AppStep.PRACTICE && (
                    <StepPractice 
                        articleId={currentArticleId}
                        segments={segments} 
                        initialIndex={resumeIndex}
                        audioUrl={audioUrl} 
                        onComplete={handlePracticeComplete} 
                    />
                  )}

                  {currentStep === AppStep.COMPLETED && (
                    <div className="text-center mt-20">
                        <div className="bg-green-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Practice Complete!</h2>
                        <p className="text-gray-500 mb-8">Your progress has been saved. See you at the next interval!</p>
                        <button 
                            onClick={resetPractice}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                  )}
              </div>
          )}

          {/* SESSION FROM DASHBOARD */}
          {activeTab === AppTab.PRACTICE_SESSION && (
              <div className="max-w-4xl mx-auto">
                   {currentStep === AppStep.COMPLETED ? (
                        <div className="text-center mt-20">
                            <div className="bg-green-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="w-12 h-12 text-green-600" />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Review Complete!</h2>
                            <p className="text-gray-500 mb-8">Great job sticking to the schedule.</p>
                            <button 
                                onClick={resetPractice}
                                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                   ) : (
                       <StepPractice 
                            articleId={currentArticleId}
                            segments={segments} 
                            initialIndex={resumeIndex}
                            audioUrl={audioUrl} 
                            onComplete={handlePracticeComplete} 
                       />
                   )}
              </div>
          )}

        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-400">
           Dictation Master • SRS System Active
        </div>
      </footer>
    </div>
  );
};

export default App;