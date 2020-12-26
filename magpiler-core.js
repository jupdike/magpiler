const getUsage = require('command-line-usage');

const md = require('markdown-it')({html: true}).use(require('markdown-it-footnote'));

const path = require('path');
const Path = path;
const fs = require('fs');

const { html } = require('@popeindustries/lit-html-server');
const { unsafeHTML } = require('@popeindustries/lit-html-server/directives/unsafe-html.js');
const { renderToString, renderToStream } = require('@popeindustries/lit-html-server');
const isString = (str) => str instanceof String || typeof str === "string";
const noEscape = (x) => isString(x) ? unsafeHTML(x) : x;

const DEFAULT_PORT = 8123;

const express = require('express');
const serveStatic = require('serve-static')

// https://stackoverflow.com/a/47492545
const isDirectory = path => fs.statSync(path).isDirectory();
const getDirectories = path =>
  fs.readdirSync(path).map(name => Path.join(path, name)).filter(isDirectory);
const isFile = path => fs.statSync(path).isFile();  
const getFiles = path =>
  fs.readdirSync(path).map(name => Path.join(path, name)).filter(isFile);
const getFilesRecursively = (path) => {
  let dirs = getDirectories(path);
  let files = dirs.map(dir => getFilesRecursively(dir)) // go through each directory
                  .reduce((a,b) => a.concat(b), []);    // map returns a 2d array (array of file arrays) so flatten
  return files.concat(getFiles(path));
};

function processMeta(ob) {
  console.log('file:', ob.file);
  lines = ob.contents.split('\n');
  ob.meta = {}
  if (lines.length < 1) {
    return;
  }
  if (lines[0] === "---" || lines[0] === '/*---') {
    let pairs = {}
    let sepCount = 0;
    let cleanLines = [];
    lines.forEach(line => {
      if (line === '---' || line === '/*---' || line === '---*/') {
        sepCount++;
        return;
      }
      if (sepCount >=2 ) {
        cleanLines.push(line);
      } else {
        let ix = line.indexOf(":");
        if (ix > 0) {
          let key = line.slice(0, ix).trim();
          let rhs = line.slice(ix +1).trim();
          rhs = JSON.parse(rhs);
          ob[key] = rhs;
          if (key === "date") {
            ob[key] = new Date(rhs);
          }
        }
      }
    });
    //console.log(ob);
    ob.body = cleanLines.join("\n");
  } else {
    ob.body = ob.contents;
  }
  //console.log(ob.meta);
}

function processMarkdown(ob) {
  if (ob.file.endsWith('.md')) {
    ob.file = ob.file.replace('.md', '');
    ob.body = md.render(ob.body);
    //console.log("-=-=-\n", ob);
  }
}

// all non-static .js files are considered layouts or templates
function processLayout(ob) {
  if (ob.file.endsWith(".js")) {
    //console.log("-=-=-\n", ob);
    ob.templateFunc = eval(ob.contents);
  }
}

function getFileNames(folder, shouldGetContents) {
  let ret = [];
  getFilesRecursively(folder).forEach(fullPath => {
    let file = fullPath.replace(folder + '/', '');
    if (fullPath.indexOf('/.') >= 0) { // skip .xyz files
      return;
    }
    if (shouldGetContents) {
      let c = fs.readFileSync(Path.join(folder, file)) + "";
      let ob = { file: file, contents: c };
      ret.push(ob);
      processMeta(ob);
      processMarkdown(ob);
      processLayout(ob);
      //console.log(ob.file);
    } else {
      ret.push(file);
    }
  });
  return ret;
}

function expandArgs(options) {
  if (options.args) {
    let pairs = options.args.split(',');
    pairs.forEach(pair => {
      let kv = pair.split(':');
      if (kv.length >= 2) {
        options[kv[0]] = kv[1];
      }
    });
  }
}

function parseOptions(sections, options) {
  if (options.help) {
    console.log(getUsage(sections));
    return;
  }
  if (!options.input) {
    console.log("Expected -i folder, to know which folder to process");
    return;
  }
  options.src = Path.join(options.input, "src");
  options.out = Path.join(options.input, "out");

  expandArgs(options);

  return options;
}

function loadData(options) {
  // first pass, read through files and process metadata (YAML) and Markdown
  fs.readdirSync(options.src).forEach(folder => {
    if ('render layouts static'.split(' ').includes(folder)) {
      options[folder] = getFileNames(Path.join(options.src, folder), folder != 'static');
    }
  });
  
  // /layouts/ from an array to a dict
  let layouts = {};
  options.layouts.forEach(o => {
    if (o.file.endsWith(".js")) {
      let short = o.file.replace('.js', '');
      layouts[short] = o;
    }
  });
  options.layoutsDict = layouts;

  // /render/ items from an array to a dict
  options.renderDict = [];
  options.render.forEach(o => {
    options.renderDict[o.file] = o;
  });

  // these get merged into one object
  // separate files allow a smaller config.js to be left out of the repo and copied from a source-controlled file. global.js could contain code/helper methods
  options.global = eval(fs.readFileSync(Path.join(options.src, "global.js"))+"")(options);
  let config = eval(fs.readFileSync(Path.join(options.src, "config.js"))+"")(options);
  for (var key in config) {
    if (!config.hasOwnProperty(key)) {
      continue;
    }
    options.global[key] = config[key];
  }
  options.global['renderLayout'] = (a, b) => {
    //console.log("global.renderLayout called with", a);
    return renderLayoutInner(options, a, b);
  };
  //console.log(options.global);

  // // proof of concept.
  // // unsafeHTML does not work when the argument is a TemplateResult, but noEscape does!
  // let ret1 = (x => html`<a>got ${x.body} it</a>`)({body: "1"});
  // let ret2 = (x => html`outer ${noEscape(x.body)} outer`)({body: ret1});
  // renderToString(ret2).then(result => {
  //   console.log('---');
  //   console.log(result);
  // });
}

