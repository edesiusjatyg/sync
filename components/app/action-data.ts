type ExtractActionResult<T> = T extends (...args: infer _Args) => Promise<infer R> ? R : Awaited<T>;

export type ActionData<T> = ExtractActionResult<T> extends infer R
  ? R extends {
      success: true;
      data: infer D;
    }
    ? D
    : never
  : never;
