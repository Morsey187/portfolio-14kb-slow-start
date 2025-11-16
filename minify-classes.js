const fs = require("fs-extra");
const path = require("path");
const postcss = require("postcss");
const selectorParser = require("postcss-selector-parser");
const posthtml = require("posthtml");
const cssnano = require("cssnano");
const { minify } = require("html-minifier-terser");

const cssPath = path.resolve(__dirname, "./static/styles.css");
const htmlPath = path.resolve(__dirname, "./static/index.html");
const jsPath = path.resolve(__dirname, "./static/main.js");

const isProduction = process.env.NODE_ENV === "production";

const css = fs.readFileSync(cssPath, "utf8");
const html = fs.readFileSync(htmlPath, "utf8");
let js = "";
if (isProduction && fs.existsSync(jsPath)) {
  js = fs.readFileSync(jsPath, "utf8");
}

const classMap = {};
let classIndex = 0;

// Classes that should NOT be minified (used by JS or external code)
const IGNORED_CLASSES = new Set([
  "active",
  "carousel-slides",
  "carousel-container",
  "carousel-indicator",
  "carousel-slide",
  "carousel-slide-layout",
  "carousel-slide-images",
  "carousel-slide-title",
  "carousel-slide-description",
  "carousel-slide-description-text",
  "carousel-container--has-text",
]);

const getShortName = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let name = "";
  let i = classIndex;
  do {
    name = chars[i % chars.length] + name;
    i = Math.floor(i / chars.length) - 1;
  } while (i >= 0);
  classIndex++;
  return name;
};

const transformSelector = selectorParser((selectors) => {
  selectors.walkClasses((classNode) => {
    const original = classNode.value;

    // Skip classes that should not be minified (e.g. used in JS)
    if (IGNORED_CLASSES.has(original)) {
      return;
    }

    if (!classMap[original]) {
      classMap[original] = getShortName();
    }
    classNode.value = classMap[original];
  });
});

async function processCSS(cssContent) {
  const plugin = (root) => {
    const promises = [];

    root.walkRules((rule) => {
      const p = transformSelector.process(rule.selector).then((res) => {
        rule.selector = res.toString();
      });
      promises.push(p);
    });

    return Promise.all(promises);
  };

  const result = await postcss([
    plugin,
    cssnano({ preset: "default" }),
  ]).process(cssContent, { from: undefined });

  return result.css;
}

async function processHTML(htmlContent, inlinedCSS = null, inlinedJS = null) {
  const result = await posthtml([
    (tree) => {
      // Minify class names in all `class` attributes
      tree.match({ attrs: { class: true } }, (node) => {
        const classList = node.attrs.class.trim().split(/\s+/);
        node.attrs.class = classList
          .map((cls) => classMap[cls] || cls)
          .join(" ");
        return node;
      });

      // Rewrite <style> blocks (optional: can be removed if not needed)
      if (inlinedCSS) {
        tree.match({ tag: "style" }, (node) => {
          node.content = [inlinedCSS];
          return node;
        });

        // Inline <link rel="stylesheet"> as <style>
        tree.match({ tag: "link", attrs: { rel: "stylesheet" } }, (node) => {
          return {
            tag: "style",
            attrs: {},
            content: [inlinedCSS],
          };
        });
      }

      // Inline <script src="main.js"> as inline script
      if (inlinedJS) {
        tree.match({ tag: "script" }, (node) => {
          if (node.attrs && node.attrs.src === "main.js") {
            return {
              tag: "script",
              attrs: {},
              content: [inlinedJS],
            };
          }
          return node;
        });
      }

      return tree;
    },
  ]).process(htmlContent);

  // HTML minification after transformation
  const minified = await minify(result.html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
    conservativeCollapse: false,
  });

  return minified;
}

(async () => {
  try {
    // Process external CSS file
    const minifiedCSS = await processCSS(css);

    // Process HTML including <style> and class attributes
    const finalHTML = await processHTML(html, minifiedCSS, js);

    await fs.writeFile(cssPath, minifiedCSS);
    await fs.writeFile(htmlPath, finalHTML);

    // Remove the main.js file since it's now inlined (only in production)
    if (isProduction && fs.existsSync(jsPath)) {
      fs.unlinkSync(jsPath);
      console.log(
        "✅ Minified class names written to dist (CSS + HTML + <style> + inline JS)"
      );
    } else {
      console.log(
        "✅ Minified class names written to dist (CSS + HTML + <style>)"
      );
    }
  } catch (err) {
    console.error("❌ Error during minification:", err);
    process.exit(1);
  }
})();
