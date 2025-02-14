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
| `inflection_3_pi`           | ✓               | ✓         | ✗           | ✓                 | ✗          | ✗              |
| `inflection_3_productivity` | ✓               | ✓         | ✗           | ✓                 | ✗          | ✗              |
| `inflection_3_with_tools`   | ✓               | ✓         | ✗           | ✓                 | ✓          | ✓              |

## Tool Calling Support

The `inflection_3_with_tools` model supports function calling through the standard AI SDK tools interface. You can provide a list of tools when making requests, and the model can choose to call these tools as part of its response. Both streaming and non-streaming tool calls are supported.

## Object Generation

All Inflection models support structured object generation through the `generateObject` function. This allows you to generate JSON objects that conform to a specific schema, arrays of objects, or enum values for classification tasks.

### Basic Object Generation

```typescript
import { inflection, generateObject } from "inflection-ai-sdk-provider";
import { z } from "zod";

// Define a schema for the object you want to generate
const recipeSchema = z.object({
  recipe: z.object({
    name: z.string(),
    ingredients: z.array(
      z.object({
        name: z.string(),
        amount: z.string(),
      })
    ),
    steps: z.array(z.string()),
  }),
});

// Generate a structured recipe object
const { object } = await generateObject({
  model: inflection("inflection_3_productivity"),
  schema: recipeSchema,
  prompt: [
    {
      role: "user",
      content: [{ type: "text", text: "Generate a lasagna recipe" }],
    },
  ],
});

// object will be typed and validated according to the schema
console.log(object.recipe.name);
console.log(object.recipe.ingredients);
console.log(object.recipe.steps);
```

### Array Generation

```typescript
import { inflection, generateObject } from "inflection-ai-sdk-provider";
import { z } from "zod";

const heroSchema = z.object({
  name: z.string(),
  class: z.string().describe("Character class, e.g. warrior, mage, or thief."),
  description: z.string(),
});

const { object: heroes } = await generateObject({
  model: inflection("inflection_3_pi"),
  output: "array",
  schema: heroSchema,
  prompt: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Generate 3 hero descriptions for a fantasy game",
        },
      ],
    },
  ],
});

// heroes will be an array of objects matching the schema
heroes.forEach((hero) => {
  console.log(`${hero.name} - ${hero.class}`);
  console.log(hero.description);
});
```

### Classification with Enum Output

```typescript
import { inflection, generateObject } from "inflection-ai-sdk-provider";

const { object: genre } = await generateObject({
  model: inflection("inflection_3_with_tools"),
  output: "enum",
  enum: ["action", "comedy", "drama", "horror", "sci-fi"],
  prompt: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: 'Classify the genre of this movie plot: "A group of astronauts travel through a wormhole in search of a new habitable planet for humanity."',
        },
      ],
    },
  ],
});

// genre will be one of the provided enum values
console.log(`Movie genre: ${genre}`);
```

### No-Schema Output

When you don't need to validate the structure of the generated JSON:

```typescript
import { inflection, generateObject } from "inflection-ai-sdk-provider";

const { object } = await generateObject({
  model: inflection("inflection_3_productivity"),
  output: "no-schema",
  prompt: [
    {
      role: "user",
      content: [{ type: "text", text: "Generate a simple recipe" }],
    },
  ],
});

// object will be the parsed JSON without validation
console.log(object);
```

## Documentation

Please check out Inflection AI's [API Documentation](https://developers.inflection.ai/docs/api-reference) for more information.

You can find the source code for this provider [here on GitHub](https://github.com/Umbrage-Studios/inflection-ai-sdk-provider).
