/**
 * Voice transcription helper — FAL AI Whisper 기반
 * Manus Forge 의존 제거
 */

import { fal } from "@fal-ai/client";

export type TranscribeOptions = {
  audioUrl: string;
  language?: string;
  prompt?: string;
};

export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse;

export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

/**
 * FAL AI Whisper로 음성을 텍스트로 변환
 */
export async function transcribeAudio(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return {
        error: "Voice transcription service is not configured",
        code: "SERVICE_ERROR",
        details: "FAL_KEY is not set",
      };
    }

    fal.config({ credentials: falKey });

    const result = await fal.subscribe("fal-ai/whisper" as any, {
      input: {
        audio_url: options.audioUrl,
        task: "transcribe",
        ...(options.language ? { language: options.language } : {}),
        ...(options.prompt ? { initial_prompt: options.prompt } : {}),
      } as any,
    });

    const data = (result as any)?.data;
    if (!data?.text) {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "FAL Whisper returned an invalid response",
      };
    }

    return {
      task: "transcribe",
      language: data.language || options.language || "unknown",
      duration: data.duration || 0,
      text: data.text,
      segments: data.chunks?.map((chunk: any, i: number) => ({
        id: i,
        seek: 0,
        start: chunk.timestamp?.[0] || 0,
        end: chunk.timestamp?.[1] || 0,
        text: chunk.text || "",
        tokens: [],
        temperature: 0,
        avg_logprob: 0,
        compression_ratio: 0,
        no_speech_prob: 0,
      })) || [],
    };
  } catch (error) {
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
