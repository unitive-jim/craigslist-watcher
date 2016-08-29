const _ = require('lodash');
const cheerio = require("cheerio");
const rp = require('request-promise');

const searchUrl = 'http://sfbay.craigslist.org/search/sfc/apa?nh=3&nh=7&nh=9&nh=13&nh=15&nh=21&nh=164&nh=28&nh=29&nh=114&min_price=3000&max_price=4500&bedrooms=2'

const options = {
    uri: searchUrl,
    transform: function (body) {
        return cheerio.load(body);
    }
};

exports.query = function(baseUrl) {
  baseUrl = baseUrl.replace(/\/$/, '');

  var results = [];

  return rp(options).then(function($) {

    $('.rows p.row').each(function() {
      var row = $(this);

      var date = row.find('span.pl time').attr('datetime');
      var link = row.find('span.pl > a').first();
      var text = link.text();
      var href = link.attr('href');
      var price = row.find('span.price').first().text();
      var loc = row.find('span.pnr small').first().text();
      var housing = row.find('span.housing').first().text();

      // check if href is relative
      // for now, let's not include "Nearby area" results
      // TODO: flag if nearby results should be included
      if (href.match(/^(\/|\.\.\/)/)) {
        href = baseUrl + href;
      } else {
        console.log('Bad href?', href);
        return false;
      }
      const result = _.mapValues({date, text, href, price, loc, housing}, (val) => _.isString(val) ? val.trim() : val);
      results.push(result);
    });

    return results;
  });
}
