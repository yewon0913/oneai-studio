/**
 * LLM invoke helper — Anthropic Claude / Google Gemini 기반
 * (Manus Forge / OpenAI 의존 제거)
 */

import Anthropic from "@anthropic-ai/sdk";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

// ─── 이미지 URL → base64 변환 ────────────────────────────

async function imageUrlToBase64(url: string): Promise<{ data: string; mediaType: string } | null> {
  // data: URI는 직접 파싱
  if (url.startsWith("data:")) {
    const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) return { data: match[2], mediaType: match[1] };
    return null;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    return { data: buf.toString("base64"), mediaType: contentType.split(";")[0] };
  } catch {
    return null;
  }
}

// ─── OpenAI 형식 메시지 → Anthropic 형식 변환 ───────────

function extractSystemPrompt(messages: Message[]): string {
  return messages
    .filter(m => m.role === "system")
    .map(m => {
      if (typeof m.content === "string") return m.content;
      const arr = Array.isArray(m.content) ? m.content : [m.content];
      return arr.map(p => (typeof p === "string" ? p : p.type === "text" ? p.text : "")).join("\n");
    })
    .join("\n\n");
}

async function convertToAnthropicContent(
  content: MessageContent | MessageContent[]
): Promise<Anthropic.ContentBlockParam[]> {
  const parts = Array.isArray(content) ? content : [content];
  const result: Anthropic.ContentBlockParam[] = [];

  for (const part of parts) {
    if (typeof part === "string") {
      result.push({ type: "text", text: part });
    } else if (part.type === "text") {
      result.push({ type: "text", text: part.text });
    } else if (part.type === "image_url") {
      const img = await imageUrlToBase64(part.image_url.url);
      if (img) {
        result.push({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: img.data,
          },
        });
      }
    }
    // file_url 은 무시 (이미지 분석에선 불필요)
  }

  return result;
}

// ─── Anthropic Claude로 실행 ─────────────────────────────

async function invokeWithClaude(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const client = new Anthropic({ apiKey });
  const systemPrompt = extractSystemPrompt(params.messages);
  const userMessages = params.messages.filter(m => m.role !== "system");

  const anthropicMessages: Anthropic.MessageParam[] = [];
  for (const msg of userMessages) {
    const content = await convertToAnthropicContent(msg.content);
    anthropicMessages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content,
    });
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: params.maxTokens || params.max_tokens || 4096,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: anthropicMessages,
  });

  const textContent = response.content
    .filter(b => b.type === "text")
    .map(b => b.type === "text" ? b.text : "")
    .join("");

  return {
    id: response.id,
    created: Date.now(),
    model: response.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textContent,
        },
        finish_reason: response.stop_reason || "stop",
      },
    ],
    usage: {
      prompt_tokens: response.usage?.input_tokens || 0,
      completion_tokens: response.usage?.output_tokens || 0,
      total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    },
  };
}

// ─── Google Gemini로 실행 (폴백) ─────────────────────────

async function invokeWithGemini(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const systemPrompt = extractSystemPrompt(params.messages);
  const userMessages = params.messages.filter(m => m.role !== "system");

  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [];

  for (const msg of userMessages) {
    const contentArr = Array.isArray(msg.content) ? msg.content : [msg.content];
    for (const part of contentArr) {
      if (typeof part === "string") {
        parts.push({ text: part });
      } else if (part.type === "text") {
        parts.push({ text: part.text });
      } else if (part.type === "image_url") {
        const img = await imageUrlToBase64(part.image_url.url);
        if (img) {
          parts.push({ inline_data: { mime_type: img.mediaType, data: img.data } });
        }
      }
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: params.maxTokens || params.max_tokens || 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini API failed (${response.status}): ${detail}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return {
    id: `gemini-${Date.now()}`,
    created: Date.now(),
    model: "gemini-2.0-flash",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      },
    ],
  };
}

// ─── 메인: Claude → Gemini 폴백 ─────────────────────────

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  // 1차: Anthropic Claude
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await invokeWithClaude(params);
    } catch (err: any) {
      console.warn(`[llm] Claude 실패: ${err.message?.slice(0, 120)} → Gemini 폴백`);
    }
  }

  // 2차: Google Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      return await invokeWithGemini(params);
    } catch (err: any) {
      console.warn(`[llm] Gemini 실패: ${err.message?.slice(0, 120)}`);
      throw err;
    }
  }

  throw new Error("LLM 사용 불가: ANTHROPIC_API_KEY 또는 GEMINI_API_KEY가 필요합니다");
}
