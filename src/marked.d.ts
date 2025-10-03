declare module "marked" {
  function renderMarkdown(text: string): { parsed: string };
  function tex2svg(text: string): string;
  export { renderMarkdown, tex2svg };
}
