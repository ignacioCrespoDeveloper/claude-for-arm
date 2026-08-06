// The npm package's default entry point is the Node build. Vite needs the
// prebuilt browser bundle, which ships without its own type declarations.
declare module 'exceljs/dist/exceljs.min.js' {
  import ExcelJS from 'exceljs';
  export default ExcelJS;
}
