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
    header: 'piler-dev',
    content: 'Xpiler for a Markdown- and JS-based website.'
  },
  {
    header: 'Options',
    optionList: [
      {
        name: 'input',
        typeLabel: '{underline folder}',
        description: 'The input folder to process (e.g. {underline /path/to/src}).'
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

function getFileNames(folder, shouldGetContents) {
  let ret = [];
  getFilesRecursively(folder).forEach(fullPath => {
    let file = fullPath.replace(folder + '/', '');
    if (fullPath.indexOf('/.') >= 0) { // skip .xyz files
      return;
    }
    console.log(folder, file);
    if (shouldGetContents) {
      let c = fs.readFileSync(Path.join(folder, file)) + "";
      ret.push({ name: file, contents: c });
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
    //console.log("FOLDER:", folder);
    if ('render layouts static'.split(' ').includes(folder)) {
      options[folder] = getFileNames(Path.join(options.src, folder), folder != 'static');
    }
  });
  console.log("OPTIONS\n---\n", options);
}

main();
