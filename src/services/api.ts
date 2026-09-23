export async function requestJson<Result>(path: string, signal?: AbortSignal, body?: unknown): Promise<Result> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('API недоступен. Запустите FastAPI на порту 8000; интерфейс — через Vite или собранный backend.');
  }
  const result = await response.json();
  if (!response.ok) {
    const detail = result.detail;
    const message = typeof detail === 'string' ? detail
      : detail?.message ?? detail?.validation_errors?.map((issue: { message: string }) => issue.message).join(' ')
      ?? (Array.isArray(detail) ? detail.map((issue: { msg: string }) => issue.msg).join(' ') : undefined);
    throw new Error(message || `Сервер вернул HTTP ${response.status}.`);
  }
  return result as Result;
}
