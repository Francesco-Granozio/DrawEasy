import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons';

// Component for uploading the initial reference image
// Supports both drag-and-drop and click-to-upload functionality
interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
  // Track drag state for visual feedback
  const [dragActive, setDragActive] = useState(false);

  // Handle drag events to show visual feedback when user drags files over the area
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle file drop - extract the file and pass it to the parent
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  }, [onImageUpload]);

  // Handle file selection via the hidden input element
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-stone-900 sm:text-4xl">Turn Your Drawing into a Tutorial</h2>
            <p className="mt-4 text-lg text-stone-600">
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
            ${dragActive ? 'border-amber-600 bg-amber-100/50' : 'border-stone-400 bg-stone-50/50 hover:border-amber-600 hover:bg-stone-100/70'}`}
        >
          <div className="flex flex-col items-center justify-center">
            <UploadIcon />
            <p className="font-semibold text-stone-700 mt-4">
              <span className="text-amber-700">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-stone-500 mt-1">PNG, JPG, or WEBP</p>
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