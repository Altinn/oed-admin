import { describe, expect, it } from "vitest";
import { prettifyXml } from "./formatters";

describe("prettifyXml", () => {
  it("indents nested elements and keeps leaf text inline", () => {
    const xml =
      '<?xml version="1.0" encoding="utf-8"?><oed><CaseId>abc</CaseId><Deceased><FirstName>RYDDIG</FirstName></Deceased></oed>';

    expect(prettifyXml(xml)).toBe(
      [
        "<oed>",
        "  <CaseId>abc</CaseId>",
        "  <Deceased>",
        "    <FirstName>RYDDIG</FirstName>",
        "  </Deceased>",
        "</oed>",
      ].join("\n"),
    );
  });

  it("keeps attributes, namespace declarations and self-closes empty elements", () => {
    const xml =
      '<oed xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Address /><UserId xsi:nil="true" /></oed>';

    expect(prettifyXml(xml)).toBe(
      [
        '<oed xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
        "  <Address/>",
        '  <UserId xsi:nil="true"/>',
        "</oed>",
      ].join("\n"),
    );
  });

  it("re-escapes text and attribute values", () => {
    const xml = '<a b="x &quot;y&quot; &amp; z"><c>1 &lt; 2 &amp; {"k":[]}</c></a>';

    expect(prettifyXml(xml)).toBe(
      ['<a b="x &quot;y&quot; &amp; z">', '  <c>1 &lt; 2 &amp; {"k":[]}</c>', "</a>"].join("\n"),
    );
  });

  it("drops whitespace between elements of already indented input", () => {
    const xml = "<a>\n    <b>1</b>\n</a>";

    expect(prettifyXml(xml)).toBe(["<a>", "  <b>1</b>", "</a>"].join("\n"));
  });

  it("throws on malformed XML", () => {
    expect(() => prettifyXml("<a><b></a>")).toThrow();
  });
});
