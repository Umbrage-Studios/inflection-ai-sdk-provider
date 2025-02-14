# inflection-ai-sdk-provider

## 1.0.0

### Patch Changes

- Initial release of unofficialInflection AI provider

## 1.0.1

### Patch Changes

- Updated README

## 1.0.2

### Patch Changes

- Updated README

## 1.0.3

### Patch Changes

- Updated keywords in package.json

## 1.0.4

### Patch Changes

- Added tool calling support for inflection_3_with_tools model
- Added streaming tool call support
- Updated documentation with tool calling examples and capabilities

## 1.0.5

### Patch Changes

- Added generateObject function (including zod-to-json-schema dependency)
- Updated documentation with usage examples

## 1.0.6

### Patch Changes

- Fixed handling of null tool_calls in responses by converting them to empty arrays

## 1.0.7

### Patch Changes

- Maybe fixed bugs for streaming tool calls
- KNOWN BUG: Streaming tool calls are not working as expected with Inflection AI API

## 1.0.8

### Patch Changes

- Added support for the OpenAI-compatible endpoint in streaming mode to bypass the Inflection AI API limitation
- Added proper schema validation for OpenAI responses
- Updated tests to cover both endpoints
- Fixed error handling and response parsing for both formats
