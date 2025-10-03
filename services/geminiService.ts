import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { ImageObject, ExpertInstruction, ExpertValidation } from '../types';

// This service handles all AI interactions using Google's Gemini models
// It implements a three-stage workflow: Expert Analysis -> Image Generation -> Quality Validation

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });



/**
 * STEP 1: Expert analyzes the uploaded image and creates the first step plan
 * This is crucial - it determines the entire tutorial structure and progression
 */
export const generateFirstStepInstructions = async (
    originalImage: ImageObject,
    totalSteps: number = 10
): Promise<ExpertInstruction> => {
    
    const prompt = `You are an expert drawing instructor analyzing an image to create the FIRST STEP of a ${totalSteps}-step progressive drawing tutorial.

CRITICAL: The first step must be EXTREMELY SIMPLE - only the most basic shapes and proportions.

Analyze the image and determine:
1. What are the absolute simplest foundational elements?
2. What should a student draw in a 10-second rough sketch?
3. How to ensure it's rough and incomplete (only 10% detail)?

Provide clear, actionable instructions for an AI image generator.

Examples of good first steps:
- For a face: "Draw a rough oval shape for the head outline"
- For a house: "Sketch a loose rectangle for the building body"
- For a car: "Draw a rough horizontal rectangular shape for the main body"

Examples of BAD first steps (too detailed):
- "Draw a circle with two dots for eyes" (too many elements)
- "Sketch the house with windows outlined" (too advanced)

Remember: Less is more. Start with ONE or TWO basic shapes only.

Respond with only the JSON object.`;

    // Prepare the input for the AI - image + text prompt
    const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [
        { inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } },
        { text: prompt }
    ];

    // Use Gemini 2.5 Flash for fast analysis with structured JSON output
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    stepNumber: { type: Type.INTEGER },
                    totalSteps: { type: Type.INTEGER },
                    targetCompleteness: { type: Type.INTEGER },
                    whatToDraw: { type: Type.STRING },
                    drawingInstructions: { type: Type.STRING },
                    avoidance: { type: Type.STRING },
                },
                required: ["stepNumber", "totalSteps", "targetCompleteness", "whatToDraw", "drawingInstructions", "avoidance"],
            },
        }
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as ExpertInstruction;
};

/**
 * STEP 2: The AI illustrator creates the actual drawing based on expert instructions
 * This is where the visual magic happens - turning text instructions into images
 */
export const generateImageFromInstructions = async (
    originalImage: ImageObject,
    previousCanvas: ImageObject | null,
    instructions: ExpertInstruction
): Promise<ImageObject> => {
    
    const isFirstStep = instructions.stepNumber === 1;
    
    const prompt = `You are an AI illustrator following precise instructions from an expert drawing instructor.

STEP: ${instructions.stepNumber} of ${instructions.totalSteps}
TARGET COMPLETION: ${instructions.targetCompleteness}%

INSTRUCTIONS FROM EXPERT:
${instructions.drawingInstructions}

WHAT TO DRAW:
${instructions.whatToDraw}

CRITICAL - AVOID:
${instructions.avoidance}

${isFirstStep ? `
⚠️ FIRST STEP RULES:
- This is the FOUNDATION - must be extremely rough and simple
- Use loose, sketchy lines
- NO details, NO precision, NO refinement
- Think "10-second gesture sketch"
- Less is more - draw ONLY what's specified
` : `
REFINEMENT RULES:
- Take the previous drawing and make it ${instructions.targetCompleteness}% complete
- Add details gradually - don't jump ahead
- Maintain correct proportions from the reference image
- Refine the entire drawing, not just one area
`}

OUTPUT: Black and white line art on white background. No text or labels.`;

    // Build the input array - previous canvas (if any), reference image, and instructions
    const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [];
    
    // Include previous step if this isn't the first step
    if (previousCanvas) {
        parts.push({ inlineData: { data: previousCanvas.base64, mimeType: previousCanvas.mimeType } });
    }
    
    // Always include the original reference image
    parts.push({ inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } });
    parts.push({ text: prompt });

    // Use the image generation model to create the drawing
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    // Extract the generated image from the response
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
        }
    }

    throw new Error('Image generation failed to return an image.');
};

/**
 * STEP 3: Expert validates the generated image and provides quality feedback
 * This is the quality control step - ensures each step meets educational standards
 */
