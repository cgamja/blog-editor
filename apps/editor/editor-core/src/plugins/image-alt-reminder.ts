/**
 * 대체 텍스트가 빈 그림을 알린다 — spec: editor-image-insert, image-insert design.md 4.
 * 문서는 바꾸지 않고 노드 장식으로 속성만 단다 — 배지 모양은 editor-react CSS가 그린다.
 * https://prosemirror.net/docs/ref/#view.Decoration^node
 */
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const ALT_MISSING_ATTR = "data-alt-missing";

export const imageAltReminderKey = new PluginKey("imageAltReminder");

export function imageAltReminder(): Plugin {
  return new Plugin({
    key: imageAltReminderKey,
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (node.type.name === "image" && node.attrs.alt === "") {
            decorations.push(Decoration.node(pos, pos + node.nodeSize, { [ALT_MISSING_ATTR]: "" }));
          }
          // 그림은 atom이라 안으로 들어갈 필요가 없다
          return !node.isAtom;
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}
