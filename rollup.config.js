import { terser } from "rollup-plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
// import { uglify } from "rollup-plugin-uglify";
import commonjs from "@rollup/plugin-commonjs";
import pkg from "./package.json";

// const externalDeps = Object.keys(
//     Object.assign({}, pkg.dependencies, pkg.peerDependencies)
// );

export default {
    input: "src/flow-control.js",
    external: ["pino", "numeral"],
    plugins: [
        resolve(),
        babel({
            exclude: "node_modules/**",
            babelHelpers: "runtime",
        }),
        commonjs({
            include: "node_modules/**",
        }),
        terser(),
    ],
    output: [
        {
            file: "flowcontrol.js",
            format: "umd",
            name: pkg.name,
            sourcemap: true,
        },
        // {
        //     file: "flowcontrol.esm.js",
        //     format: "es",
        // },
        // {
        //     file: "dist/flowcontrol.cjs.js",
        //     format: "cjs",
        //     name,
        //     sourcemap: "inline",
        // },
    ],
};