export const expertValidateImage = async (
    originalImage: ImageObject,
    generatedImage: ImageObject,
    previousCanvas: ImageObject | null,
    currentInstructions: ExpertInstruction
): Promise<ExpertValidation> => {
    
    const prompt = `You are an expert drawing instructor evaluating a student's work.

CONTEXT:
- This is step ${currentInstructions.stepNumber} of ${currentInstructions.totalSteps}
- Target completion: ${currentInstructions.targetCompleteness}%
- Instructions given: "${currentInstructions.whatToDraw}"

YOU WILL SEE:
1. The generated image (student's work)
2. The original reference image (final goal)
${previousCanvas ? '3. The previous step (what it looked like before)' : ''}

EVALUATION CRITERIA:

1. **Did it follow instructions?**
   - Does it contain what was asked?
   - Did it avoid what it should avoid?

2. **Is the detail level correct?**
   - At ${currentInstructions.targetCompleteness}%, is it too detailed or not detailed enough?
   ${currentInstructions.stepNumber === 1 ? '- CRITICAL: First step should be VERY rough. If clean/detailed, it FAILED.' : ''}

3. **Does it match the reference?**
   - Are proportions correct?
   - Is positioning accurate?

4. **Did it progress properly?**
   ${previousCanvas ? '- Does it show improvement from previous step?' : '- Is it a good starting point?'}

DECISION MAKING:
- Score 70-100: APPROVE and proceed to next step
- Score 0-69: REJECT and regenerate with feedback

If REGENERATING, provide specific feedback on what went wrong.
If PROCEEDING, provide instructions for the NEXT step (step ${currentInstructions.stepNumber + 1}).

For next step instructions, remember:
- Step ${currentInstructions.stepNumber + 1} target: ${Math.round(((currentInstructions.stepNumber + 1) / currentInstructions.totalSteps) * 100)}% completion
- Add only a little more detail than current step
- Be specific about what new elements to add
- Clearly state what NOT to do yet

Respond with only the JSON object.`;

    // Prepare input images for evaluation
    const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [
        { inlineData: { data: generatedImage.base64, mimeType: generatedImage.mimeType } },
        { inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } },
    ];

    // Include previous step for progression comparison if available
    if (previousCanvas) {
        parts.push({ inlineData: { data: previousCanvas.base64, mimeType: previousCanvas.mimeType } });
    }

    parts.push({ text: prompt });

    const nextStepNum = currentInstructions.stepNumber + 1;
    const isLastStep = nextStepNum > currentInstructions.totalSteps;

    // Get structured validation results from the expert
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    approved: { type: Type.BOOLEAN },
                    score: { type: Type.INTEGER },
                    issues: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    },
                    nextAction: {
                        type: Type.STRING,
                        enum: ["regenerate", "proceed"]
                    },
                    feedbackForRegeneration: { type: Type.STRING },
                    instructionsForNextStep: isLastStep ? { type: Type.NULL } : {
                        type: Type.OBJECT,
                        properties: {
                            stepNumber: { type: Type.INTEGER },
                            totalSteps: { type: Type.INTEGER },
                            targetCompleteness: { type: Type.INTEGER },
                            whatToDraw: { type: Type.STRING },
                            drawingInstructions: { type: Type.STRING },
                            avoidance: { type: Type.STRING },
                        },
                        required: ["stepNumber", "totalSteps", "targetCompleteness", "whatToDraw", "drawingInstructions", "avoidance"],
                    },
                },
                required: ["approved", "score", "issues", "nextAction"],
            },
        }
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as ExpertValidation;
};

/**
 * MAIN FUNCTION: Orchestrates the complete workflow for a single step
 * This is the heart of the system - it manages the generate -> validate -> retry loop
 */
