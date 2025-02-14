import { expect, describe, it, beforeEach } from "vitest";
import { LanguageModelV1Prompt } from "@ai-sdk/provider";
import {
  createTestServer,
  convertReadableStreamToArray,
} from "@ai-sdk/provider-utils/test";
import { createInflection } from "./inflection-provider";

const TEST_PROMPT: LanguageModelV1Prompt = [
  { role: "user", content: [{ type: "text", text: "Hello" }] },
];

const INFERENCE_URL =
  "https://layercake.pubwestus3.inf7ks8.com/external/api/inference";
const STREAMING_URL = `${INFERENCE_URL}/streaming`;
const OPENAI_STREAMING_URL = `${INFERENCE_URL}/openai/v1/chat/completions`;

// Sample tool for testing
const TEST_TOOL = {
  type: "function" as const,
  name: "get_weather",
  description: "Get the current weather in a location",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The city and state, e.g. San Francisco, CA",
      },
    },
    required: ["location"],
  },
};

/**
 * Test server for mocking API responses
 */
const server = createTestServer({
  [INFERENCE_URL]: {
    response: {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: "Hello there!",
      },
    },
  },
  [STREAMING_URL]: {
    response: {
      type: "stream-chunks",
      chunks: [
        '{"created": 1728094708.2514212, "idx": 0, "text": "Hello"}',
        '{"created": 1728094708.5789802, "idx": 1, "text": " there"}',
        '{"created": 1728094708.7364252, "idx": 2, "text": "!"}',
      ],
    },
  },
  [OPENAI_STREAMING_URL]: {
    response: {
      type: "stream-chunks",
      chunks: [
        'data: {"id":"1","object":"chat.completion.chunk","created":1728094708,"model":"inflection_3_with_tools","choices":[{"index":0,"delta":{"content":"Let me check the weather for you."},"finish_reason":null}]}\n\n',
        'data: {"id":"2","object":"chat.completion.chunk","created":1728094709,"model":"inflection_3_with_tools","choices":[{"index":0,"delta":{"tool_calls":[{"id":"call_123","type":"function","function":{"name":"get_weather","arguments":"{\\"location\\": \\"San Francisco, CA\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
      ],
    },
  },
});

beforeEach(() => {
  // Reset the test server before each test
  server.urls[INFERENCE_URL].response = {
    type: "json-value",
    body: {
      created: 1714688002.0557644,
      text: "Hello there!",
    },
  };
  server.urls[STREAMING_URL].response = {
    type: "stream-chunks",
    chunks: [
      '{"created": 1728094708.2514212, "idx": 0, "text": "Hello"}',
      '{"created": 1728094708.5789802, "idx": 1, "text": " there"}',
      '{"created": 1728094708.7364252, "idx": 2, "text": "!"}',
    ],
  };
  server.urls[OPENAI_STREAMING_URL].response = {
    type: "stream-chunks",
    chunks: [
      'data: {"id":"1","object":"chat.completion.chunk","created":1728094708,"model":"inflection_3_with_tools","choices":[{"index":0,"delta":{"content":"Let me check the weather for you."},"finish_reason":null}]}\n\n',
      'data: {"id":"2","object":"chat.completion.chunk","created":1728094709,"model":"inflection_3_with_tools","choices":[{"index":0,"delta":{"tool_calls":[{"id":"call_123","type":"function","function":{"name":"get_weather","arguments":"{\\"location\\": \\"San Francisco, CA\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
    ],
  };
});

const provider = createInflection({
  apiKey: "test-api-key",
  baseURL: INFERENCE_URL,
});

const model = provider.chat("inflection_3_pi");

describe("doGenerate", () => {
  it("should extract text response", async () => {
    server.urls[INFERENCE_URL].response = {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: "Hello there!",
      },
    };

    const result = await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: TEST_PROMPT,
    });

    expect(result.text).toBe("Hello there!");
  });

  it("should throw error when trying to use tools", async () => {
    await expect(
      model.doGenerate({
        inputFormat: "prompt",
        mode: {
          type: "regular",
          tools: [
            {
              type: "function",
              name: "weatherTool",
              description: "Get weather information",
              parameters: { type: "object", properties: {} },
            },
          ],
        },
        prompt: TEST_PROMPT,
      })
    ).rejects.toThrow(
      "Tool calls are only supported with the inflection_3_with_tools model"
    );
  });

  it("should extract usage", async () => {
    server.urls[INFERENCE_URL].response = {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: "Hello there!",
      },
    };

    const { usage } = await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: TEST_PROMPT,
    });

    // Since Inflection API doesn't return usage info, we should expect undefined or estimated values
    expect(usage).toStrictEqual({
      promptTokens: expect.any(Number),
      completionTokens: expect.any(Number),
    });
  });
});

