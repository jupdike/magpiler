const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');

const path = require('path');
const Path = path;
const fs = require('fs');

const { renderPage, getFilesRecursively, parseOptions, loadData } = require('./magpiler-core');

const optionDefinitions = [
  { name: 'input', alias: 'i', defaultOption: true, type: String, description: "input folder to process"},
  { name: 'args', alias: 'a', type: String, description: "k1:v1,k2:v2 strings to add to options" },
  { name: 'help', alias: 'h', type: Boolean, description: "print this usage help and exit"}
];

const sections = [
  {
    header: 'magpiler-make',
    content: 'Xpiler for a Markdown- and JS-based website.\nGenerate entire static site.'
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
        name: 'args',
        typeLabel: '{underline k1:v1,k2:v2,...}',
        description: "key value pairs to add to options object, available to config.js and global.js"
      },
      {
        name: 'help',
        description: 'Print this usage guide.'
      }
    ]
  }
];

function mkdirNoCrash(path) {
  fs.mkdirSync(path, { recursive: true });
}

function makeMain(options) {
  options = parseOptions(sections, options);
  if (!options) {
    return;
  }
  loadData(options);
  console.log('output folder at', options.out);

  // mkdir out/ folder if it doesn't exist (but do not crash if it does exist)
  mkdirNoCrash(options.out);

  // TODO delete anything from out/ that is not present in static/ or render/
  // (or user can just manage this themselves and blow away the out/ folder if
  // they know they are renaming or removing things)

  // copy everything from static/ to out/ (if different size in bytes)
  getFilesRecursively(Path.join(options.src, "static")).forEach(file => {
    if (file.indexOf('/.') >= 0) { // skip .xyz files
      return;
    }
    let justFile = file.replace(options.src, '').replace('static/', '');
    if (justFile.startsWith('/')) {
      justFile = justFile.slice(1);
    }
    if (justFile.indexOf('/') >= 0) {
      let folderToEnsure = Path.join(options.out, Path.dirname(justFile));
      //console.log('mkdir -P', folderToEnsure);
      mkdirNoCrash(folderToEnsure);
    }
    let to = Path.join(options.out, justFile);
    fs.copyFileSync(file, to);
  });

  // render each page in render array as a page in out/
  options.render.forEach(ob => {
    if (ob.file.indexOf('/') >= 0) {
      let folderToEnsure = Path.join(options.out, Path.dirname(ob.file));
      //console.log('mkdir -P', folderToEnsure);
      mkdirNoCrash(folderToEnsure);
    }
    renderPage(ob.file, Path.join(options.out, ob.file), options);
  });

  // We are done when all the promises finish. Good night and enjoy your baked-out website!
}

function main() {
  if (process.argv.length <= 2) {
    console.log(getUsage(sections));
    return;
  }
  let options = commandLineArgs(optionDefinitions);
  makeMain(options);
}

main();
