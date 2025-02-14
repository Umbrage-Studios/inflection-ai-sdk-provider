# Unofficial Community Provider for AI SDK - Inflection AI

The **[unofficial Inflection AI provider](https://www.npmjs.com/package/inflection-ai-sdk-provider)** for the [AI SDK](https://sdk.vercel.ai/docs) contains language model support for the [Inflection AI API](https://developers.inflection.ai/).

## Setup

The Inflection AI provider is available in the [`inflection-ai-sdk-provider`](https://www.npmjs.com/package/inflection-ai-sdk-provider) module on npm. You can install it with

```bash
npm i inflection-ai-sdk-provider
```

## Provider Instance

You can import the default provider instance `inflection` from `inflection-ai-sdk-provider`:

```ts
import { inflection } from "inflection-ai-sdk-provider";
```

## Example

```ts
import { inflection } from "inflection-ai-sdk-provider";
import { generateText } from "ai";

// Basic text generation
const { text } = await generateText({
  model: inflection("inflection_3_with_tools"),
  prompt: "how can I make quick chicken pho?",
});

// Using tool calls
const { text: weatherText, toolCalls } = await generateText({
  model: inflection("inflection_3_with_tools"),
  prompt: "what's the weather in San Francisco?",
  tools: [
    {
      type: "function",
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
    },
  ],
});
```

## Models

The following models are supported:

- `inflection_3_pi` - "the model powering our Pi experience, including a backstory, emotional intelligence, productivity, and safety. It excels in scenarios such as customer support chatbots."
- `inflection_3_productivity`- "the model optimized for following instructions. It is better for tasks requiring JSON output or precise adherence to provided guidelines."
- `inflection_3_with_tools` - Model that supports function calling capabilities, allowing it to interact with external tools and APIs through a structured interface.

| Model                       | Text Generation | Streaming | Image Input | Object Generation | Tool Usage | Tool Streaming |
| --------------------------- | --------------- | --------- | ----------- | ----------------- | ---------- | -------------- |
| `inflection_3_pi`           | ✓               | ✓         | ✗           | ✗                 | ✗          | ✗              |
| `inflection_3_productivity` | ✓               | ✓         | ✗           | ✗                 | ✗          | ✗              |
| `inflection_3_with_tools`   | ✓               | ✓         | ✗           | ✗                 | ✓          | ✓              |

## Tool Calling Support

The `inflection_3_with_tools` model supports function calling through the standard AI SDK tools interface. You can provide a list of tools when making requests, and the model can choose to call these tools as part of its response. Both streaming and non-streaming tool calls are supported.

## Documentation

Please check out Inflection AI's [API Documentation](https://developers.inflection.ai/docs/api-reference) for more information.

You can find the source code for this provider [here on GitHub](https://github.com/Umbrage-Studios/inflection-ai-sdk-provider).
