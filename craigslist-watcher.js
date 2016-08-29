const _ = require('lodash');
const craigslistscraper = require('./craigslist-scraper');
const Datastore = require('nedb');
const debug = require('debug');
const fs = require('fs');
const P = require('bluebird');
const program = require('commander');
const slackbots = require('slackbots');

const dlog = debug('craigslist');

const defaults = {
  city: 'sfbay',
}

program
  .option('-c, --city [subdomain]', `The city subdomain [${defaults.city}]`, defaults.city)
  .option('-f, --fresh', 'Start with an empty database')
  .parse(process.argv);

const dbFileName = process.env.HOME + '/.local/share/craigslist.db';

if (program.fresh) {
  fs.unlinkSync(dbFileName);
}

const db = new Datastore({ filename: dbFileName, autoload: true });
const options = { context: db };

const ensureIndex = P.promisify(db.ensureIndex, options);
const findOne = P.promisify(db.findOne, options);
const insert =  P.promisify(db.insert,  options);

const baseUrl = 'http://' + program.city + '.craigslist.org';

function notify(doc) {
  // TODO: notify via slackbots
  dlog(`New listing: ${doc.href}`);
  return P.resolve();
}

function processDoc(doc) {
  // fields of doc: { date, text, href, price, loc, housing }
  // The href must be unique, so is used as the key

  const select = _.pick(doc, 'href');
  findOne(select)
  .then((dbDoc) => {
    if (dbDoc) {
      dlog(`Ignoring preexisting listing: ${doc.href}`);
      return;
    } else {
      return insert(doc).then(() => notify(doc));
    }
  })
}

ensureIndex({ fieldName: 'href', unique: true })
.then(() => craigslistscraper.query(baseUrl))
.then((results) => _.each(results, (doc) => processDoc(doc)));

