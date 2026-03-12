// Storage helpers — FAL AI Storage 기반 (Railway 배포용)
// Manus Forge 프록시 대신 FAL AI의 스토리지 API를 사용

import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

function getFalKey(): string {
  const key = ENV.falKey || process.env.FAL_KEY;
  if (!key) {
    throw new Error("FAL_KEY is not configured — cannot upload files");
  }
  return key;
}

/**
 * FAL AI Storage에 파일을 업로드하고 공개 URL을 반환
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const falKey = getFalKey();
  const key = relKey.replace(/^\/+/, "");
  const fileName = key.split("/").pop() ?? `file-${nanoid(8)}`;

  const buffer =
    typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

  // Step 1: Initiate upload — get presigned S3 URL + final file_url
  const initiateRes = await fetch(
    "https://rest.alpha.fal.ai/storage/upload/initiate",
    {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content_type: contentType,
        file_name: fileName,
      }),
    }
  );

  if (!initiateRes.ok) {
    const detail = await initiateRes.text().catch(() => "");
    throw new Error(
      `FAL storage initiate failed (${initiateRes.status}): ${detail}`
    );
  }

  const { upload_url, file_url } = (await initiateRes.json()) as {
    upload_url: string;
    file_url: string;
  };

  // Step 2: PUT the file to the presigned S3 URL
  const uploadRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const detail = await uploadRes.text().catch(() => "");
    throw new Error(
      `FAL storage upload failed (${uploadRes.status}): ${detail}`
    );
  }

  return { key, url: file_url };
}

/**
 * storageGet — FAL storage URL은 업로드 시 반환된 file_url이 곧 다운로드 URL
 * DB에 저장된 URL을 그대로 반환
 */
export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  // FAL storage에서는 업로드 시 받은 file_url이 공개 URL이므로
  // 별도의 download URL 생성이 불필요. key를 URL로 사용할 수 없으므로
  // 이 함수는 DB에 저장된 originalUrl/resultImageUrl 등을 직접 사용하는 것을 권장.
  const key = relKey.replace(/^\/+/, "");
  return {
    key,
    url: `https://fal.media/${key}`,
  };
}
