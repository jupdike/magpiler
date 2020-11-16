const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const path = require('path');
const Path = path;
const fs = require('fs');
const md = require('markdown-it')({html: true});
const { renderToString } = require('@popeindustries/lit-html-server');
const express = require('express');

const DEFAULT_PORT = 8123;

const optionDefinitions = [
  { name: 'port', alias: 'p', type: Number, description: "port on which server will listen"},
  { name: 'input', alias: 'i', defaultOption: true, type: String, description: "input folder to process"},
  { name: 'help', alias: 'h', type: Boolean, description: "print this usage help and exit"}
];

const sections = [
  {
    header: 'magpiler-dev',
    content: 'Xpiler for a Markdown- and JS-based website.\nRun a dev server.'
  },
  {
    header: 'Options',
    optionList: [
      {
        name: 'input',
        typeLabel: '{underline folder}',
        description: '(Default with no flags.) The input folder to process (e.g. {underline /path/to/src}).'
      },
      {
        name: 'help',
        description: 'Print this usage guide.'
      }
    ]
  }
];

function main(options) {
  if (options) {
    realMain(options);
  }
  if (process.argv.length <= 2) {
    console.log(getUsage(sections));
    return;
  }
  options = commandLineArgs(optionDefinitions);
  realMain(options);
}

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
  //console.log('file:', ob.file);
  lines = ob.contents.split('\n');
  ob.meta = {}
  if (lines.length < 1) {
    return;
  }
  if (lines[0] == "---") {
    let pairs = {}
    let sepCount = 0;
    let cleanLines = [];
    lines.forEach(line => {
      if (line === '---') {
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
        }
      }
    });
    //console.log(ob);
    ob.body = cleanLines.join("\n");
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
    } else {
      ret.push(file);
    }
  });
  return ret;
}

// const http = require('http');
// const { renderToStream } = require('@popeindustries/lit-html-server');
// const port = 8123;
// console.log("Listening on port", port);
// http.createServer((request, response) => {
//   const data = { title: 'Home', api: '/api/home' };
//   response.writeHead(200);
//   // Returns a Node.js Readable stream which can be piped to "response"
//   renderToStream(Layout(data)).pipe(response);
// }).listen(port);

function realMain(options) {
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
  fs.readdirSync(options.src).forEach(folder => {
    if ('render layouts static'.split(' ').includes(folder)) {
      options[folder] = getFileNames(Path.join(options.src, folder), folder != 'static');
    }
  });
  // layouts from an array to a dict
  let layouts = {};
  options.layouts.forEach(o => {
    if (o.file.endsWith(".js")) {
      let short = o.file.replace('.js', '');
      layouts[short] = o;
    }
  });
  options.layoutsDict = layouts;
  //console.log("OPTIONS\n---\n", options);
  options.global = { footerHTML: "<p>Test Footer text</p>" }; // TODO get this from src/ folder or its parent

  startServer(options);
}

function getPage(url, context, global) {
  let def = context.layoutsDict['default'];
  // options.render.forEach(context => {
  //   let layout = context.layout || 'default';
  //   // TODO use default layout AFTER first layout
  //   //console.log(context.file, layout);
  //   let ret = def.templateFunc(context, context.global);
  //   renderToString(ret).then(result => {
  //     // console.log('---');
  //     // console.log(context.file);
  //     // //console.log(c.body);
  //     // console.log(result);
  //   });
  // });
}

function startServer(options) {
  let app = express();
  app.get('/', function (req, res) {
    res.send('Hello World')
  })
  const port = options.port || DEFAULT_PORT;
  console.log('Listening on localhost:' + port);
  app.listen(port);
}

main();
