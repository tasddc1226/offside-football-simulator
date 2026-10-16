/** D1은 한 문장에 바인딩을 100개까지 받는다. `IN (...)`에 넣는 값은 다른 바인딩 몫을 남기고 90개씩 나눈다. */
export const D1_IN_CHUNK = 90;

/** 순서를 지키며 n개씩 나눈다. */
export const chunksOf = <T>(xs: readonly T[], n = D1_IN_CHUNK): T[][] =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** 중복을 뺀 값을 나눠 읽고(병렬) 행을 잇는다. 값이 없으면 읽지 않는다. */
export async function readInChunks<T, R>(
  values: readonly T[],
  read: (chunk: T[]) => PromiseLike<R[]>,
  n = D1_IN_CHUNK,
): Promise<R[]> {
  return (await Promise.all(chunksOf([...new Set(values)], n).map(read))).flat();
}
