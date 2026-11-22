import type { MarketPulseReport } from "../../../packages/contracts/src";
import type { ProductApiConfig } from "./config";
import type { EmailMessage, EmailNotifier } from "./email";
import { emailUnsubscribeToken } from "./filing-change-alerts";
import { logError, logInfo } from "./logging";
import { buildPulseBriefPlan } from "./pulse-brief-plan";
import { buildPulseBriefHtml } from "./pulse-brief-render";
import type { ProductStore } from "./store";

// Daily Pulse by email. Free for every tier. Respects the pulse_email notification preference
// (enabled by default, like every notification type) and the per-user email opt-out.

const UNSUBSCRIBE_PLACEHOLDER = "__THESIS_UNSUBSCRIBE_URL__";

interface PulseEmailRuntime {
  config: ProductApiConfig;
  store: ProductStore;
  emailNotifier: EmailNotifier;
}

interface CssRule {
  parts: string[];
  declarations: string;
  specificity: number;
  order: number;
}

// Supports the selector shapes the brief CSS uses: tag, .class, tag.class, .a.b, joined by spaces.
const SIMPLE_PART = /^([a-z][a-z0-9]*)?((?:\.[\w-]+)*)$/i;

function parseCssRules(css: string): CssRule[] {
  // Drop at-rules (@page, @media): email clients that honor them still get the <style> block.
  let flat = "";
  for (let index = 0; index < css.length; index += 1) {
    if (css[index] !== "@") {
      flat += css[index];
      continue;
    }
    let depth = 0;
    for (; index < css.length; index += 1) {
      if (css[index] === "{") depth += 1;
      if (css[index] === "}" && --depth === 0) break;
    }
  }

  const rules: CssRule[] = [];
  for (const match of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = (match[2] ?? "").trim().replace(/;$/, "");
    for (const selector of (match[1] ?? "").split(",")) {
      const parts = selector.trim().split(/\s+/);
      if (!declarations || parts.some((part) => !part || !SIMPLE_PART.test(part))) {
        continue;
      }
      const classCount = parts.reduce((sum, part) => sum + (part.match(/\./g)?.length ?? 0), 0);
      const tagCount = parts.filter((part) => /^[a-z]/i.test(part)).length;
      rules.push({ parts, declarations, specificity: classCount * 10 + tagCount, order: rules.length });
    }
  }
  return rules.sort((left, right) => left.specificity - right.specificity || left.order - right.order);
}

interface ElementInfo {
  tag: string;
  classes: string[];
}

function partMatches(part: string, element: ElementInfo): boolean {
  const [tag, ...classes] = part.split(".");
  return (!tag || tag.toLowerCase() === element.tag) && classes.every((name) => element.classes.includes(name));
}

function selectorMatches(parts: string[], element: ElementInfo, ancestors: ElementInfo[]): boolean {
  if (!partMatches(parts[parts.length - 1] ?? "", element)) {
    return false;
  }
  let ancestorIndex = ancestors.length - 1;
  for (let partIndex = parts.length - 2; partIndex >= 0; partIndex -= 1) {
    while (ancestorIndex >= 0 && !partMatches(parts[partIndex] ?? "", ancestors[ancestorIndex] as ElementInfo)) {
      ancestorIndex -= 1;
    }
    if (ancestorIndex < 0) {
      return false;
    }
    ancestorIndex -= 1;
  }
  return true;
}

const VOID_TAGS = new Set(["meta", "br", "img", "hr", "input", "link"]);

/** Copies the <style> rules onto each element as inline styles (many email clients drop <style>). */
function inlineCss(html: string): string {
  const rules = parseCssRules(/<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "");
  const bodyStart = html.indexOf("<body");
  const stack: ElementInfo[] = [];
  const body = html.slice(bodyStart).replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g,
    (whole, closing: string, rawTag: string, attributes: string, selfClosing: string) => {
      const tag = rawTag.toLowerCase();
      if (closing) {
        const index = stack.map((entry) => entry.tag).lastIndexOf(tag);
        if (index >= 0) stack.length = index;
        return whole;
      }
      const classes = /\bclass="([^"]*)"/.exec(attributes)?.[1]?.split(/\s+/).filter(Boolean) ?? [];
      const element = { tag, classes };
      const declarations = rules
        .filter((rule) => selectorMatches(rule.parts, element, stack))
        .map((rule) => rule.declarations);
      if (!selfClosing && !VOID_TAGS.has(tag)) {
        stack.push(element);
      }
      if (declarations.length === 0) {
        return whole;
      }
      const existing = /\bstyle="([^"]*)"/.exec(attributes)?.[1];
      const style = [...declarations, ...(existing ? [existing] : [])].join(";").replaceAll("\"", "'");
      const withoutStyle = attributes.replace(/\s*\bstyle="[^"]*"/, "");
      return `<${rawTag}${withoutStyle} style="${style}"${selfClosing ? " /" : ""}>`;
    }
  );
  return html.slice(0, bodyStart) + body;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

