import React, { useState, useRef, useEffect } from 'react';
import { Segment } from '../types';
import { CheckCircle, Play, Pause, Trash2, Clock, RefreshCw } from 'lucide-react';

interface StepReviewProps {
  segments: Segment[];
  audioUrl: string | null;
  onConfirm: (updatedSegments: Segment[]) => void;
}

const StepReview: React.FC<StepReviewProps> = ({ segments, audioUrl, onConfirm }) => {
  const [localSegments, setLocalSegments] = useState<Segment[]>(segments);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // Stop playing when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleTextChange = (id: string, field: 'text' | 'translation', newValue: string) => {
    setLocalSegments(prev => prev.map(s => s.id === id ? { ...s, [field]: newValue } : s));
  };

  const handleTimeChange = (id: string, field: 'start' | 'end', newValue: string) => {
    const numValue = parseFloat(newValue);
    if (isNaN(numValue)) return;
    setLocalSegments(prev => prev.map(s => s.id === id ? { ...s, [field]: numValue } : s));
  };

  const handleDelete = (id: string) => {
    setLocalSegments(prev => prev.filter(s => s.id !== id));
  };

  const handlePlaySegment = (segment: Segment) => {
    if (!audioRef.current || !audioUrl) return;

    if (playingId === segment.id) {
        audioRef.current.pause();
        setPlayingId(null);
        return;
    }

    const audio = audioRef.current;
    audio.currentTime = segment.start;
    audio.play();
    setPlayingId(segment.id);

    // Stop at end of segment
    const checkTime = () => {
        if (audio.currentTime >= segment.end) {
            audio.pause();
            setPlayingId(null);
            audio.removeEventListener('timeupdate', checkTime);
        }
    };
    audio.addEventListener('timeupdate', checkTime);
  };

  const handleConfirm = () => {
    // Sort segments by start time before confirming to keep order logic
    const sorted = [...localSegments].sort((a, b) => a.start - b.start);
    onConfirm(sorted);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full max-h-[80vh]">
      {audioUrl && <audio ref={audioRef} src={audioUrl} className="hidden" />}
      
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Review Transcription</h2>
          <p className="text-sm text-gray-500">
             {localSegments.length} segments detected. Verify text and timing.
          </p>
        </div>
        <button 
          onClick={handleConfirm}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium shadow-sm"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Confirm & Start</span>
        </button>
      </div>

      <div className="overflow-y-auto p-6 space-y-4 bg-gray-50/50">
        {localSegments.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
                <Trash2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No segments found. Please re-upload or check your audio.</p>
            </div>
        ) : (
            localSegments.map((seg, index) => (
            <div key={seg.id} className="group p-4 border border-gray-200 rounded-xl hover:border-indigo-300 transition-all bg-white shadow-sm hover:shadow-md">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Controls & Timing */}
                    <div className="flex flex-row md:flex-col items-center md:items-start justify-between md:w-32 gap-2 md:border-r md:border-gray-100 md:pr-4">
                        <button
                            onClick={() => handlePlaySegment(seg)}
                            className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${playingId === seg.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
                            title="Play segment"
                        >
                            {playingId === seg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>
                        
                        <div className="flex flex-col gap-1 w-full">
                            <div className="flex items-center text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                <span className="w-8 font-semibold">Start</span>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={seg.start}
                                    onChange={(e) => handleTimeChange(seg.id, 'start', e.target.value)}
                                    className="w-12 bg-transparent focus:outline-none text-right font-mono text-gray-800"
                                />
                            </div>
                            <div className="flex items-center text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                <span className="w-8 font-semibold">End</span>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={seg.end}
                                    onChange={(e) => handleTimeChange(seg.id, 'end', e.target.value)}
                                    className="w-12 bg-transparent focus:outline-none text-right font-mono text-gray-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                             <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sentence {index + 1}</span>
                             <button 
                                onClick={() => handleDelete(seg.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                title="Remove segment"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                        </div>

                        <textarea
                            value={seg.text}
                            onChange={(e) => handleTextChange(seg.id, 'text', e.target.value)}
                            placeholder="English Text"
                            rows={2}
                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none text-gray-800 text-base font-medium resize-none transition-shadow"
                        />
                        
                        <div className="relative">
                            <input
                                value={seg.translation || ''}
                                onChange={(e) => handleTextChange(seg.id, 'translation', e.target.value)}
                                placeholder="Vietnamese Translation"
                                className="w-full p-2 pl-8 border border-gray-200 bg-gray-50 rounded-lg focus:ring-2 focus:ring-green-100 focus:border-green-300 outline-none text-gray-600 text-sm"
                            />
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">VI</div>
                        </div>
                    </div>
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default StepReview;