export type DebugSignal = 'blocked' | 'external' | 'warning' | 'ok' | 'none';

const STATUS_CODE_PATTERN = /\b(?:http\s*)?(?:status|code)?\s*(401|403|404|408|409|422|429|500|502|503|504)\b/i;

const parseNumericStatus = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const collectCandidateStatuses = (item: any): Array<number | null> => {
  const payload = item?.output || item?.payload || item?.payload_json || item?.inbound_event || {};
  return [
    parseNumericStatus(item?.status_code),
    parseNumericStatus(item?.statusCode),
    parseNumericStatus(item?.http_status),
    parseNumericStatus(item?.response?.status),
    parseNumericStatus(item?.response?.statusCode),
    parseNumericStatus(payload?.status),
    parseNumericStatus(payload?.statusCode),
    parseNumericStatus(payload?.body?.status),
    parseNumericStatus(payload?.body?.statusCode),
    parseNumericStatus(payload?.contents?.status),
    parseNumericStatus(payload?.contents?.statusCode),
    parseNumericStatus(payload?.response?.status),
    parseNumericStatus(payload?.response?.statusCode),
    parseNumericStatus(payload?.result?.status),
    parseNumericStatus(payload?.result?.statusCode),
  ];
};

export const getEvidenceHttpStatus = (item: any): number | null => {
  for (const candidate of collectCandidateStatuses(item)) {
    if (candidate != null) return candidate;
  }

  const message = String(item?.message || item?.error || '');
  const matched = message.match(STATUS_CODE_PATTERN);
  return matched ? Number(matched[1]) : null;
};

export const normalizeLogLevel = (log: any): 'error' | 'warning' | 'info' => {
  const raw = log?.level;
  if (typeof raw === 'number') {
    if (raw >= 4) return 'error';
    if (raw >= 2) return 'warning';
    return 'info';
  }
  const value = String(raw || '').toLowerCase();
  if (value === 'error' || value === 'failed') return 'error';
  if (value === 'warning' || value === 'warn') return 'warning';
  return 'info';
};

const messageSuggestsExternal = (message: string): boolean => {
  return /(status|http|request|response|timeout|timed out|rate limit|unauthorized|forbidden|not found|server error|bad gateway|service unavailable|gateway timeout)/i.test(message);
};

export const classifyEventSignal = (event: any): DebugSignal => {
  if (!event) return 'none';

  if (event.status === 'error' || event.status === 'failed' || event.error) return 'blocked';

  const httpStatus = getEvidenceHttpStatus(event);
  if (httpStatus != null && httpStatus >= 400) return 'external';

  if (event.status === 'warning') return 'warning';
  return 'ok';
};

export const classifyLogSignal = (log: any): DebugSignal => {
  if (!log) return 'none';

  const level = normalizeLogLevel(log);
  const httpStatus = getEvidenceHttpStatus(log);
  const message = String(log.message || log.error || '');

  if (level === 'error') {
    if ((httpStatus != null && httpStatus >= 400) || messageSuggestsExternal(message)) {
      return 'external';
    }
    return 'blocked';
  }

  if (level === 'warning') {
    if (httpStatus != null && httpStatus >= 400) return 'external';
    return 'warning';
  }

  return 'ok';
};

export const classifyActionLiveSignal = (action: any): DebugSignal => {
  if (!action) return 'none';

  if (action.not_working === true) return 'blocked';

  const pendingRuns = Number(action.pending_action_runs_count || 0);
  const logsCount = Number(action.logs_count ?? action.logsCount ?? 0);
  if (action.last_error_log_at || pendingRuns > 0 || action.monitor_failures || logsCount > 0) {
    return 'warning';
  }

  if (action.last_event_at) return 'ok';
  return 'none';
};

export const classifyStoryLiveSignal = (story: any): DebugSignal => {
  if (!story) return 'none';

  const notWorkingActions = Number(story.not_working_actions_count || 0);
  const pendingRuns = Number(story.pending_action_runs_count || 0);
  const concurrentRuns = Number(story.concurrent_runs_count || 0);
  const tokensUsed = Number(story.tokens_used_percentage || 0);

  if (notWorkingActions > 0) return 'blocked';
  if (pendingRuns > 0 || concurrentRuns > 0 || tokensUsed >= 80) return 'warning';
  return 'ok';
};

export const combineSignals = (signals: DebugSignal[]): DebugSignal => {
  if (signals.includes('blocked')) return 'blocked';
  if (signals.includes('external')) return 'external';
  if (signals.includes('warning')) return 'warning';
  if (signals.includes('ok')) return 'ok';
  return 'none';
};
