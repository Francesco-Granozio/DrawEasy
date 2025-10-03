// Core application state machine - controls the overall user experience flow
export enum AppStateEnum {
  IDLE = 'IDLE',                    // Initial state - showing upload interface
  LOADING = 'LOADING',              // AI is working on generating a step
  AWAITING_USER_INPUT = 'AWAITING_USER_INPUT', // User needs to accept/reject/retry a step
  RESULTS = 'RESULTS',              // Tutorial complete - showing final gallery
  ERROR = 'ERROR',                  // Something went wrong
}

export type AppState = AppStateEnum;

// Represents a completed drawing step in the tutorial
export interface DrawingStep {
  step: number;           // Step number (1-10)
  description: string;    // Human-readable description of what this step teaches
  imageUrl: string;       // Data URL of the generated image
}

// Legacy interface - keeping for potential future use
export interface StepDescription {
    step: number;
    description: string;
    targetCompleteness: number; // 0-100, target completion percentage
}

// Standardized image representation used throughout the app
// All images are stored as base64 data URLs for consistency
export interface ImageObject {
    base64: string;       // Base64 encoded image data
    mimeType: string;     // MIME type (e.g., 'image/png', 'image/jpeg')
}

// Legacy validation result structure - not currently used in the new workflow
export interface ValidationResult {
    isValid: boolean;
    score: number; // 0-100
    issues: {
        tooDetailed: boolean;
        notDetailedEnough: boolean;
        wrongProportions: boolean;
        wrongPosition: boolean;
        deviatesFromOriginal: boolean;
    };
    feedback: string; // Textual feedback for the generator
    reasoning: string; // Explanation of the judgment
}

// Expert's instructions for a specific step - this is what the AI generates
export interface ExpertInstruction {
    stepNumber: number;              // Which step this is (1-10)
    totalSteps: number;              // Total number of steps in tutorial
    targetCompleteness: number;      // 0-100, how complete should this step be
    whatToDraw: string;              // Brief description of what to draw
    drawingInstructions: string;     // Detailed instructions for the AI illustrator
    avoidance: string;               // What NOT to do in this step
}

// Expert's evaluation of a generated step - quality control results
export interface ExpertValidation {
    approved: boolean;                              // Did it pass quality standards?
    score: number;                                  // 0-100 quality score
    issues: string[];                               // List of problems found
    nextAction: 'regenerate' | 'proceed';          // What should happen next
    feedbackForRegeneration?: string;               // Specific feedback if regenerating
    instructionsForNextStep?: ExpertInstruction;    // Next step instructions if proceeding
}