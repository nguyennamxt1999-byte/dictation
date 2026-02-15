import React, { useState, useRef, useEffect } from 'react';
import { MiniStoryInteraction } from '../types';
import { saveArticle, getArticleById } from '../services/storageService';
import { Play, Mic, ArrowRight, RotateCw, Volume2, MicOff, AlertCircle, SkipForward, CheckCircle2 } from 'lucide-react';

interface StepMiniStoryProps {
  articleId: string | null;
  interactions: MiniStoryInteraction[];
  initialIndex: number;
  audioUrl: string | null;
  onComplete: () => void;
}

type InteractionState = 'IDLE' | 'PLAYING_QUESTION' | 'WAITING_FOR_USER' | 'PLAYING_ANSWER' | 'REVIEW';

const StepMiniStory: React.FC<StepMiniStoryProps> = ({ articleId, interactions, initialIndex, audioUrl, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [state, setState] = useState<InteractionState>('IDLE');
  const [userTranscript, setUserTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [permissionError, setPermissionError] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentItem = interactions[currentIndex];
  
  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognitionInstance = new SpeechRecognition();
            recognitionInstance.continuous = false;
            recognitionInstance.interimResults = true;
            recognitionInstance.lang = 'en-US';

            recognitionInstance.onresult = (event: any) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        const finalTranscript = event.results[i][0].transcript;
                        setUserTranscript(finalTranscript);
                        setIsListening(false);
                        // Auto advance to answer after speaking with a short delay
                        setTimeout(() => playAnswer(finalTranscript), 800); 
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                        setUserTranscript(interimTranscript);
                    }
                }
            };

            recognitionInstance.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                if (event.error === 'not-allowed') {
                    setPermissionError(true);
                }
                setIsListening(false);
            };
            
            recognitionInstance.onend = () => {
                 setIsListening(false);
            };

            setRecognition(recognitionInstance);
        }
    }
  }, []);

  const startSession = () => {
      setState('PLAYING_QUESTION');
      // Wait for re-render to ensure UI state is consistent, though audio element is now persistent
      setTimeout(() => {
          playAudio(currentItem.questionStart, currentItem.questionEnd, () => {
              setState('WAITING_FOR_USER');
              startListening();
          });
      }, 100);
  };

  const startListening = () => {
      if (recognition && !isListening) {
          try {
              setUserTranscript('');
              setIsListening(true);
              recognition.start();
          } catch (e) {
              console.error("Recognition start failed", e);
              setIsListening(false);
          }
      }
  };

  const stopListening = () => {
      if (recognition && isListening) {
          recognition.stop();
          setIsListening(false);
      }
  };

  const playAudio = (start: number, end: number, onEnd?: () => void) => {
      if (!audioRef.current) return;
      
      const audio = audioRef.current;
      audio.currentTime = start;
      
      const handleTimeUpdate = () => {
          // Add a small buffer (0.1s) to avoid cutting off too early or playing next part
          if (audio.currentTime >= end) {
              audio.pause();
              audio.removeEventListener('timeupdate', handleTimeUpdate);
              if (onEnd) onEnd();
          }
      };
      
      audio.addEventListener('timeupdate', handleTimeUpdate);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
          playPromise.catch(e => {
              console.error("Play error:", e);
          });
      }
  };

  const playAnswer = (transcriptOverride?: string) => {
      stopListening();
      // If manually skipped, we might not have a transcript, that's fine.
      setState('PLAYING_ANSWER');
      playAudio(currentItem.answerStart, currentItem.answerEnd, () => {
          setState('REVIEW');
      });
  };

  const handleNext = async () => {
      const nextIndex = currentIndex + 1;
      if (nextIndex < interactions.length) {
          if (articleId) {
             const article = await getArticleById(articleId);
             if (article) {
                 article.currentSegmentIndex = nextIndex;
                 article.lastPracticed = Date.now();
                 await saveArticle(article);
             }
          }
          // Reset state for next
          setUserTranscript('');
          setState('PLAYING_QUESTION');
          setCurrentIndex(nextIndex);
          
          // Auto play next question
          setTimeout(() => {
              playAudio(interactions[nextIndex].questionStart, interactions[nextIndex].questionEnd, () => {
                  setState('WAITING_FOR_USER');
                  startListening();
              });
          }, 500);
      } else {
          onComplete();
      }
  };

  const replayQuestion = () => {
      playAudio(currentItem.questionStart, currentItem.questionEnd);
  };

  const replayAnswer = () => {
      playAudio(currentItem.answerStart, currentItem.answerEnd);
  };

  // Progress Bar
  const progress = ((currentIndex + 1) / interactions.length) * 100;

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 min-h-[600px] flex flex-col">
       {/* Persistent Audio Element - Always mounted to prevent play() interruption */}
       {audioUrl && <audio ref={audioRef} src={audioUrl} className="hidden" />}

       {state === 'IDLE' ? (
           <div className="flex flex-col items-center justify-center flex-grow p-8 text-center max-w-2xl mx-auto animate-in fade-in duration-500">
               <div className="bg-indigo-100 p-6 rounded-full mb-6">
                   <RotateCw className="w-12 h-12 text-indigo-600" />
               </div>
               <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready for Mini Story?</h2>
               <p className="text-gray-600 mb-8 text-lg">
                   Listen to the questions and answer aloud. The app will record your answer and then play the correct answer for you to compare.
               </p>
               <button 
                  onClick={startSession}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-xl text-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center"
               >
                   <Play className="w-6 h-6 mr-2" /> Start Practice
               </button>
           </div>
       ) : (
           <>
               {/* Header with Progress */}
               <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                   <div className="flex justify-between items-center text-gray-500 text-sm mb-2">
                       <span className="font-semibold text-gray-700">Question {currentIndex + 1} of {interactions.length}</span>
                       <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Mini Story Mode</span>
                   </div>
                   <div className="w-full bg-gray-200 rounded-full h-2">
                       <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                   </div>
               </div>

               <div className="grid md:grid-cols-2 gap-6 md:gap-8 flex-grow">
                   
                   {/* Question Section */}
                   <div className={`
                        relative p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col justify-between min-h-[320px] overflow-hidden
                        ${state === 'PLAYING_QUESTION' 
                            ? 'border-indigo-500 bg-indigo-50 shadow-xl ring-4 ring-indigo-100' 
                            : 'border-gray-200 bg-white shadow-sm'}
                   `}>
                       {/* Background Decorative */}
                       <div className="absolute top-0 right-0 p-6 opacity-5">
                           <RotateCw className="w-32 h-32" />
                       </div>

                       <div>
                           <span className="inline-block px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                               Step 1: Listen
                           </span>
                           
                           {state === 'PLAYING_QUESTION' ? (
                               <div className="flex flex-col items-center justify-center py-10">
                                   <div className="relative">
                                       <div className="absolute inset-0 bg-indigo-400 rounded-full animate-ping opacity-20"></div>
                                       <Volume2 className="w-16 h-16 text-indigo-600 relative z-10" />
                                   </div>
                                   <h3 className="text-xl font-bold text-indigo-900 mt-6">Listening to Question...</h3>
                               </div>
                           ) : (
                               <div className="animate-in fade-in slide-in-from-left duration-500">
                                   <h3 className="text-2xl font-bold text-gray-800 leading-snug mb-6">"{currentItem.question}"</h3>
                                   <button 
                                        onClick={replayQuestion} 
                                        className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm font-semibold bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors w-fit"
                                    >
                                       <Volume2 className="w-4 h-4 mr-2" /> Replay Question
                                   </button>
                               </div>
                           )}
                       </div>
                   </div>

                   {/* User Answer Section */}
                   <div className={`
                        relative p-8 rounded-3xl border-2 transition-all duration-500 flex flex-col justify-between min-h-[320px]
                        ${state === 'WAITING_FOR_USER' 
                            ? 'border-amber-500 bg-amber-50 shadow-xl ring-4 ring-amber-100' 
                            : 'border-gray-200 bg-white shadow-sm'}
                   `}>
                        <div>
                           <span className="inline-block px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                               Step 2: Answer
                           </span>

                           {state === 'PLAYING_QUESTION' ? (
                                <div className="flex items-center justify-center h-full opacity-40">
                                    <p className="text-lg text-gray-400 font-medium">Wait for the question...</p>
                                </div>
                           ) : state === 'WAITING_FOR_USER' ? (
                                <div className="flex flex-col items-center text-center">
                                    <div className="relative mb-6">
                                        {isListening && <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-30"></div>}
                                        <button 
                                            onClick={isListening ? stopListening : startListening}
                                            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-amber-500 text-white shadow-lg scale-110' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                        >
                                            {isListening ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
                                        </button>
                                    </div>
                                    
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                                        {isListening ? "Listening..." : "Tap mic to answer"}
                                    </h3>
                                    
                                    {userTranscript ? (
                                        <p className="text-lg font-medium text-amber-900 bg-white/60 p-3 rounded-lg border border-amber-200 w-full animate-in fade-in">
                                            "{userTranscript}"
                                        </p>
                                    ) : (
                                        <p className="text-sm text-gray-500">Speak your answer aloud clearly</p>
                                    )}

                                    {permissionError && (
                                        <p className="text-xs text-red-500 mt-2 bg-red-50 px-2 py-1 rounded">
                                            Microphone access denied. Please enable permissions.
                                        </p>
                                    )}
                                    
                                    <div className="mt-8">
                                        <button onClick={() => playAnswer()} className="text-amber-700 hover:text-amber-900 text-sm font-semibold underline decoration-2 decoration-amber-200 hover:decoration-amber-500 underline-offset-2">
                                            I answered (Skip recording)
                                        </button>
                                    </div>
                                </div>
                           ) : (
                               <div className="animate-in fade-in slide-in-from-bottom duration-500">
                                   <div className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center">
                                        <Mic className="w-3 h-3 mr-1" /> You said
                                   </div>
                                   <p className={`text-xl font-medium italic mb-4 ${userTranscript ? 'text-gray-800' : 'text-gray-400'}`}>
                                       "{userTranscript || "(No audio detected)"}"
                                   </p>
                               </div>
                           )}
                        </div>
                   </div>

                   {/* Model Answer Section (Full Width) */}
                   <div className={`
                        md:col-span-2 p-8 rounded-3xl border-2 transition-all duration-500 relative overflow-hidden min-h-[200px] flex items-center justify-center
                        ${state === 'PLAYING_ANSWER' || state === 'REVIEW' 
                            ? 'border-green-500 bg-green-50 shadow-xl' 
                            : 'border-gray-200 bg-gray-50 opacity-60 grayscale'}
                   `}>
                        
                        {state === 'PLAYING_ANSWER' ? (
                            <div className="text-center">
                                 <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
                                     <Volume2 className="w-8 h-8 text-green-600 animate-pulse" />
                                 </div>
                                 <h3 className="text-2xl font-bold text-green-800">Compare with Correct Answer</h3>
                            </div>
                        ) : state === 'REVIEW' ? (
                             <div className="w-full flex flex-col md:flex-row items-center justify-between gap-8 animate-in zoom-in-95 duration-300">
                                  <div className="flex-1 text-left">
                                        <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold uppercase tracking-wider mb-3">
                                            Step 3: Compare
                                        </span>
                                        <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{currentItem.answer}</h3>
                                        <button onClick={replayAnswer} className="text-green-700 hover:text-green-800 flex items-center text-sm font-semibold mt-2">
                                            <RotateCw className="w-4 h-4 mr-1" /> Replay Answer
                                        </button>
                                  </div>
                                  
                                  <div className="flex-shrink-0">
                                      <button 
                                        onClick={handleNext}
                                        className="group bg-green-600 text-white px-8 py-4 rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-200 flex items-center font-bold text-lg"
                                      >
                                          <span>Next Question</span>
                                          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                      </button>
                                  </div>
                             </div>
                        ) : (
                            <div className="text-gray-400 font-medium flex items-center">
                                <CheckCircle2 className="w-5 h-5 mr-2" />
                                Correct answer will appear here
                            </div>
                        )}
                   </div>

               </div>
           </>
       )}
    </div>
  );
};

export default StepMiniStory;