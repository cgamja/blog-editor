import {
  useLiveReflectDecision,
  type UseLiveReflectDecisionOptions,
} from "./use-live-reflect-decision";
import { useLiveRevisionQuery } from "./use-live-revision-query";

export type UseLiveReflectOptions = Omit<UseLiveReflectDecisionOptions, "revision">;

/** 편집 화면의 실시간 반영(openspec editor-live-reflect) — 저장한 글의 서버 판을 읽고 어떻게 할지 정한다 */
export function useLiveReflect(options: UseLiveReflectOptions) {
  const { server } = options;
  const revision = useLiveRevisionQuery(server.savedSlug(), server.syncMark);
  return useLiveReflectDecision({ ...options, revision });
}
