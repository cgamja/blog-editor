/**
 * 경로별 직렬화 — 확인(읽기)과 쓰기 사이의 await 틈에 같은 경로의 다른 작업이 끼지 못하게 한다.
 * 같은 프로세스 안에서만 원자적이다(로컬 개발은 프로세스 하나, 운영 원자성은 S3 조건부 쓰기 — adr-014).
 * 모듈 전역이라 같은 루트를 연 저장소 인스턴스끼리도 줄을 선다(file-store · file-ai-undo-store).
 */
const queues = new Map<string, Promise<unknown>>();

export function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const result = previous.then(task, task);
  queues.set(
    key,
    result.catch(() => undefined),
  );
  return result;
}
