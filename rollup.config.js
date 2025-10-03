import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import { visualizer } from "rollup-plugin-visualizer";

export default {
  input: "src/index.ts",
  external: ["@logseq/libs", "@mathcrowd/mmarked"],
  output: {
    name: "mmarked.ext",
    format: "iife",
    dir: "dist",
    entryFileNames: "index.js",
    sourcemap: false,
    globals: {
      "@logseq/libs": "LSPluginEntry",
      "@mathcrowd/mmarked": "marked",
    },
  },
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: "./tsconfig.json",
      sourceMap: false,
    }),
    commonjs(),
    terser(),
    visualizer(),
  ],
};