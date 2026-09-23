// Same-origin in production; Vite forwards /api to FastAPI during development.
export async function requestJson<T>(
  path: string,
  signal: AbortSignal,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      signal,
      method: body === undefined ? "GET" : "POST",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "Нет соединения с сервером. Проверьте, запущен ли backend.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const messages = detail?.validation_errors?.map(
      (issue: { message: string }) => issue.message,
    );
    throw new Error(
      typeof detail === "string"
        ? detail
        : messages?.join(" ") || `Ошибка сервера (${response.status}).`,
    );
  }
  if (!data)
    throw new Error(
      "Сервер вернул некорректный ответ. Проверьте адрес backend.",
    );
  return data as T;
}
