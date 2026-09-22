// ~/cgamja-philosophy/docs/COMMIT.md — Conventional Commits, 한국어 제목 50자 이내, 테스트는 test:로 분리(분리는 lefthook.yml이 검사)
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "test", "chore", "docs", "style", "perf"],
    ],
    "subject-max-length": [2, "always", 50],
    // 한국어 제목에 영어 고유명사(ETag · Lambda)가 섞이면 case 검사가 오탐한다
    "subject-case": [0],
  },
};
