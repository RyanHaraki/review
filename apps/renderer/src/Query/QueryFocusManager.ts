import { focusManager } from "@tanstack/react-query";

export function configureQueryFocusManager(): void {
  focusManager.setEventListener((handleFocus) => {
    const handleWindowFocus = () => handleFocus(document.visibilityState === "visible");
    const handleWindowBlur = () => handleFocus(false);
    const handleVisibilityChange = () => handleFocus(document.visibilityState === "visible");

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  });
}
