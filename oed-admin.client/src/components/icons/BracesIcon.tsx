import type { SVGProps } from "react";

// Aksel has no curly-brace icon, and its CodeIcon (angle brackets) is already used
// for the instance column. Sized in em and drawn in currentColor so it behaves like
// an Aksel icon wherever it is dropped in. The glyph is kept inside roughly y 6-18
// with a 1.5 stroke to match CodeIcon's optical weight when the two sit side by side.
export default function BracesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M9.5 6H9a2 2 0 0 0-2 2v2.5A1.5 1.5 0 0 1 5.5 12 1.5 1.5 0 0 1 7 13.5V16a2 2 0 0 0 2 2h.5" />
      <path d="M14.5 6h.5a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 1.5 1.5 1.5 1.5 0 0 0-1.5 1.5V16a2 2 0 0 1-2 2h-.5" />
    </svg>
  );
}
