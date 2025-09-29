
import React from 'react';
import type { DrawingStep } from '../types';
import { StepCard } from './StepCard';

interface StepsGalleryProps {
  steps: DrawingStep[];
  onReset: () => void;
}

export const StepsGallery: React.FC<StepsGalleryProps> = ({ steps, onReset }) => {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold sm:text-4xl">Here's Your Drawing Guide!</h2>
        <p className="mt-2 text-lg text-slate-400">Follow these steps to create your masterpiece.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
        {steps.map((step) => (
          <StepCard key={step.step} step={step} />
        ))}
      </div>
      <button
        onClick={onReset}
        className="mt-12 px-8 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition-transform transform hover:scale-105"
      >
        Start a New Drawing
      </button>
    </div>
  );
};
