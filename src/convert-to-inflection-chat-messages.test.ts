import { expect, describe, it } from "vitest";
import {
  UnsupportedFunctionalityError,
  LanguageModelV1Message,
} from "@ai-sdk/provider";
import { convertToInflectionChatMessages } from "./convert-to-inflection-chat-messages";

describe("convertToInflectionChatMessages", () => {
  it("should convert basic user and assistant messages", () => {
    const messages: LanguageModelV1Message[] = [
      {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Hi there!" }],
      },
    ];

    const result = convertToInflectionChatMessages(messages);

    expect(result).toEqual([
      { type: "Human", text: "Hello" },
      { type: "AI", text: "Hi there!" },
    ]);
  });

  it("should convert system messages to instruction type", () => {
    const messages: LanguageModelV1Message[] = [
      {
        role: "system",
        content: "Be helpful and concise.",
      },
    ];

    const result = convertToInflectionChatMessages(messages);

    expect(result).toEqual([
      { type: "Instruction", text: "Be helpful and concise." },
    ]);
  });

  it("should combine multiple text parts", () => {
    const messages: LanguageModelV1Message[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "world!" },
        ],
      },
    ];

    const result = convertToInflectionChatMessages(messages);

    expect(result).toEqual([{ type: "Human", text: "Hello world!" }]);
  });

  it("should throw error for image content", () => {
    const messages: LanguageModelV1Message[] = [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: new Uint8Array([1, 2, 3]),
            mimeType: "image/jpeg",
          },
        ],
      },
    ];

    expect(() => convertToInflectionChatMessages(messages)).toThrow(
      UnsupportedFunctionalityError
    );
  });

  it("should throw error for tool results", () => {
    const messages: LanguageModelV1Message[] = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tool-call-id-1",
            toolName: "tool-1",
            result: { key: "result-value" },
          },
        ],
      },
    ];

    expect(() => convertToInflectionChatMessages(messages)).toThrow(
      UnsupportedFunctionalityError
    );
  });

  it("should skip empty messages", () => {
    const messages: LanguageModelV1Message[] = [
      {
        role: "user",
        content: [{ type: "text", text: "" }],
      },
    ];

    const result = convertToInflectionChatMessages(messages);

    expect(result).toEqual([]);
  });
});

describe("tool calls", () => {
  const toolCallMessage: LanguageModelV1Message = {
    role: "assistant",
    content: [
      {
        type: "tool-call",
        args: { location: "San Francisco, CA" },
        toolCallId: "tool-call-id-1",
        toolName: "get_weather",
      },
    ],
  };

  it("should allow tool calls with inflection_3_with_tools model", () => {
    const result = convertToInflectionChatMessages(
      [toolCallMessage],
      "inflection_3_with_tools"
    );

    expect(result).toEqual([
      {
        type: "AI",
        text: "",
        tool_calls: [
          {
            id: "tool-call-id-1",
            type: "function",
            function: {
              name: "get_weather",
              arguments: JSON.stringify({ location: "San Francisco, CA" }),
            },
          },
        ],
      },
    ]);
  });

  it("should throw error for tool calls with other models", () => {
    expect(() =>
      convertToInflectionChatMessages([toolCallMessage], "inflection_3_pi")
    ).toThrow(UnsupportedFunctionalityError);
  });

  it("should handle mixed text and tool calls", () => {
    const messages: LanguageModelV1Message[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me check the weather." },
          {
            type: "tool-call",
            args: { location: "San Francisco, CA" },
            toolCallId: "tool-call-id-1",
            toolName: "get_weather",
          },
        ],
      },
    ];

    const result = convertToInflectionChatMessages(
      messages,
      "inflection_3_with_tools"
    );

    expect(result).toEqual([
      {
        type: "AI",
        text: "Let me check the weather.",
        tool_calls: [
          {
            id: "tool-call-id-1",
            type: "function",
            function: {
              name: "get_weather",
              arguments: JSON.stringify({ location: "San Francisco, CA" }),
            },
          },
        ],
      },
    ]);
  });

  it("should handle multiple tool calls in one message", () => {
    const messages: LanguageModelV1Message[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            args: { location: "San Francisco, CA" },
            toolCallId: "tool-call-id-1",
            toolName: "get_weather",
          },
          {
            type: "tool-call",
            args: { location: "New York, NY" },
            toolCallId: "tool-call-id-2",
            toolName: "get_weather",
          },
        ],
      },
    ];

    const result = convertToInflectionChatMessages(
      messages,
      "inflection_3_with_tools"
    );

    expect(result).toEqual([
      {
        type: "AI",
        text: "",
        tool_calls: [
          {
            id: "tool-call-id-1",
            type: "function",
            function: {
              name: "get_weather",
              arguments: JSON.stringify({ location: "San Francisco, CA" }),
            },
          },
          {
            id: "tool-call-id-2",
            type: "function",
            function: {
              name: "get_weather",
              arguments: JSON.stringify({ location: "New York, NY" }),
            },
          },
        ],
      },
    ]);
  });

  it("should handle tool results after tool calls", () => {
    const messages: LanguageModelV1Message[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            args: { location: "San Francisco, CA" },
            toolCallId: "tool-call-id-1",
            toolName: "get_weather",
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tool-call-id-1",
            toolName: "get_weather",
            result: { temperature: 72, conditions: "sunny" },
          },
        ],
      },
    ];

    const result = convertToInflectionChatMessages(
      messages,
      "inflection_3_with_tools"
    );

    expect(result).toEqual([
      {
        type: "AI",
        text: "",
        tool_calls: [
          {
            id: "tool-call-id-1",
            type: "function",
            function: {
              name: "get_weather",
              arguments: JSON.stringify({ location: "San Francisco, CA" }),
            },
          },
        ],
      },
      {
        type: "Tool",
        text: JSON.stringify({ temperature: 72, conditions: "sunny" }),
        tool_call_id: "tool-call-id-1",
      },
    ]);
  });
});

describe("assistant messages", () => {
  it("should add prefix true to trailing assistant messages", () => {
    const result = convertToInflectionChatMessages([
      {
        role: "user",
        content: [{ type: "text" as const, text: "Hello" }],
      },
      {
        role: "assistant",
        content: [{ type: "text" as const, text: "Hello!" }],
      },
    ]);

    expect(result).toMatchSnapshot();
  });
});
