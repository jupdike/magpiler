const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const path = require('path');
const Path = path;
const fs = require('fs');

const optionDefinitions = [
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
const getDirectories = path => fs.readdirSync(path).map(name => Path.join(path, name)).filter(isDirectory);
const isFile = path => fs.statSync(path).isFile();  
const getFiles = path => fs.readdirSync(path).map(name => Path.join(path, name)).filter(isFile);
const getFilesRecursively = (path) => {
  let dirs = getDirectories(path);
  let files = dirs.map(dir => getFilesRecursively(dir)) // go through each directory
                  .reduce((a,b) => a.concat(b), []);    // map returns a 2d array (array of file arrays) so flatten
  return files.concat(getFiles(path));
};

function processMeta(ob) {
  //console.log('file:', ob.file);
  ob.lines = ob.contents.split('\n');
  ob.meta = {}
  if (ob.lines.length < 1) {
    return;
  }
  if (ob.lines[0] == "---") {
    let pairs = {}
    let sepCount = 0;
    let cleanLines = [];
    ob.lines.forEach(line => {
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
          if (rhs.startsWith('"') || rhs.startsWith("'")) {
            rhs = JSON.parse(rhs);
          }
          ob.meta[key] = rhs;
        }
      }
    });
    ob.body = cleanLines.join("\n");
  }
  //console.log(ob.meta);
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
    } else {
      ret.push(file);
    }
  });
  return ret;
}

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
  //console.log("OPTIONS\n---\n", options);
}

main();
