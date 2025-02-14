import {
  LanguageModelV1,
  LanguageModelV1CallWarning,
  LanguageModelV1FinishReason,
  LanguageModelV1StreamPart,
  LanguageModelV1FunctionTool,
  LanguageModelV1FunctionToolCall,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";
import {
  FetchFunction,
  ParseResult,
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  postJsonToApi,
} from "@ai-sdk/provider-utils";
import { z } from "zod";
import { convertToInflectionChatMessages } from "./convert-to-inflection-chat-messages";
import {
  InflectionChatModelId,
  InflectionChatSettings,
  InflectionTool,
} from "./inflection-chat-settings";
import { inflectionFailedResponseHandler } from "./inflection-error";
import { getResponseMetadata } from "./get-response-metadata";

type InflectionChatConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

// Custom type for tool call stream part that includes required fields
type InflectionToolCallStreamPart = {
  type: "tool-call";
  created: number;
  idx: number;
  text: string;
} & LanguageModelV1FunctionToolCall;

export class InflectionChatLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = "v1";
  readonly defaultObjectGenerationMode = "json";
  readonly supportsImageUrls = false;

  readonly modelId: InflectionChatModelId;
  readonly settings: InflectionChatSettings;

  private readonly config: InflectionChatConfig;

  constructor(
    modelId: InflectionChatModelId,
    settings: InflectionChatSettings,
    config: InflectionChatConfig
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  private getArgs({
    mode,
    prompt,
    maxTokens,
    temperature,
    topP,
    stopSequences,
    seed,
  }: Parameters<LanguageModelV1["doGenerate"]>[0]) {
    const type = mode.type;
    const warnings: LanguageModelV1CallWarning[] = [];

    // Only allow tools with inflection_3_with_tools model
    if (
      type === "regular" &&
      mode.tools?.length &&
      this.modelId !== "inflection_3_with_tools"
    ) {
      throw new UnsupportedFunctionalityError({
        functionality:
          "Tool calls are only supported with the inflection_3_with_tools model",
      });
    }

    // Convert tools to Inflection format if present
    const tools =
      type === "regular" && mode.tools?.length
        ? mode.tools
            .filter(
              (tool): tool is LanguageModelV1FunctionTool =>
                tool.type === "function"
            )
            .map(
              (tool): InflectionTool => ({
                type: "function",
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: {
                    type: "object",
                    properties: tool.parameters.properties,
                    required: tool.parameters.required,
                  },
                },
              })
            )
        : undefined;

    const baseArgs = {
      // config instead of model:
      config: this.modelId,

      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      stop_tokens: stopSequences,
      web_search: this.settings.web_search,

      // metadata if provided:
      metadata: this.settings.metadata,

      // context (messages):
      context: convertToInflectionChatMessages(prompt, this.modelId),

      // tools if present:
      tools,
    };

    return { args: baseArgs, warnings };
  }

  async doGenerate(
    options: Parameters<LanguageModelV1["doGenerate"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> {
    const { args, warnings } = this.getArgs(options);

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.baseURL,
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: inflectionFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        inflectionChatResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const { context: rawPrompt, ...rawSettings } = args;

    // Estimate token counts since API doesn't provide them
    const promptText = rawPrompt.map((m) => m.text).join("");
    const promptTokens = Math.ceil(promptText.length / 4);
    const completionTokens = Math.ceil(response.text.length / 4);

    // Convert tool calls to the expected format
    const toolCalls = response.tool_calls?.map(
      (call): LanguageModelV1FunctionToolCall => ({
        toolCallType: "function",
        toolCallId: call.id,
        toolName: call.function.name,
        args: JSON.parse(call.function.arguments),
      })
    );

    return {
      text: response.text,
      finishReason: response.tool_calls?.length ? "tool-calls" : "stop",
      usage: {
        promptTokens,
        completionTokens,
      },
      toolCalls,
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      request: { body: JSON.stringify(args) },
      response: getResponseMetadata(response),
      warnings,
    };
  }

  async doStream(
    options: Parameters<LanguageModelV1["doStream"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV1["doStream"]>>> {
    const { args, warnings } = this.getArgs(options);
    const { context: rawPrompt, ...rawSettings } = args;

    // Check if we should use the OpenAI API endpoint
    const useOpenAIEndpoint =
      this.modelId === "inflection_3_with_tools" &&
      options.mode.type === "regular" &&
      (options.mode.tools?.length ?? 0) > 0;

    const url = useOpenAIEndpoint
      ? `${this.config.baseURL}/openai/v1/chat/completions`
      : `${this.config.baseURL}/streaming`;

    const body = useOpenAIEndpoint
      ? {
          model: this.modelId,
          stream: true,
          messages: convertPromptToOpenAIMessages(options.prompt),
          tools:
            options.mode.type === "regular"
              ? options.mode.tools
                  ?.map((tool) => {
                    if (tool.type !== "function") return null;
                    return {
                      type: "function" as const,
                      function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.parameters,
                      },
                    };
                  })
                  .filter((t): t is NonNullable<typeof t> => t !== null)
              : undefined,
        }
      : { ...args, stream: true };

    const { responseHeaders, value: response } = await postJsonToApi({
      url,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: inflectionFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(z.unknown()),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: LanguageModelV1FinishReason = "stop";
    const promptText = rawPrompt.map((m) => m.text).join("");
    const promptTokens = Math.ceil(promptText.length / 4);
    let completionTokens = 0;

    return {
      stream: response.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            if (!chunk.success) {
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }

            try {
              if (useOpenAIEndpoint) {
                // Handle OpenAI API format
                const value = openAIStreamChunkSchema.parse(chunk.value);
                const choice = value.choices[0];
                const delta = choice.delta;

                if (delta.content) {
                  completionTokens += Math.ceil(delta.content.length / 4);
                  controller.enqueue({
                    type: "text-delta",
                    textDelta: delta.content,
                  });
                }

                if (delta.tool_calls?.length) {
                  for (const call of delta.tool_calls) {
                    try {
                      // Emit tool-call-delta for the arguments
                      controller.enqueue({
                        type: "tool-call-delta",
                        toolCallType: "function",
                        toolCallId: call.id,
                        toolName: call.function.name,
                        argsTextDelta: call.function.arguments,
                      });

                      // Try to parse the arguments to see if they're complete
                      const args = JSON.parse(call.function.arguments);
                      controller.enqueue({
                        type: "tool-call",
                        toolCallType: "function",
                        toolCallId: call.id,
                        toolName: call.function.name,
                        args,
                      });
                    } catch (error) {
                      // If JSON parsing fails, emit an error but don't break the stream
                      controller.enqueue({
                        type: "error",
                        error: new Error(
                          `Failed to process tool call: ${error instanceof Error ? error.message : "Unknown error"}`
                        ),
                      });
                    }
                  }
                  finishReason = "tool-calls";
                }

                if (choice.finish_reason) {
                  finishReason =
                    choice.finish_reason === "tool_calls"
                      ? "tool-calls"
                      : choice.finish_reason === "content-filter"
                        ? "content-filter"
                        : choice.finish_reason;
                }
              } else {
                // Handle Inflection API format
                const value = inflectionStreamChunkSchema.parse(chunk.value);
                completionTokens += Math.ceil(value.text.length / 4);

                if (value.idx === 0) {
                  controller.enqueue({
                    type: "response-metadata",
                    timestamp: new Date(value.created * 1000),
                  });
                }

                if (value.text) {
                  controller.enqueue({
                    type: "text-delta",
                    textDelta: value.text,
                  });
                }

                if (value.tool_calls?.length) {
                  for (const call of value.tool_calls) {
                    try {
                      const args = JSON.parse(call.function.arguments);
                      controller.enqueue({
                        type: "tool-call",
                        toolCallType: "function",
                        toolCallId: call.id,
                        toolName: call.function.name,
                        args,
                      });
                    } catch (error) {
                      controller.enqueue({
                        type: "error",
                        error: new Error(
                          `Failed to process tool call: ${error instanceof Error ? error.message : "Unknown error"}`
                        ),
                      });
                    }
                  }
                  finishReason = "tool-calls";
                }
              }
            } catch (error) {
              controller.enqueue({
                type: "error",
                error: new Error(
                  `Failed to parse response: ${error instanceof Error ? error.message : "Unknown error"}`
                ),
              });
            }
          },

          flush(controller) {
            controller.enqueue({
              type: "finish",
              finishReason,
              usage: {
                promptTokens,
                completionTokens,
              },
            });
          },
        })
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      request: { body: JSON.stringify(body) },
      warnings,
    };
  }
}

// Update response schemas to include tool calls
const inflectionToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const inflectionChatResponseSchema = z.object({
  created: z.number(),
  text: z.string(),
  tool_calls: z
    .array(inflectionToolCallSchema)
    .nullable()
    .transform((val) => val ?? [])
    .optional(),
});

const inflectionStreamChunkSchema = z.object({
  created: z.number(),
  idx: z.number(),
  text: z.string(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      })
    )
    .optional(),
});

