import assert from "node:assert/strict";
import test from "node:test";

import {
  computeFearGreedComposite,
  normalizeLinearRange,
  toFearGreedLabel,
  type SignalInput
} from "../src";

test("normalizeLinearRange supports regular and inverted normalization", () => {
  assert.equal(normalizeLinearRange(12, 12, 35), 0);
  assert.equal(normalizeLinearRange(35, 12, 35), 100);
  assert.equal(normalizeLinearRange(12, 12, 35, true), 100);
  assert.equal(normalizeLinearRange(35, 12, 35, true), 0);
});

test("toFearGreedLabel maps threshold boundaries correctly", () => {
  assert.equal(toFearGreedLabel(0), "extreme_fear");
  assert.equal(toFearGreedLabel(20), "extreme_fear");
  assert.equal(toFearGreedLabel(21), "fear");
  assert.equal(toFearGreedLabel(40), "fear");
  assert.equal(toFearGreedLabel(41), "neutral");
  assert.equal(toFearGreedLabel(60), "neutral");
  assert.equal(toFearGreedLabel(61), "greed");
  assert.equal(toFearGreedLabel(80), "greed");
  assert.equal(toFearGreedLabel(81), "extreme_greed");
});

test("computeFearGreedComposite reweights available inputs and emits missing_inputs", () => {
  const inputs: SignalInput[] = [
    {
      input_name: "vix",
      provider: "yahoo_finance",
      available: true,
      normalized_score: 80
    },
    {
      input_name: "momentum",
      provider: "yahoo_finance",
      available: true,
      normalized_score: 70
    },
    {
      input_name: "breadth",
      provider: "yahoo_finance",
      available: true,
      normalized_score: 60
    },
    {
      input_name: "junk_bond_spread",
      provider: "fred",
      available: false
    }
  ];

  const result = computeFearGreedComposite(inputs, 3);
  assert.equal(result.score, 70);
  assert.equal(result.label, "greed");
  assert.deepEqual(result.missing_inputs, ["junk_bond_spread"]);
  assert.equal(result.sub_scores.find((entry) => entry.input_name === "junk_bond_spread")?.weight, 0);
  assert.equal(result.sub_scores.find((entry) => entry.input_name === "vix")?.weight, 0.33333333);
});

test("computeFearGreedComposite rejects insufficient input availability", () => {
  const inputs: SignalInput[] = [
    { input_name: "vix", provider: "yahoo_finance", available: true, normalized_score: 80 },
    { input_name: "momentum", provider: "yahoo_finance", available: false }
  ];

  assert.throws(
    () => computeFearGreedComposite(inputs, 3),
    /Insufficient available inputs/
  );
});
