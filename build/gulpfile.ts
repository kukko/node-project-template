import { exec } from "child_process";
import gulp, { series } from "gulp";
import gulpNodemon from "gulp-nodemon";
import rename from "gulp-rename";
import sourceMap from "gulp-sourcemaps";
import ts from "gulp-typescript";
import { join } from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
  .options({
    production: { type: "boolean", default: false },
    fromPlugin: { type: "boolean", default: false },
  })
  .parseSync();

let pathPrefixes: string[] = argv.fromPlugin ? [] : [".."];

function getPath(path: string) {
  return join(...[...pathPrefixes, path]).replace(/\\/g, "/");
}

function getDistPath(): string {
  return getPath(join(...(argv.production ? [".."] : []), "dist"));
}

const tsProject = ts.createProject(getPath("tsconfig.json"));

gulp.task("clean", () => {
  return exec(
    `node ../node_modules/rimraf/dist/commonjs/index.js ${getPath(
      "dist"
    )} ${getPath("maps")}`,
    {
      cwd: ".",
    }
  );
});

gulp.task("compile-ts", () => {
  return gulp
    .src([getPath("src/**/*.ts"), "!" + getPath("src/**/example-*.ts")])
    .pipe(sourceMap.init())
    .pipe(tsProject())
    .pipe(
      sourceMap.mapSources((sourcePath) => {
        return "../src/" + sourcePath.replace(/\.js$/, ".ts");
      })
    )
    .pipe(sourceMap.write(getDistPath()))
    .on("error", () => {})
    .pipe(gulp.dest(getDistPath()));
});

gulp.task("copy-files", () => {
  const src = argv.production
    ? [
        getPath("src/**/*.js"),
        getPath("src/**/example-*.ts"),
        getPath("package.json"),
      ]
    : [getPath("src/**/*.js"), getPath("src/**/example-*.ts")];
  return gulp.src(src).pipe(gulp.dest(getDistPath()));
});

gulp.task(
  "compile",
  argv.production
    ? gulp.series("compile-ts", "copy-files")
    : gulp.series("compile-ts", "copy-files")
);

gulp.task("watch", () => {
  const sourceFolder = "src";
  const watcher = gulp.watch(getPath(`${sourceFolder}/**/*`));
  watcher.on("change", (path, stats) => {
    console.log(`Recompiling: ${path}`);
    gulp
      .src([path])
      .pipe(sourceMap.init())
      .pipe(tsProject())
      .pipe(
        sourceMap.mapSources((sourcePath) => {
          return "../src/" + sourcePath.replace(/\.js$/, ".ts");
        })
      )
      .pipe(sourceMap.write(getDistPath()))
      .on("error", () => {})
      .pipe(
        rename((file) => {
          file.dirname = getPath(
            "dist" +
              file.dirname.replace(/\.\.(\/|\\)/, "").substring("dist".length)
          );
        })
      )
      .pipe(gulp.dest("."));
  });
  watcher.on("add", (path, stats) => {
    console.log(`Compiling: ${path}`);
    gulp
      .src([path])
      .pipe(sourceMap.init())
      .pipe(tsProject())
      .pipe(
        sourceMap.mapSources((sourcePath) => {
          return "../src/" + sourcePath.replace(/\.js$/, ".ts");
        })
      )
      .pipe(sourceMap.write(getDistPath()))
      .on("error", () => {})
      .pipe(
        rename((file) => {
          file.dirname = getPath(
            "dist" +
              file.dirname.replace(/\.\.(\/|\\)/, "").substring("dist".length)
          );
        })
      )
      .pipe(gulp.dest("."));
  });
  watcher.on("unlink", (path, stats) => {
    path =
      "dist" +
      path.substring(
        (<string>path).indexOf(sourceFolder) + sourceFolder.length,
        path.length - 2
      ) +
      "js";
    console.log(`Removing: ${path}`);
    console.log(`Removing: ${path}.map`);
    return exec(`npx rimraf ${path} ${path}.map`, {
      cwd: getPath(""),
    });
  });
});

gulp.task("nodemon", () => {
  var stream = gulpNodemon({
    script: getPath("dist/index.js"),
    watch: [getPath("dist")],
  });
  stream
    .on("restart", () => {
      console.log("Server restarted!");
    })
    .on("crash", () => {
      stream.emit("restart", 10);
    });
});

gulp.task("rebuild", series("clean", "compile"));

gulp.task(
  "default",
  gulp.series("clean", "compile", gulp.parallel("nodemon", "watch"))
);
