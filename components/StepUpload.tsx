import React, { ChangeEvent } from 'react';
import { Upload, FileAudio } from 'lucide-react';

interface StepUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const StepUpload: React.FC<StepUploadProps> = ({ onFileSelect, isProcessing }) => {

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-xl bg-white hover:bg-gray-50 transition-colors">
      <div className="bg-indigo-50 p-5 rounded-full mb-4">
        {isProcessing ? (
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        ) : (
          <Upload className="w-10 h-10 text-indigo-600" />
        )}
      </div>
      
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        {isProcessing ? "Transcribing Audio..." : "Upload Audio File"}
      </h2>
      
      <p className="text-gray-500 text-center mb-8 max-w-sm">
        Select an English audio file (MP3, WAV) to start your dictation practice.
      </p>

      <label className={`relative cursor-pointer bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
        <span>Select File</span>
        <input 
          type="file" 
          accept="audio/*" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
      </label>

      <div className="mt-8 flex items-center text-xs text-gray-400">
        <FileAudio className="w-4 h-4 mr-1" />
        <span>Supports MP3, WAV, AAC up to 10MB</span>
      </div>
    </div>
  );
};

export default StepUpload;