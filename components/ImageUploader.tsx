
import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  }, [onImageUpload]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-100 sm:text-4xl">Turn Your Drawing into a Tutorial</h2>
            <p className="mt-4 text-lg text-slate-400">
                Upload a simple drawing, and our AI will show you how to create it step-by-step.
            </p>
        </div>
      <form
        id="form-file-upload"
        className="relative w-full max-w-2xl text-center"
        onDragEnter={handleDrag}
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="file"
          id="input-file-upload"
          className="hidden"
          accept="image/*"
          onChange={handleChange}
        />
        <label
          id="label-file-upload"
          htmlFor="input-file-upload"
          className={`h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-300
            ${dragActive ? 'border-sky-400 bg-sky-900/50' : 'border-slate-600 bg-slate-800 hover:border-sky-500 hover:bg-slate-700'}`}
        >
          <div className="flex flex-col items-center justify-center">
            <UploadIcon />
            <p className="font-semibold text-slate-200 mt-4">
              <span className="text-sky-400">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-slate-500 mt-1">PNG, JPG, or WEBP</p>
          </div>
        </label>
        {dragActive && (
          <div
            className="absolute inset-0 w-full h-full rounded-xl"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          ></div>
        )}
      </form>
    </div>
  );
};
