export type Ok<T> = {
  readonly _tag: "Ok";
  readonly value: T;
  readonly isOk: true;
  readonly isErr: false;
};

export type Err<E> = {
  readonly _tag: "Err";
  readonly error: E;
  readonly isOk: false;
  readonly isErr: true;
};

export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T, E = never>(value: T): Result<T, E> => ({
  _tag: "Ok",
  value,
  isOk: true,
  isErr: false,
});

export const err = <E, T = never>(error: E): Result<T, E> => ({
  _tag: "Err",
  error,
  isOk: false,
  isErr: true,
});

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.isOk;

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => result.isErr;

export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => {
  if (result.isOk) {
    return ok(fn(result.value));
  }
  return err(result.error);
};

export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => {
  if (result.isErr) {
    return err(fn(result.error));
  }
  return ok(result.value);
};

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => {
  if (result.isOk) {
    return fn(result.value);
  }
  return err(result.error);
};

export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  if (result.isOk) {
    return result.value;
  }
  return defaultValue;
};

export const match = <T, E, R>(
  result: Result<T, E>,
  matcher: {
    onOk: (value: T) => R;
    onErr: (error: E) => R;
  }
): R => {
  if (result.isOk) {
    return matcher.onOk(result.value);
  }
  return matcher.onErr(result.error);
};

export const fromPromise = async <T, E>(
  promise: Promise<T>,
  errorHandler: (reason: unknown) => E
): Promise<Result<T, E>> => {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    return err(errorHandler(error));
  }
};
