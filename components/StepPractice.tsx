import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Segment, VocabularyItem } from '../types';
import { saveVocabulary, saveArticle, getArticleById } from '../services/storageService';
import { lookupWord } from '../services/geminiService';
import { Play, Pause, Check, ArrowRight, SkipForward, CheckCircle, Volume2, AlertCircle, Lightbulb, Languages, BookmarkPlus, Loader2, X } from 'lucide-react';

interface StepPracticeProps {
  articleId: string | null;
  segments: Segment[];
  initialIndex: number;
  audioUrl: string | null;
  onComplete: () => void;
}

const StepPractice: React.FC<StepPracticeProps> = ({ articleId, segments, initialIndex, audioUrl, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<'neutral' | 'correct' | 'incorrect'>('neutral');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Word Lookup State
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [lookupData, setLookupData] = useState<Omit<VocabularyItem, 'id' | 'savedAt'> | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentSegment = segments[currentIndex];
  const progress = useMemo(() => ((currentIndex) / segments.length) * 100, [currentIndex, segments.length]);

  // Clean text for comparison (removes punctuation, extra spaces, lowercase)
  const cleanText = (text: string) => {
    return text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "").replace(/\s{2,}/g, " ").trim();
  };

  // Get array of words preserving original casing/punctuation for display, but cleaned for comparison
  const getTargetWords = () => {
      return currentSegment.text.trim().split(/\s+/);
  };

  const playSegment = () => {
    if (!audioRef.current || !currentSegment) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    audioRef.current.currentTime = currentSegment.start;
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        setIsPlaying(true);
      }).catch(error => console.error("Playback failed:", error));
    }
  };

  const forcePlay = () => {
    if (!audioRef.current || !currentSegment) return;
    audioRef.current.currentTime = currentSegment.start;
    audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
  }

  // Watch for timeupdate to stop at end of segment
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (currentSegment && audio.currentTime >= currentSegment.end) {
        audio.pause();
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [currentSegment]);

  // Reset state on index change
  useEffect(() => {
    setUserInput('');
    setFeedback('neutral');
    setSelectedWord(null);
    setLookupData(null);
    setSavedWords(new Set()); 
    if (inputRef.current) {
      inputRef.current.focus();
    }
    const timer = setTimeout(() => forcePlay(), 600);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  const calculateMatchIndex = () => {
    const targetWords = getTargetWords();
    const userWords = userInput.trim().split(/\s+/);
    
    let matchIndex = 0;
    for (let i = 0; i < targetWords.length; i++) {
        // If user hasn't typed this far, stop
        if (i >= userWords.length) break;

        const tWordClean = cleanText(targetWords[i]);
        const uWordClean = cleanText(userWords[i]);

        if (tWordClean === uWordClean) {
            matchIndex++;
        } else {
            // First mismatch found
            break;
        }
    }
    return matchIndex;
  };

  const checkAnswer = () => {
    const expected = cleanText(currentSegment.text);
    const actual = cleanText(userInput);

    if (expected === actual) {
      setFeedback('correct');
    } else {
      setFeedback('incorrect');
    }
  };

  const saveProgress = async (nextIndex: number) => {
    if (!articleId) return;
    const article = await getArticleById(articleId);
    if (article) {
        article.currentSegmentIndex = nextIndex;
        article.lastPracticed = Date.now();
        await saveArticle(article);
    }
  };

  const handleNext = async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < segments.length) {
      await saveProgress(nextIndex);
      setCurrentIndex(nextIndex);
    } else {
      await saveProgress(0); // Reset for next review
      onComplete();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (feedback === 'correct') {
        handleNext();
      } else {
        checkAnswer();
      }
    }
  };

  // --- Vocabulary Lookup Logic ---

  const handleWordClick = async (word: string) => {
    const cleanWord = word.replace(/[^\w\s']/g, "");
    if (!cleanWord) return;

    setSelectedWord(cleanWord);
    setIsLookingUp(true);
    setLookupData(null); // Reset previous data

    // Call Gemini API
    const data = await lookupWord(cleanWord, currentSegment.text);
    
    setLookupData({
        word: cleanWord,
        originalSentence: currentSegment.text,
        ...data
    });
    setIsLookingUp(false);
  };

  const confirmSaveWord = async () => {
    if (!lookupData) return;
    
    const newItem: VocabularyItem = {
        id: crypto.randomUUID(),
        word: lookupData.word,
        originalSentence: lookupData.originalSentence,
        translation: lookupData.translation,
        definition: lookupData.definition,
        ipa: lookupData.ipa,
        examples: lookupData.examples,
        savedAt: Date.now()
    };

    await saveVocabulary(newItem);
    setSavedWords(prev => new Set(prev).add(lookupData.word));
    setSelectedWord(null); // Close popover
  };

  // Global shortcuts
  useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Control' && !e.repeat) {
              forcePlay();
          }
      };
      
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentIndex, currentSegment]);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-full max-w-4xl mx-auto flex flex-col md:flex-row h-[600px] relative">
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}

      {/* Lookup Popover */}
      {selectedWord && (
        <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50">
                    <h3 className="text-lg font-bold text-indigo-900 capitalize">{selectedWord}</h3>
                    <button onClick={() => setSelectedWord(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6">
                    {isLookingUp ? (
                        <div className="flex flex-col items-center justify-center py-6 space-y-3">
                             <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                             <p className="text-sm text-gray-500">Analyzing word context...</p>
                        </div>
                    ) : lookupData ? (
                        <div className="space-y-4">
                            <div className="flex items-baseline space-x-2">
                                <span className="text-gray-500 font-mono text-sm">/{lookupData.ipa}/</span>
                                <span className="font-bold text-gray-800">{lookupData.translation}</span>
                            </div>
                            
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase">Definition</p>
                                <p className="text-sm text-gray-700 leading-relaxed">{lookupData.definition}</p>
                            </div>

                            {lookupData.examples.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Example</p>
                                    <p className="text-sm text-gray-600 italic border-l-2 border-indigo-200 pl-2">
                                        "{lookupData.examples[0]}"
                                    </p>
                                </div>
                            )}

                            <button 
                                onClick={confirmSaveWord}
                                className="w-full mt-4 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center space-x-2"
                            >
                                <BookmarkPlus className="w-4 h-4" />
                                <span>Save to Vocabulary</span>
                            </button>
                        </div>
                    ) : (
                         <p className="text-red-500 text-center">Failed to load data.</p>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Left Panel */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-8 md:w-1/3 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white opacity-10 rounded-full blur-xl"></div>
        <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-40 h-40 bg-pink-500 opacity-20 rounded-full blur-xl"></div>

        <div>
            <h3 className="text-indigo-100 font-medium uppercase tracking-wider text-xs mb-2">Progress</h3>
            <div className="text-4xl font-bold mb-1">{Math.round(progress)}%</div>
            <div className="w-full bg-black/20 rounded-full h-1.5 mb-6">
                <div 
                    className="bg-white h-1.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <p className="text-indigo-100 text-sm">Sentence {currentIndex + 1} of {segments.length}</p>
        </div>

        <div className="space-y-4 z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="bg-white text-indigo-600 p-1.5 rounded">
                        <Volume2 className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-sm">Shortcuts</span>
                </div>
                <div className="text-xs text-indigo-100 space-y-1">
                    <p><kbd className="bg-black/20 px-1.5 py-0.5 rounded font-mono">Ctrl</kbd> Replay Audio</p>
                    <p><kbd className="bg-black/20 px-1.5 py-0.5 rounded font-mono">Enter</kbd> Check / Next</p>
                </div>
            </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 p-8 md:p-12 flex flex-col bg-white relative">
        <div className="flex justify-center mb-8">
            <button
                onClick={playSegment}
                className={`group relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-xl ${
                    isPlaying 
                    ? 'bg-amber-100 text-amber-600 scale-95' 
                    : 'bg-indigo-600 text-white hover:scale-105 hover:bg-indigo-700'
                }`}
            >
                {isPlaying ? (
                     <span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-amber-400 opacity-20"></span>
                ) : null}
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </button>
        </div>

        <div className="flex-1 flex flex-col justify-start space-y-2">
            <div className="relative w-full">
                <textarea
                    ref={inputRef}
                    value={userInput}
                    onChange={(e) => {
                        setUserInput(e.target.value);
                        if (feedback !== 'neutral') {
                             setFeedback('neutral');
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type what you hear..."
                    className={`w-full p-6 text-2xl font-medium text-gray-800 bg-gray-50 border-2 rounded-2xl outline-none resize-none transition-all duration-200 min-h-[160px] leading-relaxed
                        ${feedback === 'correct' ? 'border-green-400 bg-green-50/30' : 
                          feedback === 'incorrect' ? 'border-red-300 bg-red-50/30' : 
                          'border-transparent focus:border-indigo-300 focus:bg-white focus:shadow-lg'}`}
                    spellCheck="false"
                />
            </div>

            <div className="min-h-[120px] w-full flex items-start justify-center pt-2">
                {feedback === 'correct' && (
                    <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-2 w-full">
                        <div className="flex items-center space-x-3 mb-3">
                             <div className="text-green-600 flex items-center space-x-2 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                <CheckCircle className="w-4 h-4" />
                                <span className="font-bold text-sm">Correct!</span>
                            </div>
                        </div>

                        {/* Interactive Text Display - Correct Mode */}
                        <div className="text-xl text-gray-800 font-semibold text-center flex flex-wrap justify-center gap-x-1.5 leading-relaxed max-h-32 overflow-y-auto px-4">
                             {getTargetWords().map((word, idx) => {
                                 const cleanWord = word.replace(/[^\w\s']/g, "");
                                 const isSaved = savedWords.has(cleanWord);
                                 return (
                                     <span 
                                        key={idx}
                                        onClick={() => handleWordClick(word)}
                                        className={`cursor-pointer transition-all duration-200 rounded px-1 -mx-1 border-b-2
                                            ${isSaved 
                                                ? 'bg-green-100 text-green-800 border-green-300' 
                                                : 'border-transparent hover:bg-indigo-100 hover:text-indigo-600 hover:border-indigo-300'}
                                        `}
                                     >
                                         {word}
                                     </span>
                                 )
                             })}
                        </div>
                        
                        {currentSegment.translation && (
                             <div className="mt-2 text-gray-500 italic text-sm flex items-center">
                                <Languages className="w-3 h-3 mr-1.5" />
                                {currentSegment.translation}
                             </div>
                        )}

                        <p className="text-xs text-gray-400 mt-3">Press Enter to continue</p>
                    </div>
                )}
                
                {feedback === 'incorrect' && (
                    <div className="w-full animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-center space-x-2 mb-3 text-red-600">
                            <AlertCircle className="w-5 h-5" />
                            <span className="font-bold">Check your spelling</span>
                        </div>
                        
                        {/* Interactive Hint Display */}
                        <div className="flex flex-wrap justify-center items-center gap-2 text-xl px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 font-medium">
                            {(() => {
                                const targetWords = getTargetWords();
                                const matchIndex = calculateMatchIndex();
                                
                                return targetWords.map((word, idx) => {
                                    if (idx < matchIndex) {
                                        // Matched word (Green)
                                        return <span key={idx} className="text-green-600">{word}</span>;
                                    } else if (idx === matchIndex) {
                                        // First mismatch (Red - The Hint)
                                        return <span key={idx} className="text-red-500 underline decoration-2 decoration-red-300">{word}</span>;
                                    } else {
                                        // Remaining words (Masked)
                                        return <span key={idx} className="text-gray-300">***</span>;
                                    }
                                });
                            })()}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex items-center justify-between pt-2">
                 <button
                    onClick={() => { handleNext(); }} 
                    className="text-gray-400 hover:text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center"
                 >
                    <SkipForward className="w-4 h-4 mr-2" />
                    Skip Sentence
                 </button>

                 {feedback === 'correct' ? (
                     <button 
                        onClick={handleNext}
                        className="flex items-center space-x-2 bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-200 transform hover:-translate-y-0.5"
                     >
                        <span>Next</span>
                        <ArrowRight className="w-5 h-5" />
                     </button>
                 ) : (
                    <button 
                        onClick={checkAnswer}
                        className="flex items-center space-x-2 bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 transform hover:-translate-y-0.5"
                    >
                        <Check className="w-5 h-5" />
                        <span>Check</span>
                    </button>
                 )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default StepPractice;