import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./auth.js";

test("hashes and verifies passwords without storing the plaintext", async () => {
  const password = "correct-horse-battery-staple";
  const encoded = await hashPassword(password);

  assert.notEqual(encoded, password);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword("wrong-password", encoded), false);
});
