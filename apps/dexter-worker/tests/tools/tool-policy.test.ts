import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCustomerSafeText,
  classifySourceVisibility,
  containsPriceTargetLanguage,
  containsTradingAdvice,
  containsUnsupportedCausality
} from "../../src/tools/tool-policy";

test("policy blocks trading advice, price targets, and position sizing", () => {
  assert.equal(containsTradingAdvice("Buy the dip and add shares."), true);
  assert.equal(containsTradingAdvice("Position size should be smaller."), true);
  assert.equal(containsPriceTargetLanguage("The price target is $120."), true);
  assert.throws(() => assertCustomerSafeText("Hold until the target price improves."));
});

test("policy blocks unsupported causality wording", () => {
  assert.equal(containsUnsupportedCausality("The move happened because rates fell."), true);
  assert.throws(() => assertCustomerSafeText("The stock rose due to rates."));
});

test("source visibility keeps social sources internal and official metadata allowed", () => {
  assert.equal(classifySourceVisibility("reddit"), "internal_only");
  assert.equal(classifySourceVisibility("polymarket"), "internal_only");
  assert.equal(classifySourceVisibility("sec"), "customer_metadata");
  assert.equal(classifySourceVisibility("fred"), "customer_metadata");
  assert.equal(classifySourceVisibility("company_ir"), "customer_metadata");
  assert.equal(classifySourceVisibility("unknown_blog"), "internal_only");
});
