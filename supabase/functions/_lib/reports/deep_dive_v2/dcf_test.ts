import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1.0.13";
import {
  baseGrowth,
  buildDcf,
  type DcfInputs,
  impliedGrowth,
  projectFcf,
  SENSITIVITY_TERMINALS,
  SENSITIVITY_WACCS,
  valuePerShare,
} from "./dcf.ts";
import type { Derived } from "./derive.ts";

const noGrowth: Derived["growth"] = {
  revenueYoY: null,
  netIncomeYoY: null,
  epsYoY: null,
  fcfYoY: null,
  revenueCagr5: null,
  revenueCagrAll: null,
  fcfCagr5: null,
  epsCagrAll: null,
};

const INPUTS: DcfInputs = {
  baseFcf: 100e9,
  shares: 15e9,
  netCash: 30e9,
  wacc: 9.5,
  terminal: 2.5,
  years: 10,
  fade: 5,
};

function dcfInput(
  over: Partial<Pick<Derived, "years" | "fcf" | "shares" | "netCash" | "growth" | "revenue">> = {},
) {
  return {
    years: [2022, 2023, 2024, 2025],
    fcf: [80, 90, 100, 110].map((x) => x * 1e9),
    shares: [16e9, 15.5e9, 15.2e9, 15e9],
    netCash: [50e9, 40e9, 35e9, 30e9],
    growth: { ...noGrowth, fcfCagr5: 6 },
    revenue: [300e9, 320e9, 340e9, 360e9],
    ...over,
  };
}

Deno.test("valuePerShare matches a hand computed one-year model", () => {
  // FCF1 = 100, PV = 100/1.1; terminal = 100 * 1 / 0.1 / 1.1; total 1000, over 10 shares.
  const v = valuePerShare(
    { baseFcf: 100, shares: 10, netCash: 0, wacc: 10, terminal: 0, years: 1, fade: 1 },
    0,
  );
  assertAlmostEquals(v, 100, 1e-9);
  const withCash = valuePerShare({
    baseFcf: 100,
    shares: 10,
    netCash: 50,
    wacc: 10,
    terminal: 0,
    years: 1,
    fade: 1,
  }, 0);
  assertAlmostEquals(withCash, 105, 1e-9);
});

Deno.test("growth holds for the first five years, then fades linearly to the terminal rate", () => {
  const path = projectFcf(INPUTS, 10);
  assertEquals(path.length, 10);
  const growth = path.map((f, i) => ((f / (i === 0 ? INPUTS.baseFcf : path[i - 1])) - 1) * 100);
  for (let t = 0; t < 5; t++) assertAlmostEquals(growth[t], 10, 1e-9);
  assertAlmostEquals(growth[5], 8.5, 1e-9);
  assertAlmostEquals(growth[6], 7, 1e-9);
  assertAlmostEquals(growth[9], 2.5, 1e-9);
});

Deno.test("valuePerShare rises with growth and returns NaN on invalid inputs", () => {
  let prev = -Infinity;
  for (let g = -20; g <= 40; g += 5) {
    const v = valuePerShare(INPUTS, g);
    assert(v > prev);
    prev = v;
  }
  assert(Number.isNaN(valuePerShare({ ...INPUTS, wacc: 2.5 }, 5)));
  assert(Number.isNaN(valuePerShare({ ...INPUTS, shares: 0 }, 5)));
  assert(Number.isNaN(valuePerShare({ ...INPUTS, baseFcf: NaN }, 5)));
  assert(Number.isNaN(valuePerShare({ ...INPUTS, years: 0 }, 5)));
  assert(Number.isNaN(valuePerShare({ ...INPUTS, fade: 11 }, 5)));
  assert(Number.isNaN(valuePerShare(INPUTS, NaN)));
});

Deno.test("impliedGrowth inverts valuePerShare", () => {
  for (const g of [-12.5, 0, 3.1, 7.3, 25]) {
    const price = valuePerShare(INPUTS, g);
    const implied = impliedGrowth(INPUTS, price);
    assert(implied !== null);
    assertAlmostEquals(implied, g, 1e-6);
  }
});

Deno.test("impliedGrowth is null outside the reachable range or on bad inputs", () => {
  assertEquals(impliedGrowth(INPUTS, valuePerShare(INPUTS, -20) - 0.01), null);
  assertEquals(impliedGrowth(INPUTS, valuePerShare(INPUTS, 40) + 0.01), null);
  assertEquals(impliedGrowth(INPUTS, 0), null);
  assertEquals(impliedGrowth(INPUTS, -5), null);
  assertEquals(impliedGrowth(INPUTS, NaN), null);
  assertEquals(impliedGrowth({ ...INPUTS, baseFcf: -1e9 }, 100), null);
  assertEquals(impliedGrowth({ ...INPUTS, wacc: 2 }, 100), null);
  assertEquals(impliedGrowth({ ...INPUTS, shares: -1 }, 100), null);
  // Range endpoints themselves are reachable.
  assertAlmostEquals(impliedGrowth(INPUTS, valuePerShare(INPUTS, 40)) as number, 40, 1e-6);
});

