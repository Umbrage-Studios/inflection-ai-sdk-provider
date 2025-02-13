# AI SDK - Inflection AI Provider

The **[Inflection AI provider](https://github.com/Umbrage-Studios/inflection-ai-sdk-provider)** for the [AI SDK](https://sdk.vercel.ai/docs) contains language model support for the [Inflection AI API](https://developers.inflection.ai/).

## Setup

The Inflection AI provider is available in the `inflection-ai-sdk-provider` module. You can install it with

```bash
npm i inflection-ai-sdk-provider
```

## Provider Instance

You can import the default provider instance `inflection` from `@ai-sdk/inflection-ai`:

```ts
import { inflection } from 'inflection-ai-sdk-provider';
```

## Example

```ts
import { inflection } from 'inflection-ai-sdk-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: inflection('inflection_3_with_tools'),
  prompt: 'how can I make quick chicken pho?',
});
```

## Documentation

Please check out the **[Inflection AI provider](https://github.com/Umbrage-Studios/inflection-ai-sdk-provider)** for more information.

Please check out Inflection AI's [API Documentation](https://developers.inflection.ai/docs/api-reference) for more information.
