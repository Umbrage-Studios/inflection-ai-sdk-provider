import {
  LanguageModelV1Prompt,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";
import { InflectionChatModelId } from "./inflection-chat-settings";

/**
 * Represents a message in the Inflection AI format
 */
export interface InflectionMessage {
  /** The type of the message sender */
  type: "Human" | "AI" | "Instruction" | "Tool";
  /** The text content of the message */
  text: string;
  /** Optional timestamp in seconds since epoch */
  ts?: number;
  /** Tool calls if present */
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  /** Tool call ID for tool results */
  tool_call_id?: string;
}

export type InflectionContext = InflectionMessage[];

/**
 * Converts a Language Model prompt to Inflection AI's context format
 * @param prompt The input prompt in the Language Model format
 * @param modelId The Inflection model ID being used
 * @returns An array of messages in Inflection AI's format
 * @throws {UnsupportedFunctionalityError} If the prompt contains unsupported content types
 */
export function convertToInflectionChatMessages(
  prompt: LanguageModelV1Prompt,
  modelId: InflectionChatModelId = "inflection_3_pi"
): InflectionContext {
  const context: InflectionContext = [];

  for (const { role, content } of prompt) {
    let text = "";
    const toolCalls: InflectionMessage["tool_calls"] = [];

    if (typeof content === "string") {
      text = content;
    } else {
      // Combine all text parts into a single string
      for (const part of content) {
        switch (part.type) {
          case "text": {
            text += part.text;
            break;
          }
          case "tool-call": {
            if (modelId !== "inflection_3_with_tools") {
              throw new UnsupportedFunctionalityError({
                functionality:
                  "Tool calls are only supported with the inflection_3_with_tools model",
              });
            }
            toolCalls.push({
              id: part.toolCallId,
              type: "function",
              function: {
                name: part.toolName,
                arguments: JSON.stringify(part.args),
              },
            });
            break;
          }
          case "tool-result": {
            if (modelId !== "inflection_3_with_tools") {
              throw new UnsupportedFunctionalityError({
                functionality:
                  "Tool results are only supported with the inflection_3_with_tools model",
              });
            }
            text = JSON.stringify(part.result);
            break;
          }
          case "image": {
            throw new UnsupportedFunctionalityError({
              functionality:
                "Image content parts are not supported by Inflection AI at this time",
            });
          }
          case "file": {
            throw new UnsupportedFunctionalityError({
              functionality:
                "File content parts are not supported by Inflection AI at this time",
            });
          }
          default: {
            const _exhaustiveCheck: never = part;
            throw new Error(
              `Unsupported content part type: ${_exhaustiveCheck}`
            );
          }
        }
      }
    }

    // Skip empty messages unless they have tool calls
    if (!text && !toolCalls.length) {
      continue;
    }

    // Map the role to Inflection's expected type
    switch (role) {
      case "user": {
        context.push({ type: "Human", text });
        break;
      }
      case "assistant": {
        context.push({
          type: "AI",
          text,
          ...(modelId === "inflection_3_with_tools" && toolCalls.length > 0
            ? { tool_calls: toolCalls }
            : {}),
        });
        break;
      }
      case "system": {
        context.push({ type: "Instruction", text });
        break;
      }
      case "tool": {
        // Only add tool messages if they have content
        if (text) {
          const toolCallId =
            typeof content === "string"
              ? undefined
              : content.find((part) => part.type === "tool-result")?.toolCallId;
          context.push({
            type: "Tool",
            text,
            ...(toolCallId ? { tool_call_id: toolCallId } : {}),
          });
        }
        break;
      }
      default: {
        const _exhaustiveCheck: never = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }

  return context;
}
