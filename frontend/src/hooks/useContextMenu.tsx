// src/hooks/useContextMenu.tsx
import { createSignal, onCleanup, Show, Component } from "solid-js";
import { Portal } from "solid-js/web";

export type MenuItem = { label: string; action: () => void };

export function useContextMenu(items: MenuItem[]) {
  const [menu, setMenu] = createSignal({
    x: 0,
    y: 0,
    items,
  });
  const [visible, setVisible] = createSignal(false);
  let menuRef: HTMLElement | null = null;

  const openMenu = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log();
    setMenu({ x: e.clientX, y: e.clientY, items });
    setVisible(true);
    window.addEventListener("mousedown", handleWindowClick);
    window.addEventListener("keydown", onKeyDown);
  };

  const handleWindowClick = (e: MouseEvent) => {
    console.log("useContextMenu.handleWindowClick");
    // メニュー内のクリックなら閉じない
    const target = e.target as Node;
    if (menuRef && menuRef.contains(target)) return;
    closeMenu();
  };

  const closeMenu = () => {
    setVisible(false);
    window.removeEventListener("mousedown", handleWindowClick);
    window.removeEventListener("keydown", onKeyDown);
  };

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") closeMenu();
  }

  onCleanup(() => {
    window.removeEventListener("mousedown", handleWindowClick);
    window.removeEventListener("keydown", onKeyDown);
  });

  const ContextMenu: Component = () => {
    return (
      <Portal>
        <Show when={visible()}>
          {/* <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
            onMouseDown={handleWindowClick}
          ></div> */}
          <ul
            ref={(el) => (menuRef = el)}
            style={{
              position: "fixed",
              top: `${menu().y}px`,
              left: `${menu().x}px`,
              margin: 0,
              padding: "0.5rem 0",
              background: "#fff",
              border: "1px solid #ddd",
              "box-shadow": "0 2px 8px rgba(0,0,0,0.2)",
              "z-index": 1000,
            }}
          >
            {menu().items.map((item) => (
              <li
                onClick={(e) => {
                  // e.stopPropagation();
                  // e.preventDefault();
                  item.action();
                  closeMenu();
                }}
                style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#eee")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {item.label}
              </li>
            ))}
          </ul>
        </Show>
      </Portal>
    );
  };

  return { onContextMenu: openMenu, ContextMenu };
}
