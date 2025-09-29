import React from 'react';

interface LoadingIndicatorProps {
  message: string;
}

const LoadingSpinner: React.FC = () => (
    <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-amber-600"></div>
);

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ message }) => {
  return (
    <div className="w-full flex flex-col items-center justify-center text-center p-8">
      <LoadingSpinner />
      <p className="text-xl font-semibold text-stone-700 mt-6">{message}</p>
      <p className="text-stone-500 mt-2">Please wait, this may take a moment...</p>
    </div>
  );
};