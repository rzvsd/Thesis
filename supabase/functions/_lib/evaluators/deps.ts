// What every evaluator gets injected. Tests pass a memory store and fixed clock.
import { pushSenderFromEnv } from "../push/index.ts";
import { disabledEmailSender, type EmailSender, type PushSender } from "./push_port.ts";
import {
  type DeepDiveQueue,
  disabledDeepDiveQueue,
  disabledReportReader,
  type ReportBodyReader,
} from "./report_port.ts";
import type { EvaluatorStore } from "./store.ts";
import { defaultTimeZone } from "./util.ts";

export interface EvaluatorDeps {
  store: EvaluatorStore;
  push: PushSender;
  email: EmailSender;
  reports: ReportBodyReader;
  deepDiveQueue: DeepDiveQueue;
  now: () => Date;
  // The old SUBSCRIPTION_TIMEZONE: "today" for evaluators.
  timeZone: string;
}

export function makeDeps(store: EvaluatorStore, overrides: Partial<EvaluatorDeps> = {}): EvaluatorDeps {
  return {
    store,
    // M4's sender, picked by PUSH_PROVIDER_MODE (disabled when unset).
    push: pushSenderFromEnv(),
    email: disabledEmailSender,
    reports: disabledReportReader,
    deepDiveQueue: disabledDeepDiveQueue,
    now: () => new Date(),
    timeZone: defaultTimeZone,
    ...overrides,
  };
}

export function nowIso(deps: EvaluatorDeps): string {
  return deps.now().toISOString();
}
