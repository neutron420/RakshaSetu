import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { env } from "../../config/env";

const outputSchema = z.object({
  translatedText: z.string().describe("The exact English translation of the user's SOS message. If it's already in English, just return the exact message."),
  emergencyType: z.string().describe("The best category for the emergency: FLOOD, FIRE, EARTHQUAKE, ACCIDENT, MEDICAL, VIOLENCE, LANDSLIDE, CYCLONE, OTHER."),
  severityScore: z.number().describe("Rate the urgency from 1 to 10 based on the text. 10 is immediate life-threatening danger."),
});

const parser = StructuredOutputParser.fromZodSchema(outputSchema);

export async function processSOSMessage(rawUserText: string) {
  if (!env.nodeEnv) {
     // Skip if not configured properly, or missing keys
  }

  const promptTemplate = new PromptTemplate({
    template: `You are an emergency responder AI for India.
    Translate the following SOS message strictly into English.
    Determine the emergency type from the allowed list: FLOOD, FIRE, EARTHQUAKE, ACCIDENT, MEDICAL, VIOLENCE, LANDSLIDE, CYCLONE, OTHER.
    Rate the severity out of 10.
    
    SOS Message: {userInput}
    
    {formatInstructions}
    
    RETURN ONLY VALID JSON.`,
    
    inputVariables: ["userInput"],
    partialVariables: { formatInstructions: parser.getFormatInstructions() },
  });

  const model = new ChatOpenAI({ 
    modelName: "gpt-4o-mini", 
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY // Ensure the key is loaded
  });

  const chain = promptTemplate.pipe(model).pipe(parser);

  try {
    const result = await chain.invoke({
      userInput: rawUserText,
    });
    
    return result; 
  } catch (err) {
    console.error("[AI Services] SOS Translation Failed:", err);
    return null;
  }
}
