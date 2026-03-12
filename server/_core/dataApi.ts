/**
 * Data API helper
 * Manus Forge 프록시 비활성화 — Railway에서는 사용 불가.
 * 호출 시 크래시 대신 명확한 에러 메시지 반환.
 */

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

export async function callDataApi(
  apiId: string,
  _options: DataApiCallOptions = {}
): Promise<unknown> {
  console.warn(`[DataApi] callDataApi("${apiId}") 호출됨 — Manus Forge 프록시 비활성화 상태`);
  throw new Error(
    `Data API "${apiId}" is not available: Manus Forge proxy is not configured in this environment`
  );
}
