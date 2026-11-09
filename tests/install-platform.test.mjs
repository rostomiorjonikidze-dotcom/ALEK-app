import assert from "node:assert/strict";
import test from "node:test";
import { isIosInstallPlatform } from "../app/lib/install-platform.ts";

test("detects iPhone and iPad user agents", () => {
  assert.equal(isIosInstallPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone", 5), true);
  assert.equal(isIosInstallPlatform("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", "iPad", 5), true);
});

test("detects iPadOS desktop user agent by touch support", () => {
  assert.equal(isIosInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", "MacIntel", 5), true);
  assert.equal(isIosInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", "MacIntel", 1), false);
});

test("does not classify other mobile and desktop platforms as iOS", () => {
  assert.equal(isIosInstallPlatform("Mozilla/5.0 (Linux; Android 15)", "Linux armv8l", 5), false);
  assert.equal(isIosInstallPlatform("Mozilla/5.0 (Windows NT 10.0)", "Win32", 1), false);
});
