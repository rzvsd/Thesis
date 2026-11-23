import { assertEquals } from "jsr:@std/assert@1.0.13";
import { call, FakeStore } from "../user/test_fakes.ts";
import { devicesRoutes } from "./index.ts";

const PATH = "/notifications/device-token";

function setup() {
  const store = new FakeStore();
  store.addUser("u1");
  return { store, routes: devicesRoutes(store.devicesDeps()) };
}

// Ported from m4-push-devices.test.ts "M4 push model supports multiple active devices per user and
// installation-level unregister". The weekly digest send is M4's; here we check the device rows directly.
Deno.test("multiple active devices per user and installation-level unregister", async () => {
  const { store, routes } = setup();
  const a = await call(routes, "POST", PATH, {
    userId: "u1",
    body: {
      installation_id: "android-installation-a",
      device_token: "device-token-installation-a-1234567890",
      platform: "android",
    },
  });
  assertEquals(a, {
    status: 200,
    body: { status: "ok", has_device_token: true, installation_id: "android-installation-a" },
  });
  const b = await call(routes, "POST", PATH, {
    userId: "u1",
    body: {
      installation_id: "android-installation-b",
      device_token: "device-token-installation-b-1234567890",
      platform: "android",
    },
  });
  assertEquals(b.status, 200);
  assertEquals(store.activeDevices("u1").length, 2);

  const unregisterB = await call(routes, "POST", PATH, {
    userId: "u1",
    body: { installation_id: "android-installation-b", device_token: null, platform: "android" },
  });
  assertEquals(unregisterB, {
    status: 200,
    body: { status: "ok", has_device_token: false, installation_id: "android-installation-b" },
  });
  const active = store.activeDevices("u1");
  assertEquals(active.map((d) => d.installationId), ["android-installation-a"]);
  assertEquals(
    store.devices.find((d) => d.installationId === "android-installation-b")?.reason,
    "client_unregistered",
  );
});

Deno.test("no installation_id uses legacy:<userId>; an empty body unregisters every device", async () => {
  const { store, routes } = setup();
  const reg = await call(routes, "POST", PATH, {
    userId: "u1",
    body: { device_token: "fcm_token_1234567890123456" },
  });
  assertEquals(reg.body, { status: "ok", has_device_token: true, installation_id: "legacy:u1" });
  assertEquals(store.devices[0].platform, "android");

  // Kotlin sends device_token: null, which drops the key: the body can be {}.
  const unreg = await call(routes, "POST", PATH, { userId: "u1", body: {} });
  assertEquals(unreg.body, { status: "ok", has_device_token: false, installation_id: "legacy:u1" });
  assertEquals(store.activeDevices("u1").length, 0);
  assertEquals(store.legacyCleared, ["u1"]);
});

Deno.test("422 rules, 404 user_not_found and 500 device_registration_failed", async () => {
  const { store, routes } = setup();
  const cases: [Record<string, unknown>, string][] = [
    [{ device_token: "short" }, "device_token must be at least 16 characters."],
    [
      { device_token: "fcm_token_1234567890123456", installation_id: "short" },
      "installation_id must be at least 8 characters.",
    ],
    [
      { device_token: "fcm_token_1234567890123456", platform: "x".repeat(33) },
      "platform must be 32 characters or fewer.",
    ],
  ];
  for (const [body, message] of cases) {
    const res = await call(routes, "POST", PATH, { userId: "u1", body });
    assertEquals(res.status, 422);
    assertEquals(res.body, { error: "validation_failed", error_message: message });
  }

  const ghost = await call(routes, "POST", PATH, {
    userId: "ghost",
    body: { device_token: "fcm_token_1234567890123456" },
  });
  assertEquals(ghost.status, 404);
  assertEquals(ghost.body.error, "user_not_found");

  store.failDeviceUpsert = true;
  const failed = await call(routes, "POST", PATH, {
    userId: "u1",
    body: { device_token: "fcm_token_1234567890123456" },
  });
  assertEquals(failed.status, 500);
  assertEquals(failed.body, {
    error: "device_registration_failed",
    error_message: "Unable to register device token.",
  });
});

Deno.test("platform is lower-cased and the same token moves between installations", async () => {
  const { store, routes } = setup();
  store.addUser("u2");
  const token = "shared-token-1234567890";
  await call(routes, "POST", PATH, {
    userId: "u1",
    body: { device_token: token, installation_id: "inst-0001", platform: "ANDROID" },
  });
  await call(routes, "POST", PATH, {
    userId: "u2",
    body: { device_token: token, installation_id: "inst-0002" },
  });
  assertEquals(store.activeDevices("u1").length, 0);
  assertEquals(store.activeDevices("u2").length, 1);
  assertEquals(store.devices[0].platform, "android");
  assertEquals(store.devices[0].reason, "token_rotated");
});