describe("doStream", () => {
  it("should stream text deltas", async () => {
    server.urls[STREAMING_URL].response = {
      type: "stream-chunks",
      chunks: ["Hello", " there", "!"],
    };

    const result = await model.doStream({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: TEST_PROMPT,
    });

    const parts = await convertReadableStreamToArray(result.stream);
    expect(parts).toMatchSnapshot();
  });
});

describe("Tool Calling", () => {
  it("should allow tool calls with inflection_3_with_tools model", async () => {
    const model = provider.chat("inflection_3_with_tools");

    server.urls[INFERENCE_URL].response = {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: "Let me check the weather for you.",
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"location": "San Francisco, CA"}',
            },
          },
        ],
      },
    };

    const result = await model.doGenerate({
      inputFormat: "prompt",
      mode: {
        type: "regular",
        tools: [TEST_TOOL],
      },
      prompt: TEST_PROMPT,
    });

    expect(result.text).toBe("Let me check the weather for you.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls?.[0]).toEqual({
      toolCallType: "function",
      toolCallId: "call_123",
      toolName: "get_weather",
      args: { location: "San Francisco, CA" },
    });
    expect(result.finishReason).toBe("tool-calls");
  });

  it("should allow empty tools array on any model", async () => {
    const model = provider.chat("inflection_3_pi");

    const result = await model.doGenerate({
      inputFormat: "prompt",
      mode: {
        type: "regular",
        tools: [], // Empty tools array
      },
      prompt: TEST_PROMPT,
    });

    expect(result.finishReason).toBe("stop");
    expect(result.toolCalls).toBeUndefined();
  });

  it("should reject tool calls with other models", async () => {
    const model = provider.chat("inflection_3_pi");

    await expect(
      model.doGenerate({
        inputFormat: "prompt",
        mode: {
          type: "regular",
          tools: [TEST_TOOL],
        },
        prompt: TEST_PROMPT,
      })
    ).rejects.toThrow(
      "Tool calls are only supported with the inflection_3_with_tools model"
    );
  });

  it("should handle malformed tool call responses", async () => {
    const model = provider.chat("inflection_3_with_tools");

    server.urls[INFERENCE_URL].response = {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: "Let me check the weather for you.",
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "get_weather",
              arguments: "invalid json here",
            },
          },
        ],
      },
    };

    await expect(
      model.doGenerate({
        inputFormat: "prompt",
        mode: {
          type: "regular",
          tools: [TEST_TOOL],
        },
        prompt: TEST_PROMPT,
      })
    ).rejects.toThrow(); // Should throw when trying to parse invalid JSON
  });

  it("should handle streaming with tool calls", async () => {
    const model = provider.chat("inflection_3_with_tools");

    const result = await model.doStream({
      inputFormat: "prompt",
      mode: {
        type: "regular",
        tools: [TEST_TOOL],
      },
      prompt: TEST_PROMPT,
    });

    const parts = await convertReadableStreamToArray(result.stream);
    expect(parts).toMatchSnapshot();
  });

  it("should handle multiple tool calls in response", async () => {
    const model = provider.chat("inflection_3_with_tools");

    server.urls[INFERENCE_URL].response = {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: "Let me check multiple things.",
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"location": "San Francisco, CA"}',
            },
          },
          {
            id: "call_124",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"location": "New York, NY"}',
            },
          },
        ],
      },
    };

    const result = await model.doGenerate({
      inputFormat: "prompt",
      mode: {
        type: "regular",
        tools: [TEST_TOOL],
      },
      prompt: TEST_PROMPT,
    });

    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls?.map((call) => call.toolCallId)).toEqual([
      "call_123",
      "call_124",
    ]);
  });

  it("should properly format tool calls in streaming mode", async () => {
    const model = provider.chat("inflection_3_with_tools");

    const result = await model.doStream({
      inputFormat: "prompt",
      mode: {
        type: "regular",
        tools: [TEST_TOOL],
      },
      prompt: TEST_PROMPT,
    });

    const parts = await convertReadableStreamToArray(result.stream);

    // Verify the stream parts are properly formatted
    expect(parts).toContainEqual({
      type: "text-delta",
      textDelta: "Let me check the weather for you.",
    });

    // Verify tool call has all required fields
    expect(parts).toContainEqual({
      type: "tool-call-delta",
      toolCallType: "function",
      toolCallId: "call_123",
      toolName: "get_weather",
      argsTextDelta: '{"location": "San Francisco, CA"}',
    });

    expect(parts).toContainEqual({
      type: "tool-call",
      toolCallType: "function",
      toolCallId: "call_123",
      toolName: "get_weather",
      args: { location: "San Francisco, CA" },
    });

    // Verify finish part
    expect(parts).toContainEqual({
      type: "finish",
      finishReason: "tool-calls",
      usage: {
        promptTokens: expect.any(Number),
        completionTokens: expect.any(Number),
      },
    });
  });
});
