import React from "react";

/**
 * A ref that focuses its element once, when it mounts, so a confirmation takes keyboard and screen-reader users to its
 * confirm button. Stable, so a re-render (the page polls) never moves focus back.
 */
export const useFocusOnMount = () =>
  React.useCallback((element: HTMLElement | null) => {
    element?.focus();
  }, []);