/**
 * The Pulse brief HTML adapted for email clients: no sticky progress bar, no collapsible
 * <details>, inline styles, plus the not-advice line and the unsubscribe link.
 */
export function buildPulseEmailHtml(report: MarketPulseReport, unsubscribeUrl: string | undefined): string {
  const source = buildPulseBriefHtml(report)
    .replace("<div class=\"reading-progress\" aria-hidden=\"true\"></div>", "")
    .replace("<details>", "<div>")
    .replace("</details>", "</div>")
    .replace("<summary>", "<h3>")
    .replace("</summary>", "</h3>");
  const unsubscribe = unsubscribeUrl
    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#d7b985">Unsubscribe from Thesis emails</a>`
    : "Turn these emails off in the Thesis app under notification settings.";
  const footer =
    "<div style=\"max-width:540px;margin:0 auto;padding:16px 21px 28px;color:#9aa4ad;" +
    "font:11px/1.5 Arial,'Helvetica Neue',sans-serif\">" +
    "<p style=\"margin:0 0 8px\">Thesis is research, not financial advice.</p>" +
    `<p style="margin:0">You get this email because you have a Thesis account. ${unsubscribe}</p>` +
    "</div>";
  const inlined = inlineCss(source.replace("</article>", `</article>${footer}`));
  const bodyStyle = /<body style="([^"]*)">/.exec(inlined)?.[1] ?? "";
  // Gmail drops <body> styles: repeat them on a wrapper so the dark background survives.
  return inlined
    .replace(/<body[^>]*>/, (tag) => `${tag}<div style="${bodyStyle};padding:8px 0">`)
    .replace("</body>", "</div></body>");
}

function buildPulseEmailText(report: MarketPulseReport, unsubscribeUrl: string | undefined): string {
  const copy = buildPulseBriefPlan(report).copy;
  return [
    "THESIS Morning Brief",
    "",
    copy.the_read,
    "",
    copy.morning_story,
    "",
    copy.one_thing,
    "",
    "Open Thesis to read the full brief.",
    "Thesis is research, not financial advice.",
    "",
    unsubscribeUrl
      ? `Stop all Thesis notification emails: ${unsubscribeUrl}`
      : "Turn these emails off in the Thesis app under notification settings."
  ].join("\n");
}

function truncate(value: string, maxLength: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

/**
 * Emails the new Pulse to every opted-in user with a verified address. At most once per Pulse date:
 * a re-run on the same date sends nothing. Never throws; delivery problems are logged.
 */
export async function dispatchPulseEmails(
  runtime: PulseEmailRuntime,
  input: { report: MarketPulseReport; previousReport: MarketPulseReport | undefined }
): Promise<void> {
  const pulseDate = input.report.cycle_end.slice(0, 10);
  if (input.previousReport?.cycle_end.slice(0, 10) === pulseDate) {
    return;
  }

  try {
    const targets = await runtime.store.listUsersWithEmailByNotificationType({ notificationType: "pulse_email" });
    if (targets.length === 0) {
      return;
    }

    const baseUrl = runtime.config.publicApiBaseUrl;
    const placeholder = baseUrl ? UNSUBSCRIBE_PLACEHOLDER : undefined;
    // Render once; only the unsubscribe link differs per user.
    const html = buildPulseEmailHtml(input.report, placeholder);
    const text = buildPulseEmailText(input.report, placeholder);
    const firstSentence = buildPulseBriefPlan(input.report).copy.the_read.split(/(?<=\.)\s/)[0] ?? "";
    const subject = `Morning Brief: ${truncate(firstSentence, 90)}`;

    const messages: EmailMessage[] = targets.map((target) => {
      if (!baseUrl) {
        return { target, payload: { subject, text, html } };
      }
      const unsubscribeUrl =
        `${baseUrl}/v1/email/unsubscribe?token=${emailUnsubscribeToken(runtime.config.jwtSecret, target.userId)}`;
      return {
        target,
        payload: {
          subject,
          text: text.replaceAll(UNSUBSCRIBE_PLACEHOLDER, unsubscribeUrl),
          html: html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, escapeHtml(unsubscribeUrl)),
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
          }
        }
      };
    });

    const result = await runtime.emailNotifier.sendBatch(messages);
    logInfo("Pulse email dispatched", {
      report_id: input.report.report_id,
      pulse_date: pulseDate,
      attempted: result.attempted,
      delivered: result.delivered,
      failed: result.failed,
      provider: result.provider
    });
  } catch (error) {
    logError("Pulse email dispatch failed", {
      report_id: input.report.report_id,
      pulse_date: pulseDate,
      error_message: error instanceof Error ? error.message : "unknown"
    });
  }
}
