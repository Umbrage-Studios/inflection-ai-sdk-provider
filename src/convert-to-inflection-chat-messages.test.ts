import { expect, describe, it } from "vitest";
import {
  UnsupportedFunctionalityError,
  LanguageModelV1Message,
} from "@ai-sdk/provider";
import { convertToInflectionChatMessages } from "./convert-to-inflection-chat-messages";

describe("user messages", () => {
  it("should convert basic user messages", () => {
    const result = convertToInflectionChatMessages([
      {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      },
    ]);

    expect(result).toMatchSnapshot();
  });

  it("should combine multiple text parts in user messages", () => {
    const result = convertToInflectionChatMessages([
      {
        role: "user",
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "world!" },
        ],
      },
    ]);

    expect(result).toMatchSnapshot();
  });

  it("should throw error for image content in user messages", () => {
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

  it("should skip empty user messages", () => {
    const result = convertToInflectionChatMessages([
      {
        role: "user",
        content: [{ type: "text", text: "" }],
      },
    ]);

    expect(result).toEqual([]);
  });
});

describe("system messages", () => {
  it("should convert system messages to instruction type", () => {
    const result = convertToInflectionChatMessages([
      {
        role: "system",
        content: "Be helpful and concise.",
      },
    ]);

    expect(result).toMatchSnapshot();
  });
});

describe("tool calls", () => {
  it("should stringify arguments in tool calls", () => {
    const result = convertToInflectionChatMessages(
      [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              args: { key: "arg-value", nested: { value: 123 } },
              toolCallId: "tool-call-id-1",
              toolName: "tool-1",
            },
          ],
        },
      ],
      "inflection_3_with_tools"
    );

    expect(result).toMatchSnapshot();
  });

  it("should stringify results in tool responses", () => {
    const result = convertToInflectionChatMessages(
      [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "tool-call-id-1",
              toolName: "tool-1",
              result: { key: "result-value", nested: { value: 123 } },
            },
          ],
        },
      ],
      "inflection_3_with_tools"
    );

    expect(result).toMatchSnapshot();
  });

  it("should handle mixed text and tool calls in one message", () => {
    const result = convertToInflectionChatMessages(
      [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Let me check that." },
            {
              type: "tool-call",
              args: { key: "arg-value" },
              toolCallId: "tool-call-id-1",
              toolName: "tool-1",
            },
          ],
        },
      ],
      "inflection_3_with_tools"
    );

    expect(result).toMatchSnapshot();
  });

  it("should handle multiple tool calls in sequence", () => {
    const result = convertToInflectionChatMessages(
      [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              args: { key: "first-value" },
              toolCallId: "call-1",
              toolName: "tool-1",
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call-1",
              toolName: "tool-1",
              result: { key: "first-result" },
            },
          ],
        },
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              args: { key: "second-value" },
              toolCallId: "call-2",
              toolName: "tool-2",
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call-2",
              toolName: "tool-2",
              result: { key: "second-result" },
            },
          ],
        },
      ],
      "inflection_3_with_tools"
    );

    expect(result).toMatchSnapshot();
  });

  it("should throw error for tool calls with non-tool models", () => {
    expect(() =>
      convertToInflectionChatMessages(
        [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                args: { key: "value" },
                toolCallId: "id-1",
                toolName: "tool-1",
              },
            ],
          },
        ],
        "inflection_3_pi"
      )
    ).toThrow(UnsupportedFunctionalityError);
  });
});

describe("assistant messages", () => {
  it("should convert basic assistant messages", () => {
    const result = convertToInflectionChatMessages([
      {
        role: "assistant",
        content: [{ type: "text", text: "Hello!" }],
      },
    ]);

    expect(result).toMatchSnapshot();
  });

  it("should add prefix true to trailing assistant messages", () => {
    const result = convertToInflectionChatMessages([
      {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Hello!" }],
      },
    ]);

    expect(result).toMatchSnapshot();
  });
});
