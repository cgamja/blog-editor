import { useState } from "react";
import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { BlockFlagSet } from "./block-flag-types";
import { useBlockFlagRows } from "./use-block-flag-rows";

export interface BlockFlagLayerProps {
  editor: Editor;
  frameRef: RefObject<HTMLDivElement | null>;
  flags: BlockFlagSet;
}

/**
 * 본문 최상위 블록 옆 오른쪽 여백의 점(#151 디자인 C) — 무엇을 알리는지는 부르는 쪽이 정하고(이름 · 세기),
 * 여기는 어느 블록 옆에 둘지만 정한다. 점에 올리거나 포커스하면 그 블록을 옅게 칠해 어느 블록 얘기인지 보인다.
 * ProseMirror DOM 밖 형제다(블록 손잡이와 같다).
 */
export function BlockFlagLayer({ editor, frameRef, flags }: BlockFlagLayerProps) {
  const rows = useBlockFlagRows(editor, frameRef, flags.items);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  if (rows.length === 0) return null;
  const target = rows.find((row) => row.index === highlighted);
  return (
    <div className="block-flags">
      {target !== undefined && (
        <div className="block-flag-highlight" style={target.block} aria-hidden="true" />
      )}
      {rows.map((row) => (
        <div
          key={row.index}
          className="block-flag-row"
          style={{ top: row.top, left: row.left, maxWidth: row.maxWidth }}
        >
          {row.flags.map((flag) => (
            <button
              key={flag.id}
              type="button"
              className="block-flag"
              data-tone={flag.tone}
              aria-label={flag.label}
              title={flag.label}
              onClick={() => flags.onPress(flag)}
              onPointerEnter={() => setHighlighted(row.index)}
              onPointerLeave={() => setHighlighted(null)}
              onFocus={() => setHighlighted(row.index)}
              onBlur={() => setHighlighted(null)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