type OpenAIStreamChunk = z.infer<typeof openAIStreamChunkSchema>;
type InflectionStreamChunk = z.infer<typeof inflectionStreamChunkSchema>;

// Helper function to convert internal prompt to OpenAI messages format
function convertPromptToOpenAIMessages(
  prompt: Parameters<LanguageModelV1["doGenerate"]>[0]["prompt"]
): Array<{
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}> {
  return prompt.map(({ role, content }) => {
    if (typeof content === "string") {
      return { role, content };
    }

    let textContent = "";
    const toolCalls: Array<{
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string;
      };
    }> = [];

    for (const part of content) {
      switch (part.type) {
        case "text":
          textContent += part.text;
          break;
        case "tool-call":
          toolCalls.push({
            id: part.toolCallId,
            type: "function",
            function: {
              name: part.toolName,
              arguments: JSON.stringify(part.args),
            },
          });
          break;
        case "tool-result":
          textContent = JSON.stringify(part.result);
          break;
        default:
          // Skip other content types as they're not supported
          break;
      }
    }

    const message: {
      role: typeof role;
      content: string;
      tool_calls?: typeof toolCalls;
      tool_call_id?: string;
    } = {
      role,
      content: textContent,
    };

    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }

    if (role === "tool") {
      const toolResult = content.find(
        (
          part
        ): part is {
          type: "tool-result";
          toolCallId: string;
          toolName: string;
          result: unknown;
        } => part.type === "tool-result"
      );
      if (toolResult) {
        message.tool_call_id = toolResult.toolCallId;
      }
    }

    return message;
  });
}

// Schema for OpenAI API streaming responses
const openAIStreamChunkSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion.chunk"),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      delta: z.object({
        content: z.string().optional(),
        tool_calls: z
          .array(
            z.object({
              id: z.string(),
              type: z.literal("function"),
              function: z.object({
                name: z.string(),
                arguments: z.string(),
              }),
            })
          )
          .optional(),
      }),
      finish_reason: z
        .enum(["stop", "length", "content-filter", "tool_calls"])
        .nullable(),
    })
  ),
});
