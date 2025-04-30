import type { OpenAI } from "openai";
import type {
  ResponseCreateParams,
  Response,
  ResponseItem,
} from "openai/resources/responses/responses.mjs";

// Define interfaces based on OpenAI API documentation
type ResponseCreateInput = ResponseCreateParams;
type ResponseOutput = Response;

// Local compatibility type for OpenAI ChatCompletionMessageParam
type ChatCompletionContentPartText = {
  type: "text";
  text: string;
};

export type ChatCompletionMessageParam =
  | {
      role: "system" | "user" | "assistant" | "developer";
      content: string | ChatCompletionContentPartText[];
      tool_call_id?: string;
    }
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
    };

// Utility function to generate unique IDs
function generateId(prefix: string = "msg"): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

// Function to convert ResponseInputItem to ChatCompletionMessageParam
type ResponseInputItem = ResponseCreateInput["input"][number];

function convertInputItemToMessage(
  item: string | ResponseInputItem,
): ChatCompletionMessageParam {
  if (typeof item === "string") {
    return { role: "user", content: item };
  }
  const responseItem = item;
  if (responseItem.type === "message") {
    const contentArr: ChatCompletionContentPartText[] = Array.isArray(responseItem.content)
      ? responseItem.content
          .filter((c) => typeof c === "object" && "text" in c)
          .map((c) => ({ type: "text", text: c.text ?? "" }))
      : [];
    return {
      role: responseItem.role,
      content: contentArr.length > 0 ? contentArr : "",
    };
  } else if (responseItem.type === "function_call_output") {
    return {
      role: "tool",
      tool_call_id: responseItem.call_id,
      content: typeof responseItem.output === "string" ? responseItem.output : "",
    };
  }
  throw new Error(`Unsupported input item type: ${responseItem.type}`);
}

// Function to get full messages including history
function getFullMessages(
  input: ResponseCreateInput,
): Array<ChatCompletionMessageParam> {
  let baseHistory: Array<ChatCompletionMessageParam> = [];
  if (input.previous_response_id) {
    const prev = conversationHistories.get(input.previous_response_id);
    if (!prev) {
      throw new Error(
        `Previous response not found: ${input.previous_response_id}`,
      );
    }
    baseHistory = prev.messages;
  }
  const newInputMessages = Array.isArray(input.input)
    ? input.input.map(convertInputItemToMessage)
    : [convertInputItemToMessage(input.input)];
  // Only include valid ChatCompletionMessageParam and filter out any with null/undefined content
  const messages = [...baseHistory, ...newInputMessages].filter(
    (msg): msg is ChatCompletionMessageParam =>
      typeof msg.role === "string" &&
      "content" in msg &&
      msg.content !== null &&
      msg.content !== undefined
  );
  if (
    input.instructions &&
    (messages.length === 0 ||
      (messages.length > 0 && messages[0].role !== "system" && messages[0].role !== "developer"))
  ) {
    return [
      { role: "system", content: input.instructions },
      ...messages,
    ];
  }
  return messages;
}

// Function to convert tools
function convertTools(
  tools?: ResponseCreateInput["tools"],
): Array<OpenAI.Chat.Completions.ChatCompletionTool> | undefined {
  return tools
    ?.filter((tool) => tool.type === "function")
    .map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description || undefined,
        parameters: tool.parameters,
      },
    }));
}

const createCompletion = (openai: OpenAI, input: ResponseCreateInput) => {
  const fullMessages = getFullMessages(input);
  const chatTools = convertTools(input.tools);
  const webSearchOptions = input.tools?.some(
    (tool) => tool.type === "function" && tool.name === "web_search",
  )
    ? {}
    : undefined;

  const chatInput: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
    model: input.model,
    messages: fullMessages,
    tools: chatTools,
    web_search_options: webSearchOptions,
    temperature: input.temperature,
    top_p: input.top_p,
    tool_choice: (input.tool_choice === "auto"
      ? "auto"
      : input.tool_choice) as OpenAI.Chat.Completions.ChatCompletionCreateParams["tool_choice"],
    stream: input.stream || false,
    user: input.user,
    metadata: input.metadata,
  };

  return openai.chat.completions.create(chatInput);
};