Deno.test("baseGrowth clamps the FCF CAGR and falls back to revenue CAGR", () => {
  assertEquals(baseGrowth({ ...noGrowth, fcfCagr5: 6.14 }), 6.1);
  assertEquals(baseGrowth({ ...noGrowth, fcfCagr5: 30 }), 15);
  assertEquals(baseGrowth({ ...noGrowth, fcfCagr5: -12 }), -5);
  assertEquals(baseGrowth({ ...noGrowth, revenueCagr5: 8.68 }), 8.7);
  assertEquals(baseGrowth({ ...noGrowth, revenueCagrAll: 21 }), 15);
  assertEquals(baseGrowth(noGrowth), null);
});

Deno.test("buildDcf builds three scenarios and a 5x5 sensitivity grid", () => {
  const dcf = buildDcf(dcfInput());
  assert(dcf);
  assertEquals(dcf.baseFcf, 100e9); // average of 90, 100, 110
  assertEquals(dcf.shares, 15e9);
  assertEquals(dcf.netCash, 30e9);
  assertEquals(dcf.inputs, {
    baseFcf: 100e9,
    shares: 15e9,
    netCash: 30e9,
    wacc: 9.5,
    terminal: 2.5,
    years: 10,
    fade: 5,
  });
  assertEquals(dcf.scenarios.map((s) => s.key), ["bear", "base", "bull"]);
  assertEquals(dcf.scenarios.map((s) => s.growth), [2, 6, 10]);
  const [bear, base, bull] = dcf.scenarios;
  assert(bear.value < base.value && base.value < bull.value);
  assertAlmostEquals(base.value, valuePerShare(dcf.inputs, 6), 0.005);
  assertEquals(base.fcfPath.length, 10);
  assertEquals(dcf.sensitivity.waccs, SENSITIVITY_WACCS);
  assertEquals(dcf.sensitivity.terminals, SENSITIVITY_TERMINALS);
  assertEquals(dcf.sensitivity.values.length, 5);
  for (const row of dcf.sensitivity.values) assertEquals(row.length, 5);
  assertEquals(dcf.sensitivity.values[2][2], base.value);
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) assert(dcf.sensitivity.values[i][j] < dcf.sensitivity.values[i][j + 1]);
  }
  for (let i = 0; i < 4; i++) assert(dcf.sensitivity.values[i][0] > dcf.sensitivity.values[i + 1][0]);
});

Deno.test("buildDcf is null without three positive FCF years, shares, net cash or growth", () => {
  assertEquals(buildDcf(dcfInput({ fcf: [100e9, 110e9] })), null);
  assertEquals(buildDcf(dcfInput({ fcf: [80e9, 90e9, -1e9, 110e9] })), null);
  assertEquals(buildDcf(dcfInput({ fcf: [80e9, 90e9, null, 110e9] })), null);
  assertEquals(buildDcf(dcfInput({ shares: [16e9, null] })), null);
  assertEquals(buildDcf(dcfInput({ shares: [] })), null);
  assertEquals(buildDcf(dcfInput({ netCash: [10e9, null] })), null);
  assertEquals(buildDcf(dcfInput({ growth: noGrowth })), null);
  // An early negative year outside the last three does not matter.
  assert(buildDcf(dcfInput({ fcf: [-50e9, 90e9, 100e9, 110e9] })));
});

Deno.test("buildDcf needs the three fiscal years ending at the latest to be consecutive", () => {
  // FY2020, FY2022, FY2025: three rows, but not three straight years.
  assertEquals(
    buildDcf(
      dcfInput({ years: [2020, 2022, 2025], fcf: [90e9, 100e9, 110e9], shares: [15e9], netCash: [30e9] }),
    ),
    null,
  );
  // One skipped year inside the last three is enough to stop the model.
  assertEquals(buildDcf(dcfInput({ years: [2021, 2022, 2024, 2025] })), null);
  // A gap before the last three does not matter.
  assert(buildDcf(dcfInput({ years: [2019, 2023, 2024, 2025] })));
  // Years that do not line up with the series give no model.
  assertEquals(buildDcf(dcfInput({ years: [2024, 2025] })), null);
});

Deno.test("buildDcf keeps working with net debt (value can sit below the debt-free value)", () => {
  const debtFree = buildDcf(dcfInput({ netCash: [0] }));
  const indebted = buildDcf(dcfInput({ netCash: [-300e9] }));
  assert(debtFree && indebted);
  assertAlmostEquals(debtFree.scenarios[1].value - indebted.scenarios[1].value, 20, 0.01);
});
