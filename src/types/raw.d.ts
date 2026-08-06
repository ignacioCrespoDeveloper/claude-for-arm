/** Vite's `?raw` suffix imports a file as a string. Used to render the SKILL.md files in-app. */
declare module '*?raw' {
  const content: string;
  export default content;
}
