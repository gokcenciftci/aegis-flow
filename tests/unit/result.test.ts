import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, map, mapErr, flatMap, unwrapOr, match, fromPromise } from "../../src/core/result.js";

describe("Result Monad", () => {
  it("should create Ok result correctly", () => {
    const res = ok(42);
    expect(isOk(res)).toBe(true);
    expect(isErr(res)).toBe(false);
    if (isOk(res)) {
      expect(res.value).toBe(42);
    }
  });

  it("should create Err result correctly", () => {
    const res = err(new Error("test"));
    expect(isOk(res)).toBe(false);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) {
      expect(res.error.message).toBe("test");
    }
  });

  it("should map value on Ok and pass through Err", () => {
    const resOk = map(ok(10), (x) => x * 2);
    expect(unwrapOr(resOk, 0)).toBe(20);

    const resErr = map(err("failed"), (x: number) => x * 2);
    expect(isErr(resErr)).toBe(true);
  });

  it("should map error on Err and pass through Ok", () => {
    const resErr = mapErr(err("bad"), (e) => `Error: ${e}`);
    if (isErr(resErr)) {
      expect(resErr.error).toBe("Error: bad");
    }

    const resOk = mapErr(ok(10), (e: string) => `Error: ${e}`);
    expect(unwrapOr(resOk, 0)).toBe(10);
  });

  it("should flatMap operations correctly", () => {
    const double = (x: number) => ok(x * 2);
    const fail = (_x: number) => err("overflow");

    expect(unwrapOr(flatMap(ok(5), double), 0)).toBe(10);
    expect(isErr(flatMap(ok(5), fail))).toBe(true);
    expect(isErr(flatMap(err("initial"), double))).toBe(true);
  });

  it("should pattern match correctly", () => {
    const okVal = match(ok("hello"), {
      onOk: (v) => v.toUpperCase(),
      onErr: (e) => `Error: ${e}`,
    });
    expect(okVal).toBe("HELLO");

    const errVal = match(err("oops"), {
      onOk: (v) => v,
      onErr: (e) => `caught: ${e}`,
    });
    expect(errVal).toBe("caught: oops");
  });

  it("should convert promise into Result", async () => {
    const resSuccess = await fromPromise(Promise.resolve(100), (e) => String(e));
    expect(isOk(resSuccess)).toBe(true);
    expect(unwrapOr(resSuccess, 0)).toBe(100);

    const resFail = await fromPromise(Promise.reject(new Error("network down")), (e) => (e as Error).message);
    expect(isErr(resFail)).toBe(true);
    if (isErr(resFail)) {
      expect(resFail.error).toBe("network down");
    }
  });
});
