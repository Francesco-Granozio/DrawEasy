import { GoogleGenAI, Type, Modality } from "@google/genai";
// FIX: Import shared ImageObject type.
import type { StepDescription, ImageObject } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const INSTRUCTION_FOR_STEPS = `
You are an expert drawing instructor. Your primary goal is to break down a complex drawing into many small, simple, easy-to-follow steps.
Analyze the provided drawing.
Your task is to generate a step-by-step tutorial to recreate this drawing. The tutorial should consist of 8-12 very simple, sequential steps. Each step should represent a single, small addition to the drawing.
For each step, provide a clear, one-sentence description of what to draw. The descriptions should be concise and action-oriented, describing only the new elements to add in that step. Do not combine multiple actions into one step.

Example for a simple house drawing:
- Step 1: "Draw a horizontal line for the ground."
- Step 2: "Add a large square on top of the ground line for the main body of the house."
- Step 3: "Draw a triangle on top of the square to form the roof."
- Step 4: "Add a small square for the door inside the house."
- Step 5: "Draw a small circle for the doorknob on the door."

Respond with only the JSON object.
`;

export const getDrawingSteps = async (imageBase64: string, mimeType: string): Promise<StepDescription[]> => {
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    };

    const textPart = {
        text: INSTRUCTION_FOR_STEPS
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    steps: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                step: { type: Type.INTEGER },
                                description: { type: Type.STRING },
                            },
                            required: ["step", "description"],
                        }
                    }
                },
                required: ["steps"],
            },
        }
    });
    
    const jsonStr = response.text.trim();
    const result = JSON.parse(jsonStr);

    return result.steps as StepDescription[];
};

export const getSubSteps = async (
    originalImage: ImageObject,
    canvasBeforeStep: ImageObject,
    canvasAfterStep: ImageObject,
    stepDescription: string
): Promise<Omit<StepDescription, 'step'>[]> => {
    const INSTRUCTION_FOR_SUB_STEPS = `You are an expert drawing instructor. The user wants to break down a single, complex drawing step into 2 or 3 simpler, sequential sub-steps. Your goal is to make the step easier for a beginner to draw.

**Your Task:**
- You will be provided with a text instruction and three images in the following order:
  1.  **Canvas Before:** The state of the drawing *before* the complex step was added.
  2.  **Canvas After:** The state of the drawing *after* the complex step was added. This shows the result that needs to be broken down.
  3.  **Reference Image:** The complete, final drawing for overall context.
- The original instruction for the complex step was: "${stepDescription}".
- Your task is to describe how to get from "Canvas Before" to "Canvas After" in 2 or 3 very simple steps.
- Analyze the difference between "Canvas Before" and "Canvas After" to identify all the new lines that were added.
- Create 2 or 3 new, very simple, one-sentence instructions that describe how to draw those new lines.
- The sub-steps must be in a logical drawing order.

**Example:**
If the original instruction was "Draw the car body", the sub-steps might be:
- "Draw the curved roofline of the car."
- "Draw the flat bottom line for the car's chassis."
- "Connect the roofline and chassis with two short, curved lines for the front and back."

Respond with only the JSON object containing the sub-steps. Do not add any other text.`;

    const parts = [
      { text: INSTRUCTION_FOR_SUB_STEPS },
      { inlineData: { data: canvasBeforeStep.base64, mimeType: canvasBeforeStep.mimeType } },
      { inlineData: { data: canvasAfterStep.base64, mimeType: canvasAfterStep.mimeType } },
      { inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } },
    ];

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subSteps: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                description: { type: Type.STRING },
                            },
                            required: ["description"],
                        }
                    }
                },
                required: ["subSteps"],
            },
        }
    });

    const jsonStr = response.text.trim();
    const result = JSON.parse(jsonStr);

    return result.subSteps as Omit<StepDescription, 'step'>[];
};

export const generateStepImage = async (
    originalImage: ImageObject,
    canvasImage: ImageObject,
    stepDescription: string,
    userFeedback?: string,
): Promise<ImageObject> => {
    
    let instruction = `You are a precise and meticulous illustrator AI. Your task is to perfectly replicate a single step in a drawing tutorial. You must act as a perfect copying tool, not a creative artist.

You will be provided with a text instruction and two images in the following order:
1.  **Canvas Image:** This is the current state of the drawing. It might be blank or have lines from previous steps.
2.  **Reference Image:** This is the complete, final drawing. It is your absolute guide for placement, style, and proportions. You must not deviate from it in any way.

The current instruction is: "${stepDescription}".

**Your Critical Mission:**
- Draw *only* the new elements described in the instruction.
- **ABSOLUTE RULE:** You MUST NOT invent any details or elements that are not present in the **Reference Image**.
- **PRECISION IS KEY:** The new elements you draw on the canvas **MUST** be in the exact same position and have the exact same proportions as they appear in the **Reference Image**.
- Do not alter or redraw any existing lines on the canvas. Your output must include everything from the original canvas plus the new elements.
- The final output must be a clean, black and white line art image on a plain white background.
- Output ONLY the final image. Do not add any text, labels, or annotations.`;

    if (userFeedback && userFeedback.trim().length > 0) {
        instruction += `\n\n**Important Correction:** A previous attempt was incorrect. Please adhere to the following user feedback: "${userFeedback}". Re-evaluate the instruction and the reference image to ensure the new output is correct.`;
    }

    const parts = [
      { text: instruction },
      { inlineData: { data: canvasImage.base64, mimeType: canvasImage.mimeType } },
      { inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } },
    ];

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