import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  LanguageModelV1,
  LanguageModelV1Prompt,
  NoContentGeneratedError,
} from "@ai-sdk/provider";
import { InflectionChatLanguageModel } from "./inflection-chat-language-model";

export type GenerateObjectOptions = {
  model: LanguageModelV1;
  prompt: LanguageModelV1Prompt;
  output?: "object" | "array" | "enum" | "no-schema";
  schema?: z.ZodType;
  enum?: string[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
};

export async function generateObject({
  model,
  prompt,
  output = "object",
  schema,
  enum: enumValues,
  maxTokens,
  temperature,
  topP,
  stopSequences,
}: GenerateObjectOptions) {
  // Validate that the model is an Inflection model
  if (!(model instanceof InflectionChatLanguageModel)) {
    throw new Error("Model must be an Inflection AI model");
  }

  // Validate output strategy requirements
  if (output === "enum" && !enumValues?.length) {
    throw new Error(
      "Enum values must be provided when using enum output strategy"
    );
  }

  if ((output === "object" || output === "array") && !schema) {
    throw new Error(
      "Schema must be provided when using object or array output strategy"
    );
  }

  // Convert schema to JSON Schema if provided
  let jsonSchema: string | undefined;
  if (schema) {
    const converted = zodToJsonSchema(schema);
    jsonSchema = JSON.stringify(converted);
  }

  // Prepare the system message based on output strategy
  let systemMessage = "";
  switch (output) {
    case "object":
      systemMessage = schema
        ? `You must respond with a valid JSON object that strictly conforms to this schema: ${jsonSchema}. Do not include any explanatory text, only output valid JSON.`
        : "You must respond with a valid JSON object. Do not include any explanatory text, only output valid JSON.";
      break;
    case "array":
      systemMessage = schema
        ? `You must respond with a JSON array where each element strictly conforms to this schema: ${jsonSchema}. Do not include any explanatory text, only output valid JSON.`
        : "You must respond with a JSON array. Do not include any explanatory text, only output valid JSON.";
      break;
    case "enum":
      // We can safely use ! here because we validated enumValues exists above
      const validValues = enumValues!.join(", ");
      systemMessage = `You must respond with exactly one of these values: ${validValues}. Do not include any explanatory text or quotes, only output the exact value.`;
      break;
    case "no-schema":
      systemMessage =
        "You must respond with valid JSON. Do not include any explanatory text, only output valid JSON.";
      break;
  }

  // Add system message to prompt
  const fullPrompt: LanguageModelV1Prompt = [
    { role: "system", content: systemMessage },
    ...prompt,
  ];

  try {
    // Make the API call
    const response = await model.doGenerate({
      inputFormat: "prompt",
      mode: {
        type: "regular",
      },
      prompt: fullPrompt,
      maxTokens,
      temperature,
      topP,
      stopSequences,
      responseFormat: output === "enum" ? undefined : { type: "json" },
    });

    if (!response.text) {
      throw new NoContentGeneratedError({
        message: "No content was generated",
      });
    }

    // Parse and validate the response
    let parsedResponse: unknown;

    if (output === "enum") {
      // For enum output, use the raw text
      parsedResponse = response.text.trim();
    } else {
      // For other outputs, parse as JSON
      try {
        parsedResponse = JSON.parse(response.text);
      } catch (error) {
        throw new NoContentGeneratedError({
          message: `Failed to parse JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }

    // Validate against schema if provided
    if (schema) {
      try {
        if (output === "array") {
          // For array output, wrap the schema in an array
          const arraySchema = z.array(schema);
          parsedResponse = arraySchema.parse(parsedResponse);
        } else {
          parsedResponse = schema.parse(parsedResponse);
        }
      } catch (error) {
        throw new NoContentGeneratedError({
          message: `Schema validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }

    // For enum output, validate against enum values
    if (output === "enum") {
      const enumSchema = z.enum(enumValues as [string, ...string[]]);
      try {
        parsedResponse = enumSchema.parse(parsedResponse);
      } catch (error) {
        throw new NoContentGeneratedError({
          message: `Invalid enum value: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }

    return {
      object: parsedResponse,
      response: response.response,
      usage: response.usage,
    };
  } catch (error) {
    if (error instanceof NoContentGeneratedError) {
      throw error;
    }
    throw new NoContentGeneratedError({
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
