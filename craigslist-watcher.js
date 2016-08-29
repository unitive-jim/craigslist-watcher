const _ = require('lodash');
const craigslistscraper = require('./craigslist-scraper');
const Datastore = require('nedb');
const debug = require('debug');
const fs = require('fs');
const P = require('bluebird');
const program = require('commander');
const SlackWebhook = require('slack-webhook');

const dlog = debug('craigslist');

const SLACK = 'https://hooks.slack.com/services/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'   // craigs-test

const slack = new SlackWebhook(SLACK, { Promise: P });

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

let findOne = null;
let insert = null;

function initDb() {
  const db = new Datastore({ filename: dbFileName });
  const options = { context: db };
  const methods = _.map(['loadDatabase', 'ensureIndex', 'findOne', 'insert'], (m) => P.promisify(db[m], options));
  let loadDatabase = null;
  let ensureIndex = null;
  [loadDatabase, ensureIndex, findOne, insert] = methods;
  return ensureIndex({ fieldName: 'href', unique: true })
    .then(() => loadDatabase());
}

const baseUrl = 'http://' + program.city + '.craigslist.org';

function notify(doc) {
  const message = `${doc.housing} ${doc.price} ${doc.loc} ${doc.href}`;
  dlog(message);
  return slack.send(message);
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

initDb()
.then(() => craigslistscraper.query(baseUrl))
.then((results) => _.each(results, (doc) => processDoc(doc)))
.catch((err) => {
  console.error('Error:', err);
});


