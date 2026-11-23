import { assertEquals } from "jsr:@std/assert@1.0.13";
import {
  buildMacroNewsPack,
  classifyMacroNewsSeverity,
  classifyMacroNewsTopic,
  corroboratingSources,
  isMacroHeadline,
  uniqueHeadlineItems,
} from "./macro_news.ts";
import type { MarketPulseHeadlineItem } from "./contracts.ts";

const item = (headline: string, source = "Reuters"): MarketPulseHeadlineItem => ({
  headline,
  source_name: source,
  evidence: [],
});

function pack(items: MarketPulseHeadlineItem[]) {
  return buildMacroNewsPack({
    asOf: "2026-11-23",
    generatedAt: "2026-11-23T11:30:00.000Z",
    headlineItems: items,
    macroNewsItems: undefined,
    macroNewsFetchState: "complete",
    macroNewsUnavailableReason: undefined,
  });
}

// The three harmless headlines from the rebuild branch audit (NG4). Each was a false alert.
Deno.test("harmless headlines are not macro news and raise no shock", () => {
  const harmless = [
    "Software stocks rally after Warner Bros. award season forecast",
    "FedEx warns on holiday shipping volumes",
    "Turmoil in soil-testing firm as traders exit",
  ];
  for (const headline of harmless) {
    assertEquals(isMacroHeadline(headline), false, headline);
    assertEquals(classifyMacroNewsSeverity(headline), "normal", headline);
  }
  const result = pack(harmless.map((h) => item(h)));
  assertEquals(result.state, "calm");
  assertEquals(result.items, []);
});

Deno.test("business uses of war, attack and emergency are not shocks", () => {
  for (
    const headline of [
      "Streaming price war squeezes margins",
      "Trade war fears ease as talks resume",
      "Chipmaker builds war chest for acquisitions",
      "Bidding war breaks out for biotech",
      "Drugmaker wins emergency use authorization",
      "Airline shares dip after emergency landing",
      "CEO recovering from heart attack",
      "Rival launches attack ad campaign",
      "Investors fed up with buybacks",
    ]
  ) {
    assertEquals(classifyMacroNewsSeverity(headline), "normal", headline);
  }
});

Deno.test("real conflict and policy headlines keep their class", () => {
  const cases: Array<[string, string, string]> = [
    ["Missile attack hits Taiwan port", "shock", "war_conflict"],
    ["Russia invades neighbour as war widens", "shock", "war_conflict"],
    ["Proxy war escalates in the region", "shock", "war_conflict"],
    ["Fed calls emergency meeting on bank stress", "shock", "central_bank"],
    ["US imposes new tariffs on Chinese steel", "notable", "trade"],
    ["Sanctions widen on Russian banks", "notable", "geopolitical"],
    ["Fed holds rates steady", "normal", "central_bank"],
    ["ECB signals rate cut in June", "normal", "central_bank"],
    ["Oil climbs as OPEC trims output", "normal", "energy"],
    ["Export controls tighten on advanced chips", "normal", "trade"],
  ];
  for (const [headline, severity, topic] of cases) {
    assertEquals(isMacroHeadline(headline), true, headline);
    assertEquals(classifyMacroNewsSeverity(headline), severity, headline);
    assertEquals(classifyMacroNewsTopic(headline), topic, headline);
  }
});

Deno.test("regions come from whole words, not from pieces like 'focus '", () => {
  const [focus] = pack([item("Fed in focus as inflation cools")]).items;
  assertEquals(focus.affected_regions, ["Global"]);
  const [us] = pack([item("US inflation cools more than expected")]).items;
  assertEquals(us.affected_regions, ["United States"]);
});

Deno.test("one source alone is reported, never corroborated", () => {
  const result = pack([
    item("Missile attack hits Taiwan port"),
    item("Russia invades neighbour as war widens"),
  ]);
  assertEquals(result.state, "shock");
  assertEquals(result.items.map((i) => i.confirmation_state), ["reported", "reported"]);
  assertEquals(result.items.map((i) => i.corroboration_count), [1, 1]);
});

Deno.test("two shock headlines about different events do not corroborate each other", () => {
  const result = pack([
    item("Missile attack hits Taiwan port", "Reuters"),
    item("Russia invades neighbour as war widens", "Bloomberg"),
  ]);
  assertEquals(result.items.map((i) => i.confirmation_state), ["reported", "reported"]);
});

Deno.test("two sources on the same event corroborate it", () => {
  const a = item("Missile attack hits Taiwan port", "Reuters");
  const b = item("Taiwan port struck in missile attack", "Bloomberg");
  assertEquals(corroboratingSources(a, [a, b]), 2);
  const result = pack([a, b]);
  assertEquals(result.items.map((i) => i.confirmation_state), ["corroborated", "corroborated"]);
  assertEquals(result.items.map((i) => i.corroboration_count), [2, 2]);
});

Deno.test("the same source twice is still one source", () => {
  const a = item("Missile attack hits Taiwan port", "Reuters");
  const b = item("Taiwan port struck in missile attack", "reuters ");
  assertEquals(corroboratingSources(a, [a, b]), 1);
});

Deno.test("a macro headline behind six newer items is still read", () => {
  const newer = Array.from({ length: 7 }, (_, i) => item(`Retailer ${i} posts quarterly results`));
  const result = pack([...newer, item("Fed holds rates steady")]);
  assertEquals(result.items.map((i) => i.headline), ["Fed holds rates steady"]);
  // The digest keeps its cap of six.
  assertEquals(uniqueHeadlineItems([...newer, item("Fed holds rates steady")]).length, 6);
});

Deno.test("a shock headline is never dropped by the cap of eight", () => {
  const macro = Array.from({ length: 9 }, (_, i) => item(`Oil update ${i} as OPEC meets`));
  const result = pack([...macro, item("Missile attack hits Taiwan port")]);
  assertEquals(result.items.length, 8);
  assertEquals(result.items[0].headline, "Missile attack hits Taiwan port");
  assertEquals(result.state, "shock");
});
