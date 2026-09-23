import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "../services/api";
import type { AnalysisResponse, AnalysisStatus, Plan } from "../types";

export function useAnalysis(currentPlanKey: string) {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [response, setResponse] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [analyzedPlanKey, setAnalyzedPlanKey] = useState("");
  const request = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    if (request.current) {
      request.current.abort();
      request.current = null;
      setStatus("cancelled");
    }
  }, []);
  useEffect(() => {
    cancel();
  }, [currentPlanKey, cancel]);
  useEffect(() => () => request.current?.abort(), []);

  const start = async (plan: Plan) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    setError("");
    setResponse(null);
    setAnalyzedPlanKey(currentPlanKey);
    // The server has its own shorter deadline; this also bounds broken connections.
    const timeout = window.setTimeout(
      () => controller.abort("timeout"),
      50_000,
    );
    try {
      const result = await requestJson<AnalysisResponse>(
        "/api/analysis",
        controller.signal,
        plan,
      );
      if (request.current !== controller) return;
      setResponse(result);
      setStatus("complete");
    } catch (caught) {
      if (request.current !== controller) return;
      setError(
        controller.signal.reason === "timeout"
          ? "Сервер не ответил вовремя. Повторите анализ."
          : caught instanceof Error
            ? caught.message
            : "Анализ недоступен.",
      );
      setStatus("error");
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  };
  return {
    status,
    response,
    error,
    start,
    cancel,
    isStale: Boolean(analyzedPlanKey && analyzedPlanKey !== currentPlanKey),
  };
}
