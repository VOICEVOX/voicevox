// Proxyがあってもrfdcは正常に動作するかのテスト。
// クローンに使うライブラリを変えたときはこのテストも変更して下さい。
import createRfdc from "rfdc";
import { test } from "vitest";

const rfdc = createRfdc();

test("Proxyがあってもクローンできる", () => {
  const original = { a: 1, b: { c: 2 } };
  const proxied = new Proxy(original, {
    get(target, prop) {
      return target[prop as keyof typeof target];
    },
  });

  const cloned = rfdc(proxied);

  expect(cloned).toEqual(original);
});

test("内部にProxyがあってもクローンできる", () => {
  const original = { a: 1, b: { c: 2 } };
  const proxied = rfdc(original);
  proxied.b = new Proxy(original.b, {
    get(target, prop) {
      return target[prop as keyof typeof target];
    },
  });

  const cloned = rfdc(proxied);

  expect(cloned).toEqual(original);
});

test("structuredCloneでは出来ないことを確認する", () => {
  const original = { a: 1, b: { c: 2 } };
  const proxied = new Proxy(original, {
    get(target, prop) {
      return target[prop as keyof typeof target];
    },
  });

  expect(() => structuredClone(proxied)).toThrow();
});

test("structuredCloneでは内部にProxyがあるときも出来ないことを確認する", () => {
  const original = { a: 1, b: { c: 2 } };
  const proxied = rfdc(original);
  proxied.b = new Proxy(original.b, {
    get(target, prop) {
      return target[prop as keyof typeof target];
    },
  });

  expect(() => structuredClone(proxied)).toThrow();
});
