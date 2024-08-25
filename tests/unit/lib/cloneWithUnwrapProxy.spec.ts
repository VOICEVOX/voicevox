import { test } from "vitest";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

const original = { a: 1, b: { c: 2 } };

const outerProxied = new Proxy(original, {});

const innerProxied = cloneWithUnwrapProxy(original);
innerProxied.b = new Proxy(original.b, {});

test("Proxyがあってもクローンできる", () => {
  const cloned = cloneWithUnwrapProxy(outerProxied);

  expect(cloned).toEqual(original);
});

test("内部にProxyがあってもクローンできる", () => {
  const cloned = cloneWithUnwrapProxy(innerProxied);

  expect(cloned).toEqual(original);
});

test("structuredCloneでは出来ないことを確認する", () => {
  expect(() => structuredClone(outerProxied)).toThrow();
});

test("structuredCloneでは内部にProxyがあるときも出来ないことを確認する", () => {
  expect(() => structuredClone(innerProxied)).toThrow();
});
