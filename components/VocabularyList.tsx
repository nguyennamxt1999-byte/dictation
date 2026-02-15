import React, { useEffect, useState } from 'react';
import { VocabularyItem } from '../types';
import { getVocabulary, deleteVocabulary } from '../services/storageService';
import { generateSpeech } from '../services/geminiService';
import { Book, Trash2, Search, Calendar, MessageSquare, Volume2, RotateCw, ArrowLeft, ArrowRight, Layers, Loader2 } from 'lucide-react';

const VocabularyList: React.FC = () => {
  const [vocabList, setVocabList] = useState<VocabularyItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState<'LIST' | 'FLASHCARD'>('LIST');
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Flashcard State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    loadVocab();
  }, []);

  const loadVocab = async () => {
    const data = await getVocabulary();
    setVocabList(data);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this word?")) {
        await deleteVocabulary(id);
        setVocabList(prev => prev.filter(item => item.id !== id));
    }
  };

  const playAudio = async (text: string, id: string) => {
    if (playingId) return; 
    setPlayingId(id);

    try {
        const base64Audio = await generateSpeech(text);
        
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const dataInt16 = new Int16Array(bytes.buffer);
        const numChannels = 1;
        const sourceSampleRate = 24000;
        const frameCount = dataInt16.length / numChannels;
        
        const audioBuffer = audioCtx.createBuffer(numChannels, frameCount, sourceSampleRate);
        const channelData = audioBuffer.getChannelData(0); 
        
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i] / 32768.0;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => {
             setPlayingId(null);
             setTimeout(() => audioCtx.close(), 100); 
        };
        source.start(0);

    } catch (error) {
        console.error("Failed to play audio:", error);
        setPlayingId(null);
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    }
  };

  const filteredList = vocabList.filter(item => 
      item.word.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.originalSentence.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.topic && item.topic.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // --- Flashcard Logic ---

  const handleNextCard = () => {
      setIsFlipped(false);
      setCurrentCardIndex(prev => (prev + 1) % filteredList.length);
  };

  const handlePrevCard = () => {
      setIsFlipped(false);
      setCurrentCardIndex(prev => (prev - 1 + filteredList.length) % filteredList.length);
  };

  // --- Render Flashcard Mode ---
  if (mode === 'FLASHCARD' && filteredList.length > 0) {
      const card = filteredList[currentCardIndex];
      const isPlaying = playingId === card.id;

      return (
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center h-[calc(100vh-150px)] justify-center">
               <div className="flex justify-between w-full mb-6 items-center">
                    <button onClick={() => setMode('LIST')} className="flex items-center text-gray-500 hover:text-indigo-600 transition">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to List
                    </button>
                    <span className="font-mono text-gray-400">{currentCardIndex + 1} / {filteredList.length}</span>
               </div>

               <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="w-full aspect-[4/3] bg-white rounded-3xl shadow-xl border border-gray-100 cursor-pointer perspective-1000 relative transition-transform duration-500 transform-style-3d group"
               >
                   {/* Front */}
                   <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 backface-hidden transition-all duration-300 ${isFlipped ? 'opacity-0 rotate-y-180 pointer-events-none' : 'opacity-100'}`}>
                        {card.topic && (
                            <span className="absolute top-6 right-6 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                {card.topic}
                            </span>
                        )}
                        <h2 className="text-5xl font-bold text-gray-800 mb-4">{card.word}</h2>
                        {card.ipa && (
                             <span className="text-xl font-mono text-gray-500 bg-gray-50 px-3 py-1 rounded-full mb-6">/{card.ipa}/</span>
                        )}
                         <button 
                            onClick={(e) => { e.stopPropagation(); playAudio(card.word, card.id); }}
                            className={`p-3 rounded-full transition ${isPlaying ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                         >
                            {isPlaying ? <Loader2 className="w-6 h-6 animate-spin" /> : <Volume2 className="w-6 h-6" />}
                         </button>
                         <p className="mt-8 text-gray-400 text-sm animate-pulse">Tap to flip</p>
                   </div>

                   {/* Back */}
                   <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 backface-hidden rotate-y-180 bg-indigo-50/50 transition-all duration-300 ${!isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        <div className="text-center space-y-4 overflow-y-auto max-h-full w-full">
                            <div>
                                <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wide">Translation</h3>
                                <p className="text-2xl font-bold text-gray-800">{card.translation}</p>
                            </div>
                            
                            {card.definition && (
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Definition</h3>
                                    <p className="text-gray-700">{card.definition}</p>
                                </div>
                            )}

                            {card.examples && card.examples.length > 0 && (
                                <div className="pt-4 border-t border-indigo-100">
                                     <p className="text-sm italic text-gray-600">"{card.examples[0]}"</p>
                                </div>
                            )}
                        </div>
                   </div>
               </div>

               <div className="flex items-center space-x-6 mt-8">
                   <button onClick={handlePrevCard} className="p-4 rounded-full bg-white shadow-md text-gray-600 hover:text-indigo-600 hover:shadow-lg transition">
                       <ArrowLeft className="w-6 h-6" />
                   </button>
                   <button onClick={() => setIsFlipped(!isFlipped)} className="p-4 rounded-full bg-indigo-600 shadow-lg text-white hover:bg-indigo-700 hover:shadow-xl transition transform hover:-translate-y-1">
                       <RotateCw className="w-6 h-6" />
                   </button>
                    <button onClick={handleNextCard} className="p-4 rounded-full bg-white shadow-md text-gray-600 hover:text-indigo-600 hover:shadow-lg transition">
                       <ArrowRight className="w-6 h-6" />
                   </button>
               </div>
          </div>
      )
  }

  // --- List View ---

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end pb-6 border-b border-gray-200 gap-4">
        <div>
            <h2 className="text-3xl font-bold text-gray-900">Vocabulary</h2>
            <p className="text-gray-500 mt-1">Review your saved words.</p>
        </div>
        
        <div className="flex space-x-3 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search words..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
            </div>
            {filteredList.length > 0 && (
                <button 
                    onClick={() => setMode('FLASHCARD')}
                    className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                >
                    <Layers className="w-4 h-4" />
                    <span className="hidden sm:inline">Flashcards</span>
                </button>
            )}
        </div>
      </div>

      {filteredList.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
              <Book className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No vocabulary saved yet.</p>
          </div>
      ) : (
          <div className="grid gap-4 md:grid-cols-2">
              {filteredList.map(item => {
                  const isPlaying = playingId === item.id;
                  return (
                  <div key={item.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative group">
                      <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-3">
                              <h3 className="text-2xl font-bold text-indigo-700">{item.word}</h3>
                              {item.ipa && (
                                  <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">/{item.ipa}/</span>
                              )}
                              <button 
                                onClick={() => playAudio(item.word, item.id)}
                                className={`transition-colors p-1.5 rounded-full ${isPlaying ? 'bg-indigo-100 text-indigo-600' : 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                              >
                                  {isPlaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                              </button>
                          </div>
                          <button 
                              onClick={() => handleDelete(item.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors p-2"
                              title="Delete word"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>

                      <div className="space-y-3">
                          <div className="bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                              <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-green-800 text-sm block">Meaning</span>
                                  {item.topic && (
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-white px-1.5 rounded border border-green-200">
                                          {item.topic}
                                      </span>
                                  )}
                              </div>
                              <div className="text-gray-800 font-medium">{item.translation}</div>
                              {item.definition && (
                                  <div className="text-xs text-gray-500 mt-1">{item.definition}</div>
                              )}
                          </div>

                          <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                               <div className="text-xs text-gray-400 flex items-center mb-1">
                                  <MessageSquare className="w-3 h-3 mr-1" />
                                  Context
                               </div>
                               <div className="text-sm text-gray-600 italic">"{item.originalSentence}"</div>
                          </div>
                      </div>
                      
                      <div className="mt-3 flex justify-end">
                           <span className="text-xs text-gray-400 flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {new Date(item.savedAt).toLocaleDateString()}
                           </span>
                      </div>
                  </div>
              )})}
          </div>
      )}
    </div>
  );
};

export default VocabularyList;