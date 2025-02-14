import { expect, describe, it, beforeEach } from "vitest";
import { z } from "zod";
import { createTestServer } from "@ai-sdk/provider-utils/test";
import { createInflection } from "./inflection-provider";
import { generateObject } from "./inflection-generate-object";
import { NoContentGeneratedError } from "@ai-sdk/provider";

const INFERENCE_URL =
  "https://layercake.pubwestus3.inf7ks8.com/external/api/inference";

const server = createTestServer({
  [INFERENCE_URL]: {
    response: {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: '{"recipe":{"name":"Classic Lasagna","ingredients":[{"name":"lasagna noodles","amount":"1 package"},{"name":"ground beef","amount":"1 pound"}],"steps":["Boil noodles","Brown meat"]}}',
      },
    },
  },
});

const provider = createInflection({
  apiKey: "test-api-key",
  baseURL: INFERENCE_URL,
});

describe("generateObject", () => {
  beforeEach(() => {
    server.urls[INFERENCE_URL].response = {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: '{"recipe":{"name":"Classic Lasagna","ingredients":[{"name":"lasagna noodles","amount":"1 package"},{"name":"ground beef","amount":"1 pound"}],"steps":["Boil noodles","Brown meat"]}}',
      },
    };
  });

  it("should generate an object using a schema", async () => {
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

    const result = await generateObject({
      model: provider.chat("inflection_3_productivity"),
      schema: recipeSchema,
      prompt: [
        {
          role: "user",
          content: [{ type: "text", text: "Generate a lasagna recipe" }],
        },
      ],
    });

    expect(result.object).toMatchSnapshot();
  });

  it("should generate an array of objects", async () => {
    server.urls[INFERENCE_URL].response = {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: '[{"name":"Warrior","class":"warrior","description":"A mighty fighter"},{"name":"Mage","class":"mage","description":"A powerful spellcaster"}]',
      },
    };

    const heroSchema = z.object({
      name: z.string(),
      class: z.string(),
      description: z.string(),
    });

    const result = await generateObject({
      model: provider.chat("inflection_3_productivity"),
      output: "array",
      schema: heroSchema,
      prompt: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Generate 2 hero descriptions for a fantasy game",
            },
          ],
        },
      ],
    });

    expect(result.object).toMatchSnapshot();
  });

  it("should handle enum output", async () => {
    server.urls[INFERENCE_URL].response = {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: "sci-fi",
      },
    };

    const result = await generateObject({
      model: provider.chat("inflection_3_productivity"),
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

    expect(result.object).toBe("sci-fi");
  });

  it("should handle no-schema output", async () => {
    server.urls[INFERENCE_URL].response = {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: '{"recipe":{"name":"Lasagna"}}',
      },
    };

    const result = await generateObject({
      model: provider.chat("inflection_3_productivity"),
      output: "no-schema",
      prompt: [
        {
          role: "user",
          content: [{ type: "text", text: "Generate a simple recipe" }],
        },
      ],
    });

    expect(result.object).toMatchSnapshot();
  });

  it("should throw NoContentGeneratedError for invalid JSON", async () => {
    server.urls[INFERENCE_URL].response = {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: "This is not JSON",
      },
    };

    const recipeSchema = z.object({
      recipe: z.object({
        name: z.string(),
      }),
    });

    await expect(
      generateObject({
        model: provider.chat("inflection_3_productivity"),
        schema: recipeSchema,
        prompt: [
          {
            role: "user",
            content: [{ type: "text", text: "Generate a recipe" }],
          },
        ],
      })
    ).rejects.toThrow(NoContentGeneratedError);
  });

  it("should throw NoContentGeneratedError for schema validation failure", async () => {
    server.urls[INFERENCE_URL].response = {
      type: "json-value",
      body: {
        created: 1714688002.0557644,
        text: '{"wrong":"structure"}',
      },
    };

    const recipeSchema = z.object({
      recipe: z.object({
        name: z.string(),
      }),
    });

    await expect(
      generateObject({
        model: provider.chat("inflection_3_productivity"),
        schema: recipeSchema,
        prompt: [
          {
            role: "user",
            content: [{ type: "text", text: "Generate a recipe" }],
          },
        ],
      })
    ).rejects.toThrow(NoContentGeneratedError);
  });

  it("should throw error for enum output without enum values", async () => {
    await expect(
      generateObject({
        model: provider.chat("inflection_3_productivity"),
        output: "enum",
        prompt: [
          { role: "user", content: [{ type: "text", text: "Classify this" }] },
        ],
      })
    ).rejects.toThrow("Enum values must be provided");
  });

  it("should throw error for object output without schema", async () => {
    await expect(
      generateObject({
        model: provider.chat("inflection_3_productivity"),
        output: "object",
        prompt: [
          {
            role: "user",
            content: [{ type: "text", text: "Generate something" }],
          },
        ],
      })
    ).rejects.toThrow("Schema must be provided");
  });
});
