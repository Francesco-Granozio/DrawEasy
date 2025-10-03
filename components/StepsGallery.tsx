import React from 'react';
import type { DrawingStep } from '../types';
import { StepCard } from './StepCard';

// Final results screen showing the complete tutorial
// Displays all accepted steps in a responsive grid layout
interface StepsGalleryProps {
  steps: DrawingStep[];
  onReset: () => void;
}

export const StepsGallery: React.FC<StepsGalleryProps> = ({ steps, onReset }) => {
  return (
    <div className="w-full flex flex-col items-center">
      {/* Header with celebration message */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold sm:text-4xl">Here's Your Drawing Guide!</h2>
        <p className="mt-2 text-lg text-stone-600">Follow these steps to create your masterpiece.</p>
      </div>
      
      {/* Responsive grid of step cards - adapts to screen size */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 w-full">
        {steps.map((step) => (
          <StepCard key={step.step} step={step} />
        ))}
      </div>
      
      {/* Reset button to start a new tutorial */}
      <button
        onClick={onReset}
        className="mt-8 px-8 py-3 bg-amber-600 text-white font-semibold rounded-lg shadow-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-75 transition-transform transform hover:scale-105"
      >
        Start a New Drawing
      </button>
    </div>
  );
};