// Main function with overloading
async function responsesCreateViaChatCompletions(
  openai: OpenAI,
  input: ResponseCreateInput & { stream: true },
): Promise<AsyncGenerator<ResponseEvent>>;
async function responsesCreateViaChatCompletions(
  openai: OpenAI,
  input: ResponseCreateInput & { stream?: false },
): Promise<ResponseOutput>;
async function responsesCreateViaChatCompletions(
  openAI: OpenAI,
  input: ResponseCreateInput,
): Promise<ResponseOutput | AsyncGenerator<ResponseEvent>> {
  const completion = await createCompletion(openAI, input);
  if (input.stream) {
    return streamResponses(
      input,
      completion as AsyncIterable<OpenAI.ChatCompletionChunk>,
    );
  } else {
    return nonStreamResponses(
      input,
      completion as unknown as OpenAI.Chat.Completions.ChatCompletion,
    );
  }
}

// Non-streaming implementation
async function nonStreamResponses(
  input: ResponseCreateInput,
  completion: OpenAI.Chat.Completions.ChatCompletion,
): Promise<ResponseOutput> {
  const fullMessages = getFullMessages(input);

  try {
    const chatResponse = completion;
    if (!("choices" in chatResponse) || chatResponse.choices.length === 0) {
      throw new Error("No choices in chat completion response");
    }
    const assistantMessage = chatResponse.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new Error("No assistant message in chat completion response");
    }

    // Construct ResponseOutput
    const responseId = generateId("resp");
    const outputItemId = generateId("msg");

    // --- PATCH: Handle function/tool calls as OpenAI-style content ---
    let outputContent: Array<any> = [];
    let hasFunctionCalls = false;
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      hasFunctionCalls = true;
      // For each tool_call, create a content item of type 'function_call'
      outputContent = assistantMessage.tool_calls.map((toolCall) => ({
        type: "function_call",
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      }));
    } else if (assistantMessage.content) {
      let textValue = "";
      if (Array.isArray(assistantMessage.content)) {
        textValue = assistantMessage.content
          .map((c) => (typeof c === "object" && "text" in c ? c.text : ""))
          .join("");
      } else if (typeof assistantMessage.content === "string") {
        textValue = assistantMessage.content;
      }
      outputContent.push({
        type: "text",
        text: textValue,
        annotations: [],
      });
    }

    // Create response with appropriate status and properties
    const responseOutput = {
      id: responseId,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: hasFunctionCalls ? "requires_action" : "completed",
      error: null,
      incomplete_details: null,
      instructions: null,
      max_output_tokens: null,
      model: chatResponse.model,
      output: [
        {
          type: "message",
          id: outputItemId,
          status: "completed",
          role: "assistant",
          content: outputContent,
        },
      ],
      parallel_tool_calls: input.parallel_tool_calls ?? false,
      previous_response_id: input.previous_response_id ?? null,
      reasoning: null,
      temperature: input.temperature,
      text: { format: { type: "text" } },
      tool_choice: input.tool_choice ?? "auto",
      tools: input.tools ?? [],
      top_p: input.top_p,
      truncation: input.truncation ?? "disabled",
      usage: chatResponse.usage
        ? {
            input_tokens: chatResponse.usage.prompt_tokens,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: chatResponse.usage.completion_tokens,
            output_tokens_details: { reasoning_tokens: 0 },
            total_tokens: chatResponse.usage.total_tokens,
          }
        : undefined,
      user: input.user ?? undefined,
      metadata: input.metadata ?? {},
      output_text: "",
    } as ResponseOutput;

    // Add required_action property for tool calls
    if (hasFunctionCalls && assistantMessage.tool_calls) {
      (responseOutput as any).required_action = {
        type: "submit_tool_outputs",
        submit_tool_outputs: {
          tool_calls: assistantMessage.tool_calls.map((toolCall) => ({
            id: toolCall.id,
            type: toolCall.type,
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            },
          })),
        },
      };
    }

    // Store history
    const newHistory = [...fullMessages, assistantMessage];
    conversationHistories.set(responseId, {
      previous_response_id: input.previous_response_id ?? null,
      messages: newHistory,
    });

    return responseOutput;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to process chat completion: ${errorMessage}`);
  }
}

// Streaming implementation
async function* streamResponses(
  input: ResponseCreateInput,
  completion: AsyncIterable<OpenAI.ChatCompletionChunk>,
): AsyncGenerator<ResponseEvent> {
  const fullMessages = getFullMessages(input);

  const responseId = generateId("resp");
  const outputItemId = generateId("msg");
  let textContentAdded = false;
  let textContent = "";
  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
  let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;
  const finalOutputItem: Array<ChatCompletionMessageParam> = [];
  // Initial response
  const initialResponse: Partial<ResponseOutput> = {
    id: responseId,
    object: "response" as const,
    created_at: Math.floor(Date.now() / 1000),
    status: "in_progress" as const,
    model: input.model,
    output: [],
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    parallel_tool_calls: true,
    previous_response_id: input.previous_response_id ?? null,
    reasoning: null,
    temperature: input.temperature,
    text: { format: { type: "text" } },
    tool_choice: input.tool_choice ?? "auto",
    tools: input.tools ?? [],
    top_p: input.top_p,
    truncation: input.truncation ?? "disabled",
    usage: undefined,
    user: input.user ?? undefined,
    metadata: input.metadata ?? {},
    output_text: "",
  };
  yield { type: "response.created", response: initialResponse };
  yield { type: "response.in_progress", response: initialResponse };
  let isToolCall = false;
  for await (const chunk of completion as AsyncIterable<OpenAI.ChatCompletionChunk>) {
    const choice = chunk.choices[0];
    if (!choice) {
      continue;
    }
    if (
      !isToolCall &&
      (("tool_calls" in choice.delta && choice.delta.tool_calls) ||
        choice.finish_reason === "tool_calls")
    ) {
      isToolCall = true;
    }

    if (chunk.usage) {
      usage = {
        prompt_tokens: chunk.usage.prompt_tokens,
        completion_tokens: chunk.usage.completion_tokens,
        total_tokens: chunk.usage.total_tokens,
      };
    }
    if (isToolCall) {
      for (const tcDelta of choice.delta.tool_calls || []) {
        const tcIndex = tcDelta.index;
        const content_index = textContentAdded ? tcIndex + 1 : tcIndex;

        if (!toolCalls.has(tcIndex)) {
          // New tool call
          const toolCallId = tcDelta.id || generateId("call");
          const functionName = tcDelta.function?.name || "";

          yield {
            type: "response.output_item.added",
            item: {
              type: "function_call",
              id: outputItemId,
              status: "in_progress",
              call_id: toolCallId,
              name: functionName,
              arguments: "",
            },
            output_index: 0,
          };
          toolCalls.set(tcIndex, {
            id: toolCallId,
            name: functionName,
            arguments: "",
          });
        }

        if (tcDelta.function?.arguments) {
          const current = toolCalls.get(tcIndex);
          if (current) {
            current.arguments += tcDelta.function.arguments;
            yield {
              type: "response.function_call_arguments.delta",
              item_id: outputItemId,
              output_index: 0,
              content_index,
              delta: tcDelta.function.arguments,
            };
          }
        }
      }

      if (choice.finish_reason === "tool_calls") {
        for (const [tcIndex, tc] of toolCalls) {
          const item = {
            type: "function_call",
            id: outputItemId,
            status: "completed",
            call_id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          };
          yield {
            type: "response.function_call_arguments.done",
            item_id: outputItemId,
            output_index: tcIndex,
            content_index: textContentAdded ? tcIndex + 1 : tcIndex,
            arguments: tc.arguments,
          };
          yield {
            type: "response.output_item.done",
            output_index: tcIndex,
            item,
          };
          finalOutputItem.push(item as unknown as ChatCompletionMessageParam);
        }
      } else {
        continue;
      }
    } else {
      if (!textContentAdded) {
        yield {
          type: "response.content_part.added",
          item_id: outputItemId,
          output_index: 0,
          content_index: 0,
          part: { type: "output_text", text: "", annotations: [] },
        };
        textContentAdded = true;
      }
      if (choice.delta.content?.length) {
        yield {
          type: "response.output_text.delta",
          item_id: outputItemId,
          output_index: 0,
          content_index: 0,
          delta: choice.delta.content,
        };
        textContent += choice.delta.content;
      }
      if (choice.finish_reason) {
        yield {
          type: "response.output_text.done",
          item_id: outputItemId,
          output_index: 0,
          content_index: 0,
          text: textContent,
        };
        yield {
          type: "response.content_part.done",
          item_id: outputItemId,
          output_index: 0,
          content_index: 0,
          part: { type: "output_text", text: textContent, annotations: [] },
        };
        const item = {
          type: "message",
          id: outputItemId,
          status: "completed",
          role: "assistant",
          content: [
            { type: "output_text", text: textContent, annotations: [] },
          ],
        };
        yield {
          type: "response.output_item.done",
          output_index: 0,
          item,
        };
        finalOutputItem.push(item as unknown as ChatCompletionMessageParam);
      } else {
        continue;
      }
    }

    // Construct final response
    const finalResponse: ResponseOutput = {
      id: responseId,
      object: "response" as const,
      created_at: initialResponse.created_at || Math.floor(Date.now() / 1000),
      status: "completed" as const,
      error: null,
      incomplete_details: null,
      instructions: null,
      max_output_tokens: null,
      model: chunk.model || input.model,
      output: finalOutputItem as unknown as ResponseOutput["output"],
      parallel_tool_calls: true,
      previous_response_id: input.previous_response_id ?? null,
      reasoning: null,
      temperature: input.temperature,
      text: { format: { type: "text" } },
      tool_choice: input.tool_choice ?? "auto",
      tools: input.tools ?? [],
      top_p: input.top_p,
      truncation: input.truncation ?? "disabled",
      usage: usage as ResponseOutput["usage"],
      user: input.user ?? undefined,
      metadata: input.metadata ?? {},
      output_text: "",
    } as ResponseOutput;

    // Store history
    const assistantMessage: ChatCompletionMessageParam = {
      role: "assistant" as const,
    };

    if (textContent) {
      assistantMessage.content = textContent;
    }

    // Add tool_calls property if needed
    if (toolCalls.size > 0) {
      (assistantMessage as any).tool_calls = Array.from(toolCalls.values()).map(
        (tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        }),
      );
    }
    const newHistory = [...fullMessages, assistantMessage];
    conversationHistories.set(responseId, {
      previous_response_id: input.previous_response_id ?? null,
      messages: newHistory,
    });

    yield { type: "response.completed", response: finalResponse };
  }
}

// Global map to store conversation histories
const conversationHistories = new Map<
  string,
  {
    previous_response_id: string | null;
    messages: Array<ChatCompletionMessageParam>;
  }
>();

export type ResponseEvent =
  | { type: "response.created"; response: Partial<ResponseOutput> }
  | { type: "response.in_progress"; response: Partial<ResponseOutput> }
  | { type: "response.output_item.added"; output_index: number; item: any }
  | { type: "response.content_part.added"; item_id: string; output_index: number; content_index: number; part: any }
  | { type: "response.output_text.delta"; item_id: string; output_index: number; content_index: number; delta: string }
  | { type: "response.output_text.done"; item_id: string; output_index: number; content_index: number; text: string }
  | { type: "response.function_call_arguments.delta"; item_id: string; output_index: number; content_index: number; delta: string }
  | { type: "response.function_call_arguments.done"; item_id: string; output_index: number; content_index: number; arguments: string }
  | { type: "response.content_part.done"; item_id: string; output_index: number; content_index: number; part: any }
  | { type: "response.output_item.done"; output_index: number; item: any }
  | { type: "response.completed"; response: ResponseOutput }
  | { type: "error"; code: string; message: string; param: string | null };

export {
  responsesCreateViaChatCompletions,
  ResponseCreateInput,
  ResponseOutput,
  ResponseInputItem,
  ResponseItem,
};