export const generateValidatedStep = async (
    originalImage: ImageObject,
    previousCanvas: ImageObject | null,
    currentInstructions: ExpertInstruction,
    maxRetries: number = 3,
    userFeedback?: string
): Promise<{
    image: ImageObject;
    attempts: number;
    finalScore: number;
    validation: ExpertValidation;
}> => {
    
    // If user provided feedback, incorporate it into the instructions
    let instructions = currentInstructions;
    if (userFeedback && userFeedback.trim().length > 0) {
        instructions = {
            ...currentInstructions,
            drawingInstructions: `${currentInstructions.drawingInstructions}\n\nUSER FEEDBACK: ${userFeedback}`,
        };
    }

    // Keep track of all attempts for quality analysis
    const allAttempts: Array<{
        image: ImageObject;
        validation: ExpertValidation;
        score: number;
    }> = [];

    // Try up to maxRetries times to get an approved step
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Step ${instructions.stepNumber}, attempt ${attempt}/${maxRetries}`);
        
        // Generate the image based on current instructions
        const generatedImage = await generateImageFromInstructions(
            originalImage,
            previousCanvas,
            instructions
        );
        
        // Have the expert validate the generated image
        const validation = await expertValidateImage(
            originalImage,
            generatedImage,
            previousCanvas,
            instructions
        );
        
        console.log(`Expert validation - Score: ${validation.score}, Approved: ${validation.approved}`);
        console.log(`Issues:`, validation.issues);
        
        // Save this attempt for later analysis if needed
        allAttempts.push({
            image: generatedImage,
            validation,
            score: validation.score
        });
        
        // If approved, we're done with this step
        if (validation.approved) {
            console.log(`✅ Step ${instructions.stepNumber} approved on attempt ${attempt}`);
            return {
                image: generatedImage,
                attempts: attempt,
                finalScore: validation.score,
                validation
            };
        }
        
        // If not approved and we have retries left, improve instructions and try again
        if (attempt < maxRetries) {
            console.log(`❌ Step ${instructions.stepNumber} rejected, retrying with expert feedback...`);
            
            // Incorporate expert feedback into instructions for next attempt
            instructions = {
                ...instructions,
                drawingInstructions: `${instructions.drawingInstructions}\n\nEXPERT CORRECTION: ${validation.feedbackForRegeneration}`,
            };
        }
    }
    
    // No attempt was approved - select the best one we have
    console.warn(`⚠️ Step ${instructions.stepNumber} not approved after ${maxRetries} attempts, selecting best attempt`);
    
    // Find the attempt with the highest score
    const bestAttempt = allAttempts.reduce((best, current) => 
        current.score > best.score ? current : best
    );
    
    console.log(`📊 Best attempt: Score ${bestAttempt.score} (out of ${allAttempts.map(a => a.score).join(', ')})`);
    
    // Generate next step instructions if they're missing
    let finalValidation = bestAttempt.validation;
    if (!finalValidation.instructionsForNextStep && instructions.stepNumber < instructions.totalSteps) {
        console.log('Generating next step instructions...');
        // Re-run validation to get next step instructions
        finalValidation = await expertValidateImage(
            originalImage,
            bestAttempt.image,
            previousCanvas,
            instructions
        );
    }
    
    return {
        image: bestAttempt.image,
        attempts: maxRetries,
        finalScore: bestAttempt.score,
        validation: finalValidation
    };
};

/**
 * HIGH-LEVEL FUNCTION: Generates a complete tutorial with all steps in sequence
 * This is an alternative workflow that generates everything at once (not used in the interactive app)
 */
export const generateCompleteDrawingTutorial = async (
    originalImage: ImageObject,
    totalSteps: number = 10,
    onStepComplete?: (stepNumber: number, image: ImageObject, score: number) => void
): Promise<{
    steps: Array<{
        stepNumber: number;
        image: ImageObject;
        instructions: ExpertInstruction;
        score: number;
        attempts: number;
    }>;
}> => {
    const completedSteps: Array<{
        stepNumber: number;
        image: ImageObject;
        instructions: ExpertInstruction;
        score: number;
        attempts: number;
    }> = [];
    
    // Start by generating instructions for the first step
    let currentInstructions = await generateFirstStepInstructions(originalImage, totalSteps);
    let previousCanvas: ImageObject | null = null;
    
    // Generate all steps in sequence
    for (let i = 0; i < totalSteps; i++) {
        console.log(`\n=== Generating Step ${i + 1}/${totalSteps} ===`);
        
        // Generate and validate the current step
        const result = await generateValidatedStep(
            originalImage,
            previousCanvas,
            currentInstructions
        );
        
        // Save the completed step
        completedSteps.push({
            stepNumber: currentInstructions.stepNumber,
            image: result.image,
            instructions: currentInstructions,
            score: result.finalScore,
            attempts: result.attempts
        });
        
        // Optional callback for progress tracking
        if (onStepComplete) {
            onStepComplete(currentInstructions.stepNumber, result.image, result.finalScore);
        }
        
        // Update canvas for the next step
        previousCanvas = result.image;
        
        // Get instructions for the next step if available
        if (result.validation.instructionsForNextStep) {
            currentInstructions = result.validation.instructionsForNextStep;
        } else if (i < totalSteps - 1) {
            // Fallback: generate new instructions if missing
            console.warn('Missing next step instructions, generating new ones...');
            currentInstructions = {
                stepNumber: i + 2,
                totalSteps: totalSteps,
                targetCompleteness: Math.round(((i + 2) / totalSteps) * 100),
                whatToDraw: "Continue refining the drawing with more detail",
                drawingInstructions: "Add more details and refine the previous step",
                avoidance: "Don't skip ahead or add too many details at once"
            };
        }
    }
    
    return { steps: completedSteps };
};