const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');

const { serverMain, DEFAULT_PORT } = require('./magpiler-core');

const optionDefinitions = [
  { name: 'port', alias: 'p', type: Number, description: "port on which server will listen (default "+DEFAULT_PORT+")"},
  { name: 'input', alias: 'i', defaultOption: true, type: String, description: "input folder to process"},
  { name: 'args', alias: 'a', type: String, description: "k1:v1,k2:v2 strings to add to options" },
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
        name: 'args',
        typeLabel: '{underline k1:v1,k2:v2,...}',
        description: "key value pairs to add to options object, available to config.js and global.js"
      },
      {
        name: 'port',
        typeLabel: '{underline number}',
        description: "port on which server will listen (default "+DEFAULT_PORT+")"
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
    serverMain(options);
  }
  if (process.argv.length <= 2) {
    console.log(getUsage(sections));
    return;
  }
  options = commandLineArgs(optionDefinitions);
  serverMain(options);
}

main();
