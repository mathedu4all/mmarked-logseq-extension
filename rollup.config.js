import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { visualizer } from "rollup-plugin-visualizer";

export default {
  input: "src/index.ts",
  external: ["marked"],
  output: {
    name: "mmarked.ext",
    format: "iife",
    dir: "dist",
    entryFileNames: "index.js",
    sourcemap: false,
    globals: {
      marked: "marked",
    },
  },
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: "./tsconfig.json",
      sourceMap: false,
    }),
    commonjs(),
    visualizer(),
  ],
};
