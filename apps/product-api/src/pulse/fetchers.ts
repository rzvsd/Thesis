interface ServiceEnvelope<TData> {
  ok?: boolean;
  data?: TData;
  error_flag?: boolean;
  error_message?: string;
}

export async function fetchEnvelope<TData>(
  url: string,
  init?: RequestInit
): Promise<{ ok: true; data: TData } | { ok: false; errorMessage: string }> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      return {
        ok: false,
        errorMessage: `HTTP ${response.status}`
      };
    }

    const payload = (await response.json()) as ServiceEnvelope<TData>;
    const isSuccess = payload.ok === true && payload.error_flag !== true;
    if (!isSuccess || payload.data === undefined || payload.data === null) {
      return {
        ok: false,
        errorMessage: payload.error_message?.trim() || "provider returned no data"
      };
    }

    return {
      ok: true,
      data: payload.data
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : "network error"
    };
  }
}
