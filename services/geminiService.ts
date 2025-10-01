import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { ImageObject, ExpertInstruction, ExpertValidation } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });



/**
 * STEP 1: L'esperto analizza l'immagine e decide il primo step
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

    const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [
        { inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } },
        { text: prompt }
    ];

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
 * STEP 2: Il disegnatore genera l'immagine basandosi sulle istruzioni dell'esperto
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

    const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [];
    
    if (previousCanvas) {
        parts.push({ inlineData: { data: previousCanvas.base64, mimeType: previousCanvas.mimeType } });
    }
    
    parts.push({ inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } });
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
        }
    }

    throw new Error('Image generation failed to return an image.');
};

/**
 * STEP 3: L'esperto valida l'immagine generata
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

    const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [
        { inlineData: { data: generatedImage.base64, mimeType: generatedImage.mimeType } },
        { inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } },
    ];

    if (previousCanvas) {
        parts.push({ inlineData: { data: previousCanvas.base64, mimeType: previousCanvas.mimeType } });
    }

    parts.push({ text: prompt });

    const nextStepNum = currentInstructions.stepNumber + 1;
    const isLastStep = nextStepNum > currentInstructions.totalSteps;

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
 * FUNZIONE PRINCIPALE: Gestisce l'intero ciclo per uno step
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
    
    // Se c'è feedback dall'utente, modificiamo le istruzioni
    let instructions = currentInstructions;
    if (userFeedback && userFeedback.trim().length > 0) {
        instructions = {
            ...currentInstructions,
            drawingInstructions: `${currentInstructions.drawingInstructions}\n\nUSER FEEDBACK: ${userFeedback}`,
        };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Step ${instructions.stepNumber}, attempt ${attempt}/${maxRetries}`);
        
        // Genera l'immagine
        const generatedImage = await generateImageFromInstructions(
            originalImage,
            previousCanvas,
            instructions
        );
        
        // L'esperto valida
        const validation = await expertValidateImage(
            originalImage,
            generatedImage,
            previousCanvas,
            instructions
        );
        
        console.log(`Expert validation - Score: ${validation.score}, Approved: ${validation.approved}`);
        console.log(`Issues:`, validation.issues);
        
        // Se approvato, ritorna
        if (validation.approved) {
            console.log(`✅ Step ${instructions.stepNumber} approved on attempt ${attempt}`);
            return {
                image: generatedImage,
                attempts: attempt,
                finalScore: validation.score,
                validation
            };
        }
        
        // Se non approvato e non è l'ultimo tentativo, riprova con feedback
        if (attempt < maxRetries) {
            console.log(`❌ Step ${instructions.stepNumber} rejected, retrying with expert feedback...`);
            
            // Aggiorna le istruzioni con il feedback dell'esperto
            instructions = {
                ...instructions,
                drawingInstructions: `${instructions.drawingInstructions}\n\nEXPERT CORRECTION: ${validation.feedbackForRegeneration}`,
            };
        }
    }
    
    // Fallback: dopo tutti i tentativi, genera un'ultima volta e ritorna comunque
    console.warn(`⚠️ Step ${instructions.stepNumber} not approved after ${maxRetries} attempts, using last attempt`);
    
    const finalImage = await generateImageFromInstructions(
        originalImage,
        previousCanvas,
        instructions
    );
    
    const finalValidation = await expertValidateImage(
        originalImage,
        finalImage,
        previousCanvas,
        instructions
    );
    
    return {
        image: finalImage,
        attempts: maxRetries,
        finalScore: finalValidation.score,
        validation: finalValidation
    };
};

/**
 * FUNZIONE DI ALTO LIVELLO: Genera tutti gli step in sequenza
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
    
    // Genera istruzioni per il primo step
    let currentInstructions = await generateFirstStepInstructions(originalImage, totalSteps);
    let previousCanvas: ImageObject | null = null;
    
    for (let i = 0; i < totalSteps; i++) {
        console.log(`\n=== Generating Step ${i + 1}/${totalSteps} ===`);
        
        // Genera e valida lo step corrente
        const result = await generateValidatedStep(
            originalImage,
            previousCanvas,
            currentInstructions
        );
        
        completedSteps.push({
            stepNumber: currentInstructions.stepNumber,
            image: result.image,
            instructions: currentInstructions,
            score: result.finalScore,
            attempts: result.attempts
        });
        
        // Callback opzionale
        if (onStepComplete) {
            onStepComplete(currentInstructions.stepNumber, result.image, result.finalScore);
        }
        
        // Aggiorna canvas per il prossimo step
        previousCanvas = result.image;
        
        // Ottieni istruzioni per il prossimo step (se esiste)
        if (result.validation.instructionsForNextStep) {
            currentInstructions = result.validation.instructionsForNextStep;
        } else if (i < totalSteps - 1) {
            // Fallback: genera nuove istruzioni se mancano
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