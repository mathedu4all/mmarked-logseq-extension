import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import { visualizer } from "rollup-plugin-visualizer";

export default {
  input: "src/index.ts",
  external: ['marked'],
  output: {
    name: 'mmarked.ext',
    format: 'iife',
    dir: "dist",
    entryFileNames: "index.js",
    globals: {
			marked: 'marked',
		}
  },
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: "./tsconfig.json",
      sourceMap: false
    }),
    commonjs(),
    terser(),
    visualizer(),
  ],
  external: ["@logseq/libs", "marked"],
};