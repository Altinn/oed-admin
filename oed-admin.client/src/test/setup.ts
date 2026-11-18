import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no Web Animations API; Designsystemet's Skeleton and Spinner synchronize their animations through it.
if (!("getAnimations" in document)) {
  Object.defineProperty(document, "getAnimations", { value: () => [] });
}

afterEach(() => {
  cleanup();
});