// copy k/vs in a into a new object, then copy k/vs from b into this new obj
function copiedAndMerged(a, b) {
  let ret = {};
  for (var key in a) {
    if (!a.hasOwnProperty(key)) {
      continue;
    }
    ret[key] = a[key];
  }
  for (var key in b) {
    if (!b.hasOwnProperty(key)) {
      continue;
    }
    ret[key] = b[key];
  }
  return ret;
}

function keysOf(ob) {
  let ret = [];
  for (let k in ob) {
    if (!ob.hasOwnProperty(k)) {
      continue;
    }
    ret.push(k);
  }
  return ret;
}

function renderLayoutInner(options, layoutName, context) {
  let ob = context;
  let globalCopy = copiedAndMerged(options.global, {documentUrl: context.file});
  let ret;
  do {
    //console.log('r l i DO -----------');
    ////console.log('layoutsDict keys:', keysOf(options.layoutsDict))
    layout = options.layoutsDict[layoutName];
    ////console.log('layout:', layout);
    //console.log("layoutName:", layoutName, '-- layout.layout:', layout.layout);
    layoutName = layout.layout;
    //console.log("RECURSIVE CALL here, possibly");
    ret = layout.templateFunc(ob, globalCopy);
    ////console.log("renderLayout:", context.file, "layoutName:", layoutName);
    //console.log("layoutName of layout:", layoutName);
    ob = { 'body': ret }; // TODO this could copy old 'ob' field by field, then set 'body' here
    //console.log('ob:', ob);
  } while (layoutName); // if not undefined, try again
  //console.log("END r l i ---------");
  return ret;
}

function getPage(url, req, response, options) {
  if (url.startsWith('/')) {
    url = url.slice(1);
  }
  let def = options.layoutsDict['default'];
  let context = options.renderDict[url];
  let layoutName = 'default';
  if (context && context.layout) {
    layoutName = context.layout;
  }
  console.log("getPage:", url);
  let ret = renderLayoutInner(options, layoutName, context);
  if (isString(ret)) {
    if (url.endsWith(".xml")) {
      response.type("text/xml");
    }
    response.send(ret)
    return;
  }
  renderToStream(ret).pipe(response);
}

function renderPage(url, outPath, options) {
  if (url.startsWith('/')) {
    url = url.slice(1);
  }
  let def = options.layoutsDict['default'];
  let context = options.renderDict[url];
  let layoutName = 'default';
  if (context && context.layout) {
    layoutName = context.layout;
  }
  //console.log("renderPage:", url);
  let ret = renderLayoutInner(options, layoutName, context);
  if (isString(ret)) { // can use simple strings, for example for XML (e.g. rss.xml)
    fs.writeFile(outPath, ret, (err) => {
      if (err) throw err;
      //console.log('wrote out', ret.length, 'bytes to', outPath);
    });
    return;
  }
  //console.log('want to renderToString');
  renderToString(ret).then(data => {
    fs.writeFile(outPath, data, (err) => {
      if (err) throw err;
      //console.log('wrote out', data.length, 'bytes to', outPath);
    });
  }, err => {
    console.log("an error occurred in renderPage at renderToString:", url, "---\n", err);
  });
}

function my404(req, res, options) {
  let url = req.url;
  console.error("bad url:", url);
  res.writeHead(404, {'content-type': 'text/html'});
  getPage('404.html', req, res, options);
};

function startServer(options) {
  let app = express();
  app.use(serveStatic(Path.join(options.input, 'src/static')))
  app.get('/', (req, res) => {
    //res.send('Hello World');
    getPage('index.html', req, res, options);
  })
  // get any page from src/render
  options.render.forEach(ob => {
    //console.log('ADDING ROUTE FOR ' + ob.file);
    app.get('/' + ob.file, (req, res) => {
      getPage(ob.file, req, res, options);
    });
  });
  // needs to be last!
  app.use((req, res) => {
    my404(req, res, options);
  });

  const port = options.port || DEFAULT_PORT;
  console.log('Listening on localhost:' + port);
  app.listen(port);
}

module.exports = {
  startServer: startServer,
  parseOptions: parseOptions,
  loadData: loadData,
  renderPage: renderPage,
  getFilesRecursively: getFilesRecursively,
  DEFAULT_PORT: DEFAULT_PORT
};
