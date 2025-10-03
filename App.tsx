import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { StepsGallery } from './components/StepsGallery';
import { LoadingIndicator } from './components/LoadingIndicator';
import { StepInteractor } from './components/StepInteractor';
import { StepCard } from './components/StepCard';
import { generateFirstStepInstructions, generateValidatedStep } from './services/geminiService';
import type { DrawingStep, AppState, ImageObject, ExpertInstruction } from './types';
import { AppStateEnum } from './types';
import { LogoIcon } from './components/icons';

// This is the main component that orchestrates the entire drawing tutorial workflow
// It manages the state machine that guides users through: upload -> generate -> review -> accept/reject


// Utility function to resize uploaded images to manageable dimensions
// This prevents huge files from slowing down the AI processing
// Always converts to PNG for consistency with the AI models
const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<{ base64: string; mimeType: 'image/png'; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      if (!event.target?.result) {
        return reject(new Error("Couldn't read file"));
      }
      const img = new Image();
      img.src = event.target.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Maintain aspect ratio while fitting within max dimensions
        // This ensures images aren't too large for the AI to process efficiently
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return reject(new Error('Could not get canvas context'));
        }
        
        // White background ensures clean output for AI processing
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/png', width, height });
      };
      img.onerror = (err) => reject(err instanceof Event ? new Error('Image loading error') : err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const App: React.FC = () => {
  // Core application state - manages the overall flow
  const [appState, setAppState] = useState<AppState>(AppStateEnum.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Interactive tutorial flow state - tracks progress through the drawing steps
  const [totalSteps] = useState<number>(10); // Fixed at 10 steps for consistent tutorial length
  const [acceptedSteps, setAcceptedSteps] = useState<DrawingStep[]>([]); // Steps the user has approved
  const [proposedStep, setProposedStep] = useState<DrawingStep | null>(null); // Current step awaiting user decision
  const [currentStepNumber, setCurrentStepNumber] = useState<number>(1); // Which step we're currently on
  const [originalImage, setOriginalImage] = useState<ImageObject | null>(null); // User's reference image
  const [currentCanvas, setCurrentCanvas] = useState<ImageObject | null>(null); // Current drawing state
  
  // AI instruction state - these hold the expert's guidance for each step
  const [proposedStepInstructions, setProposedStepInstructions] = useState<ExpertInstruction | null>(null);
  const [nextStepInstructions, setNextStepInstructions] = useState<ExpertInstruction | null>(null);

  // Quality control tracking - shows users how well the AI performed
  const [validationAttempts, setValidationAttempts] = useState<number>(0);
  const [validationScore, setValidationScore] = useState<number | null>(null);

  // Cancellation support - allows users to stop long-running AI operations
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Core function that handles the AI generation workflow for a single step
  // This orchestrates the expert instruction -> image generation -> validation cycle
  const processStep = useCallback(async (
    instructions: ExpertInstruction,
    canvas: ImageObject | null,
    oImage: ImageObject,
    feedback?: string
  ) => {
    // Set up cancellation support for this operation
    const controller = new AbortController();
    setAbortController(controller);

    // Update UI to show we're working
    setAppState(AppStateEnum.LOADING);
    setStatusMessage(`Expert is analyzing and generating step ${instructions.stepNumber} of ${totalSteps}...`);
    setProposedStep(null);
    setValidationAttempts(0);
    setValidationScore(null);

    try {
      // Check if user cancelled before we start
      if (controller.signal.aborted) {
        throw new Error('Generation cancelled by user');
      }

      // This is where the magic happens - the AI expert creates and validates the step
      // It will retry up to 3 times if the quality isn't good enough
      const result = await generateValidatedStep(
        oImage,
        canvas,
        instructions,
        3, // max retries
        feedback
      );

      // Show the user how well the AI performed
      setValidationAttempts(result.attempts);
      setValidationScore(result.finalScore);

      console.log(`Step ${instructions.stepNumber} completed:`, {
        attempts: result.attempts,
        score: result.finalScore,
        approved: result.validation.approved
      });

      // Package up the result for the UI
      const newProposedStep: DrawingStep = {
        step: instructions.stepNumber,
        description: instructions.whatToDraw,
        imageUrl: `data:${result.image.mimeType};base64,${result.image.base64}`,
      };
      
      setProposedStep(newProposedStep);
      
      // Keep the instructions around in case user wants to retry with feedback
      setProposedStepInstructions(instructions);
      
      // If the expert already planned the next step, save those instructions
      if (result.validation.instructionsForNextStep) {
        setNextStepInstructions(result.validation.instructionsForNextStep);
      }
      
      // Now wait for user to decide: accept, retry, or edit specific area
      setAppState(AppStateEnum.AWAITING_USER_INPUT);

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      
      // Don't treat cancellation as an error - user intentionally stopped
      if (errorMessage.includes('cancelled')) {
        console.log('Generation cancelled by user');
        setAppState(AppStateEnum.IDLE);
        return;
      }
      
      setError(`Failed to generate step ${instructions.stepNumber}. ${errorMessage}`);
      setAppState(AppStateEnum.ERROR);
    } finally {
      setAbortController(null);
    }
  }, [totalSteps]);

  // Handles the initial image upload and kicks off the tutorial generation
  // This is the entry point for the entire workflow
  const handleImageUpload = useCallback(async (file: File) => {
    // Set up cancellation for this operation
    const controller = new AbortController();
    setAbortController(controller);

    // Reset all state to start fresh
    setAppState(AppStateEnum.LOADING);
    setError(null);
    setAcceptedSteps([]);
    setProposedStep(null);
    setCurrentStepNumber(1);
    setCurrentCanvas(null);
    setProposedStepInstructions(null);
    setNextStepInstructions(null);
    setValidationAttempts(0);
    setValidationScore(null);
    setStatusMessage('Preparing your image...');

    try {
      if (controller.signal.aborted) {
        throw new Error('Generation cancelled by user');
      }

      // Resize the image to a reasonable size for AI processing
      // 1024x1024 is a good balance between quality and processing speed
      const { base64: imageBase64, mimeType } = await resizeImage(file, 1024, 1024);
      const originalImgObj = { base64: imageBase64, mimeType };
      setOriginalImage(originalImgObj);

      if (controller.signal.aborted) {
        throw new Error('Generation cancelled by user');
      }

      setStatusMessage('Expert is analyzing the image and planning the first step...');
      
      // The AI expert analyzes the image and creates a plan for the first step
      // This is crucial - it determines the entire tutorial structure
      const firstStepInstructions = await generateFirstStepInstructions(originalImgObj, totalSteps);
      
      if (controller.signal.aborted) {
        throw new Error('Generation cancelled by user');
      }

      console.log('First step instructions:', firstStepInstructions);
      
      // Now generate the actual first step using those instructions
      await processStep(firstStepInstructions, null, originalImgObj);

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      
      // Don't show cancellation as an error
      if (errorMessage.includes('cancelled')) {
        console.log('Generation cancelled by user');
        setAppState(AppStateEnum.IDLE);
        return;
      }
      
      setError(`Failed to start tutorial. ${errorMessage}`);
      setAppState(AppStateEnum.ERROR);
    } finally {
      setAbortController(null);
    }
  }, [processStep, totalSteps]);

  // User approved the current step - add it to the accepted list and move forward
  const handleAcceptStep = useCallback(async () => {
    if (!proposedStep || !originalImage) return;

    // Add this step to our collection of approved steps
    const newAcceptedSteps = [...acceptedSteps, proposedStep];
    setAcceptedSteps(newAcceptedSteps);

    // Update the current canvas state with this step's result
    // We need to extract the base64 data from the data URL
    const [, imageData] = proposedStep.imageUrl.split(';base64,');
    const mimeType = proposedStep.imageUrl.substring(5, proposedStep.imageUrl.indexOf(';'));
    const newCanvas = { base64: imageData, mimeType };
    setCurrentCanvas(newCanvas);
    
    // Clear the proposed step since we've accepted it
    setProposedStep(null);
    setProposedStepInstructions(null);
    
    // Move to the next step number
    const nextStepNumber = currentStepNumber + 1;
    setCurrentStepNumber(nextStepNumber);

    // If there are more steps to go and we have instructions for the next one
    if (nextStepNumber <= totalSteps && nextStepInstructions) {
      await processStep(nextStepInstructions, newCanvas, originalImage);
    } else {
      // We're done! Show the final results gallery
      setAppState(AppStateEnum.RESULTS);
    }
  }, [proposedStep, acceptedSteps, currentStepNumber, totalSteps, nextStepInstructions, originalImage, processStep]);

  // User wants to retry the current step with general feedback
  const handleRetryStep = useCallback((feedback: string) => {
    if (!proposedStepInstructions || !originalImage) return;
    processStep(proposedStepInstructions, currentCanvas, originalImage, feedback);
  }, [proposedStepInstructions, currentCanvas, originalImage, processStep]);

  // User wants to retry but only fix a specific area of the drawing
  // This is more precise than general feedback - we tell the AI exactly where to focus
  const handleAreaRetryStep = useCallback((area: { x: number; y: number; width: number; height: number }, feedback: string) => {
    if (!proposedStepInstructions || !originalImage) return;
    
    // Create enhanced feedback that includes the precise area coordinates
    // The AI needs to know exactly which part of the image to focus on
    const areaFeedback = `FOCUSED AREA CORRECTION:
Area coordinates: x=${area.x.toFixed(1)}%, y=${area.y.toFixed(1)}%, width=${area.width.toFixed(1)}%, height=${area.height.toFixed(1)}%
This represents the specific region that needs improvement.

USER FEEDBACK FOR THIS AREA: ${feedback}

IMPORTANT: Focus your improvements ONLY on the specified area. Keep the rest of the drawing exactly as it is. The area represents a specific part of the image that the user wants to refine.`;
    
    processStep(proposedStepInstructions, currentCanvas, originalImage, areaFeedback);
  }, [proposedStepInstructions, currentCanvas, originalImage, processStep]);

  // User wants to cancel the current generation operation
  const handleCancelGeneration = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setAppState(AppStateEnum.IDLE);
    setStatusMessage('');
  }, [abortController]);

  // Reset everything back to the initial state - like starting over completely
  const handleReset = () => {
    // Cancel any ongoing operations first
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    
    // Reset all state to initial values
    setAppState(AppStateEnum.IDLE);
    setAcceptedSteps([]);
    setProposedStep(null);
    setCurrentStepNumber(1);
    setOriginalImage(null);
    setCurrentCanvas(null);
    setProposedStepInstructions(null);
    setNextStepInstructions(null);
    setError(null);
    setStatusMessage('');
    setValidationAttempts(0);
    setValidationScore(null);
  };

  // Main render function that switches between different app states
  const renderContent = () => {
    switch (appState) {
      case AppStateEnum.LOADING:
        // Show progress while AI is working, with option to cancel
        return (
          <>
            {/* Show previously accepted steps while generating new ones */}
            {acceptedSteps.length > 0 && (
              <div className="w-full mb-8">
                <h2 className="text-2xl font-bold text-center mb-6">Your Progress So Far...</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 w-full">
                  {acceptedSteps.map((step) => <StepCard key={step.step} step={step} />)}
                </div>
              </div>
            )}
            <LoadingIndicator message={statusMessage} />
            <div className="mt-6 text-center">
              <button
                onClick={handleCancelGeneration}
                className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transition transform hover:scale-105"
              >
                Stop Generation
              </button>
            </div>
          </>
        );
      case AppStateEnum.AWAITING_USER_INPUT:
        // Show the proposed step and let user decide what to do with it
        return (
          <>
            {/* Show progress so far */}
            {acceptedSteps.length > 0 && (
              <div className="w-full mb-8">
                <h2 className="text-2xl font-bold text-center mb-6">Your Progress So Far...</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 w-full">
                  {acceptedSteps.map((step) => <StepCard key={step.step} step={step} />)}
                </div>
              </div>
            )}
            {proposedStep && (
              <>
                {/* Main interaction component - user can accept, retry, or edit specific areas */}
                <StepInteractor step={proposedStep} onAccept={handleAcceptStep} onRetry={handleRetryStep} onAreaRetry={handleAreaRetryStep} />
                
                {/* Show the expert's reasoning for transparency */}
                {proposedStepInstructions && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <h3 className="font-semibold text-amber-900 mb-2">Expert Instructions:</h3>
                    <p className="text-sm text-amber-800 mb-2">
                      <strong>What to draw:</strong> {proposedStepInstructions.whatToDraw}
                    </p>
                    <p className="text-xs text-amber-700">
                      Target: {proposedStepInstructions.targetCompleteness}% complete
                    </p>
                  </div>
                )}
                
                {/* Show quality metrics so user knows how confident the AI is */}
                {validationScore !== null && (
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-lg text-sm">
                      <span className="text-stone-600">
                        Expert Score: <strong className={validationScore >= 70 ? 'text-green-600' : validationScore >= 50 ? 'text-amber-600' : 'text-red-600'}>{validationScore}/100</strong>
                      </span>
                      {validationAttempts > 1 && (
                        <span className="text-stone-500">
                          • {validationAttempts} attempt{validationAttempts > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        );
      case AppStateEnum.RESULTS:
        // All done! Show the complete tutorial gallery
        return <StepsGallery steps={acceptedSteps} onReset={handleReset} />;
      case AppStateEnum.ERROR:
        // Something went wrong - show error and option to start over
        return (
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Oops! Something went wrong.</h2>
            <p className="text-red-400 mb-6">{error}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-amber-600 text-white font-semibold rounded-lg shadow-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-75 transition-colors"
            >
              Try Again
            </button>
          </div>
        );
      case AppStateEnum.IDLE:
      default:
        // Initial state - show the image upload interface
        return <ImageUploader onImageUpload={handleImageUpload} />;
    }
  };

  // Determine if we should show the sidebar with reference image and progress
  const isInteractiveView = appState === AppStateEnum.LOADING || appState === AppStateEnum.AWAITING_USER_INPUT;

  return (
    <div className="min-h-screen text-stone-800 flex flex-col items-center p-2 sm:p-4 lg:p-6">
      {/* App header with logo and title */}
      <header className="w-full max-w-[1920px] mx-auto flex items-center justify-center sm:justify-start mb-4 sm:mb-6">
         <div className="flex items-center space-x-3">
           <LogoIcon />
            <h1 className="text-2xl sm:text-3xl font-bold text-amber-800 tracking-wide">
              DrawEasy
            </h1>
         </div>
      </header>
      
      {/* Main content area - layout changes based on app state */}
      <main className="w-full max-w-[1920px] mx-auto flex-grow flex flex-col md:flex-row gap-4 sm:gap-6 items-start">
        {/* Sidebar with reference image - only shown during interactive states */}
        {isInteractiveView && originalImage && (
            <aside className="w-full md:w-[280px] lg:w-[320px] xl:w-[360px] p-2">
                <div className="sticky top-4">
                    <h2 className="text-lg font-bold text-amber-800 mb-3 text-center">Reference Image</h2>
                    <div className="bg-white/50 backdrop-blur-sm border border-stone-300/50 rounded-xl shadow-lg overflow-hidden">
                        <img 
                            src={`data:${originalImage.mimeType};base64,${originalImage.base64}`} 
                            alt="User's original drawing for reference"
                            className="w-full h-auto object-contain rounded-xl"
                        />
                    </div>
                    
                    {/* Progress bar showing tutorial completion */}
                    <div className="mt-3 p-2.5 bg-amber-50 rounded-lg">
                      <p className="text-sm text-center text-amber-800">
                        Step {currentStepNumber} of {totalSteps}
                      </p>
                      <div className="mt-2 w-full bg-amber-200 rounded-full h-2">
                        <div 
                          className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(currentStepNumber / totalSteps) * 100}%` }}
                        />
                      </div>
                    </div>
                </div>
            </aside>
        )}
        
        {/* Main content area - renders different components based on app state */}
        <div className={isInteractiveView ? "flex-1 min-w-0" : "w-full flex-grow flex flex-col justify-center"}>
            {renderContent()}
        </div>
      </main>
      
      {/* Footer area - currently empty but available for future content */}
      <footer className="w-full max-w-[1920px] mx-auto text-center py-4 mt-4">
      </footer>
    </div>
  );
};

export default App;