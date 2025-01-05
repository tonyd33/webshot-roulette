import { useState, useEffect } from "react";

export function useHighlight(opts?: { dismissable?: boolean }) {
  const { dismissable = true } = opts ?? {};
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  const highlight = (id: string) => {
    setTargetId(id);
    setIsActive(true);
  };

  const clear = () => {
    setTargetId(null);
    setIsActive(false);
  };

  useEffect(() => {
    if (!isActive || !targetId) return;

    const target = document.getElementById(targetId);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const overlay = document.createElement("div");

    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.zIndex = "9999";
    overlay.style.pointerEvents = "none";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    // fuck lol, we won't be able to add any border radius to this and this
    // is a hot mess, but it works.
    // also i have no idea how i can add animations to this but oh well
    const vertices = [
      // screen top left
      "0% 0%",
      // screen bottom left
      "0% 100%",
      // screen bottom right
      "100% 100%",
      // screen right, rect bottom
      `100% ${rect.bottom}px`,
      // rect bottom left
      `${rect.left}px ${rect.bottom}px`,
      // rect top left
      `${rect.left}px ${rect.top}px`,
      // rect top right
      `${rect.right}px ${rect.top}px`,
      // rect bottom right
      `${rect.right}px ${rect.bottom}px`,
      // screen right, rect bottom
      `100% ${rect.bottom}px`,
      // screen top right
      `100% 0%`,
    ];
    overlay.style.clipPath = `polygon(${vertices.join(",")})`;

    overlay.addEventListener("click", clear);
    document.body.appendChild(overlay);

    return () => {
      overlay.remove();
    };
  }, [dismissable, isActive, targetId]);

  return { highlight, clear };
}
