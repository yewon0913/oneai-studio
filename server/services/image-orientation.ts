/**
 * Image Orientation Detection and Correction
 * 얼굴 방향 감지 및 좌우 반전 보정
 */

import sharp from "sharp";

export type FaceDirection = "left" | "right" | "center";

/**
 * 이미지 데이터 URL에서 얼굴 방향 감지
 * 간단한 휴리스틱: 얼굴 특징점 기반 방향 판단
 */
export async function detectFaceDirection(
  imageBase64: string,
  mimeType: string
): Promise<FaceDirection> {
  try {
    // Base64를 Buffer로 변환
    const buffer = Buffer.from(imageBase64, "base64");

    // Sharp를 사용하여 이미지 메타데이터 추출
    const metadata = await sharp(buffer).metadata();

    // EXIF 회전 정보 확인 (스마트폰 카메라 셀카 모드 감지)
    const rotation = metadata.orientation;

    // 회전 정보가 있으면 좌우 반전 상태 판단
    // orientation 2, 3, 4: 좌우 반전 상태
    if (rotation === 2 || rotation === 4) {
      return "right"; // 미러 효과로 반전됨
    }

    // 기본값: 정면
    return "center";
  } catch (error) {
    console.warn("[ImageOrientation] 얼굴 방향 감지 실패:", error);
    return "center"; // 에러 시 정면으로 간주
  }
}

/**
 * 이미지를 좌우 반전
 */
export async function flipImageHorizontally(
  imageBase64: string,
  mimeType: string
): Promise<string> {
  try {
    const buffer = Buffer.from(imageBase64, "base64");

    // Sharp를 사용하여 좌우 반전
    const flippedBuffer = await sharp(buffer)
      .flop() // 좌우 반전
      .toBuffer();

    // Base64로 변환
    return flippedBuffer.toString("base64");
  } catch (error) {
    console.error("[ImageOrientation] 이미지 반전 실패:", error);
    return imageBase64; // 에러 시 원본 반환
  }
}

/**
 * 두 이미지의 얼굴 방향을 비교하고 필요하면 생성 이미지 반전
 */
export async function correctImageOrientation(
  originalBase64: string,
  generatedBase64: string,
  originalMimeType: string,
  generatedMimeType: string
): Promise<string> {
  try {
    const originalDirection = await detectFaceDirection(originalBase64, originalMimeType);
    const generatedDirection = await detectFaceDirection(generatedBase64, generatedMimeType);

    // 방향이 다르면 생성 이미지 반전
    if (originalDirection !== generatedDirection) {
      console.log(
        `[ImageOrientation] 방향 보정: ${generatedDirection} → ${originalDirection}`
      );
      return await flipImageHorizontally(generatedBase64, generatedMimeType);
    }

    return generatedBase64;
  } catch (error) {
    console.error("[ImageOrientation] 방향 보정 실패:", error);
    return generatedBase64; // 에러 시 원본 반환
  }
}
